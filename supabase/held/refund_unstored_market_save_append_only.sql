-- HELD. DO NOT APPLY.
-- Security reviews this file. DW applies it. It is not a migration.
--
-- Prod already has 20261120180000_shopper_market_unlocks.sql and
-- 20261120201000_market_save_lookup_guards.sql, as written.
-- public.shopper_credit_events is append-only. private.drevvy_credit_events_guard
-- rejects every UPDATE and DELETE except the user-deletion cleanup.
-- The applied refund_unstored_market_save UPDATEs the spend row, so it fails
-- with 'shopper_credit_events is append-only' and rolls the refund back.
-- The key stays spent and the claim stays held.
--
-- This replacement inserts a refund row and restores the balance. It does not
-- update or delete the spend row. The refund's idempotency key is
-- 'refund:' || the spend's idempotency key, so a second call inserts nothing
-- and does not credit again.
--
-- A refunded spend is not an open hold. The next charge uses a new key,
-- because the original use:market_save:<listing> key is still taken.

create or replace function public.refund_unstored_market_save(
  p_user_id uuid,
  p_listing_id text
)
returns table(
  refunded boolean,
  balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_event_id uuid;
  v_spend_key text;
  v_kind text;
  v_key_kind text;
  v_refund_key text;
begin
  if p_listing_id is null or p_listing_id !~ '^[A-Za-z0-9_-]{4,64}$' then
    raise exception 'listing id is required';
  end if;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance
    into v_balance
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  delete from public.shopper_market_refund_slots as s
  where s.user_id = p_user_id
    and s.listing_id = p_listing_id;

  if exists (
    select 1 from public.shopper_market_unlocks u
    where u.user_id = p_user_id and u.listing_id = p_listing_id
  ) then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  select e.id, e.idempotency_key, e.spend_kind, e.key_kind
    into v_event_id, v_spend_key, v_kind, v_key_kind
  from public.shopper_credit_events as e
  where e.user_id = p_user_id
    and e.listing_id = p_listing_id
    and e.event_type = 'use'
    and e.spend_kind = 'market_save'
    and not exists (
      select 1
      from public.shopper_credit_events as r
      where r.user_id = e.user_id
        and r.event_type = 'refund'
        and r.spend_kind = 'market_save'
        and r.idempotency_key = 'refund:' || e.idempotency_key
    )
  order by e.created_at desc
  limit 1;

  if v_event_id is null or v_spend_key is null then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  v_refund_key := 'refund:' || v_spend_key;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key
    )
    values (
      p_user_id,
      'refund',
      1,
      p_listing_id,
      coalesce(v_kind, 'market_save'),
      v_key_kind,
      v_refund_key
    );
  exception
    when unique_violation then
      return query select false, coalesce(v_balance, 0);
      return;
  end;

  update public.shopper_credits as c
  set balance = c.balance + 1,
      lifetime_used = case when c.lifetime_used > 0 then c.lifetime_used - 1 else 0 end,
      lifetime_refunded = c.lifetime_refunded + 1,
      updated_at = pg_catalog.now()
  where c.user_id = p_user_id
  returning c.balance into v_balance;

  return query select true, coalesce(v_balance, 0);
end;
$$;

revoke execute on function public.refund_unstored_market_save(uuid, text) from anon, authenticated, public;
grant execute on function public.refund_unstored_market_save(uuid, text) to service_role;

-- An open market_save use holds the key. A use with a refund row does not.
create or replace function public.claim_market_save_lookup(
  p_user_id uuid,
  p_ip_hash text,
  p_listing_id text
)
returns table(
  action text,
  scope text,
  hold boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_hits integer;
  v_ip_hits integer;
  v_refunds integer;
  v_slots integer;
  v_hold boolean;
  v_own_slot boolean;
begin
  if p_user_id is null
    or p_ip_hash is null
    or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_listing_id is null
    or p_listing_id !~ '^[A-Za-z0-9_-]{4,64}$'
  then
    return query select 'unavailable'::text, null::text, false;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0::bigint));

  delete from public.shopper_market_lookup_hits as h
  where h.created_at < pg_catalog.now() - interval '10 minutes';
  delete from public.shopper_market_refund_slots as s
  where s.reserved_at < pg_catalog.now() - interval '10 minutes';
  delete from public.shopper_market_upstream_attempts as a
  where a.recorded_at < pg_catalog.now() - interval '2 minutes';

  select count(*)::integer
    into v_user_hits
  from public.shopper_market_lookup_hits as h
  where h.user_id = p_user_id
    and h.created_at > pg_catalog.now() - interval '10 minutes';
  if coalesce(v_user_hits, 0) >= 10 then
    return query select 'rate_limited'::text, 'user'::text, false;
    return;
  end if;

  select count(*)::integer
    into v_ip_hits
  from public.shopper_market_lookup_hits as h
  where h.ip_hash = p_ip_hash
    and h.created_at > pg_catalog.now() - interval '10 minutes';
  if coalesce(v_ip_hits, 0) >= 30 then
    return query select 'rate_limited'::text, 'ip'::text, false;
    return;
  end if;

  insert into public.shopper_market_lookup_hits (user_id, ip_hash)
  values (p_user_id, p_ip_hash);

  select exists (
    select 1
    from public.shopper_credit_events as e
    where e.user_id = p_user_id
      and e.listing_id = p_listing_id
      and e.event_type = 'use'
      and e.spend_kind = 'market_save'
      and not exists (
        select 1
        from public.shopper_credit_events as r
        where r.user_id = e.user_id
          and r.event_type = 'refund'
          and r.spend_kind = 'market_save'
          and r.idempotency_key = 'refund:' || e.idempotency_key
      )
  ) into v_hold;

  if exists (
    select 1
    from public.market_intel_listing_misses as m
    where m.listing_id = p_listing_id
      and m.recorded_at > pg_catalog.now() - interval '24 hours'
  ) then
    return query select 'cached_miss'::text, null::text, coalesce(v_hold, false);
    return;
  end if;

  if exists (
    select 1
    from public.shopper_market_upstream_attempts as a
    where a.user_id = p_user_id
      and a.listing_id = p_listing_id
      and a.recorded_at > pg_catalog.now() - interval '2 minutes'
  ) then
    return query select 'rate_limited'::text, 'user'::text, coalesce(v_hold, false);
    return;
  end if;

  select count(*)::integer
    into v_refunds
  from public.shopper_credit_events as e
  where e.user_id = p_user_id
    and e.event_type = 'refund'
    and e.spend_kind = 'market_save'
    and e.created_at > pg_catalog.now() - interval '24 hours';

  select count(*)::integer
    into v_slots
  from public.shopper_market_refund_slots as s
  where s.user_id = p_user_id
    and s.listing_id <> p_listing_id;

  select exists (
    select 1
    from public.shopper_market_refund_slots as s
    where s.user_id = p_user_id
      and s.listing_id = p_listing_id
  ) into v_own_slot;

  if coalesce(v_refunds, 0) + coalesce(v_slots, 0) >= 5 then
    return query select 'refund_cap'::text, null::text, coalesce(v_hold, false);
    return;
  end if;

  if coalesce(v_own_slot, false) then
    return query select 'rate_limited'::text, 'user'::text, coalesce(v_hold, false);
    return;
  end if;

  insert into public.shopper_market_refund_slots (user_id, listing_id, reserved_at)
  values (p_user_id, p_listing_id, pg_catalog.now());

  return query select 'proceed'::text, null::text, coalesce(v_hold, false);
end;
$$;

revoke execute on function public.claim_market_save_lookup(uuid, text, text) from anon, authenticated, public;
grant execute on function public.claim_market_save_lookup(uuid, text, text) to service_role;

-- The original use key stays after a refund, so "that key exists" is not
-- "this listing is still paid for." An open use stores the snapshot without
-- a second charge. A refunded use is charged again under a new key.
create or replace function public.unlock_market_intel_atomic(
  p_user_id uuid,
  p_listing_id text,
  p_vin text,
  p_market jsonb
)
returns table(
  unlocked boolean,
  already_unlocked boolean,
  charged boolean,
  balance integer,
  market jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_balance integer;
  v_vin text;
  v_fair integer;
  v_low integer;
  v_median integer;
  v_high integer;
  v_comps integer;
  v_msrp integer;
  v_listed integer;
  v_new boolean;
  v_used_ok boolean;
  v_new_ok boolean;
  v_existing jsonb;
  v_open_key text;
  v_refund_id uuid;
begin
  if p_listing_id is null or p_listing_id !~ '^[A-Za-z0-9_-]{4,64}$' then
    raise exception 'listing id is required';
  end if;
  if p_market is null or pg_catalog.jsonb_typeof(p_market) <> 'object' then
    raise exception 'market intelligence has no value';
  end if;

  v_vin := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_vin, ''::text))), ''::text);
  if v_vin is not null and v_vin !~ '^[A-HJ-NPR-Z0-9]{11,17}$' then
    raise exception 'vin is not valid';
  end if;

  v_fair := nullif(p_market->>'fairVehiclePrice', ''::text)::integer;
  v_low := nullif(p_market->>'lowPrice', ''::text)::integer;
  v_median := nullif(p_market->>'medianPrice', ''::text)::integer;
  v_high := nullif(p_market->>'highPrice', ''::text)::integer;
  v_comps := nullif(p_market->>'comparablesCount', ''::text)::integer;
  v_msrp := nullif(p_market->>'msrp', ''::text)::integer;
  v_listed := nullif(p_market->>'listedPrice', ''::text)::integer;
  v_new := coalesce(p_market->>'isNewCar', ''::text) = 'true';

  v_used_ok := v_fair is not null and v_fair > 0
    and coalesce(v_comps, 0) >= 3
    and v_low is not null and v_median is not null and v_high is not null
    and v_low > 0 and v_low <= v_median and v_median <= v_high;
  v_new_ok := v_new
    and v_msrp is not null and v_msrp > 0
    and v_listed is not null and v_listed > 0;

  if not v_used_ok and not v_new_ok then
    raise exception 'market intelligence has no value';
  end if;

  v_key := 'use:market_save:' || p_listing_id;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance
    into v_balance
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  select u.market
    into v_existing
  from public.shopper_market_unlocks u
  where u.user_id = p_user_id and u.listing_id = p_listing_id;

  if v_existing is not null then
    return query select true, true, false, coalesce(v_balance, 0), v_existing;
    return;
  end if;

  select e.idempotency_key
    into v_open_key
  from public.shopper_credit_events as e
  where e.user_id = p_user_id
    and e.listing_id = p_listing_id
    and e.event_type = 'use'
    and e.spend_kind = 'market_save'
    and not exists (
      select 1
      from public.shopper_credit_events as r
      where r.user_id = e.user_id
        and r.event_type = 'refund'
        and r.spend_kind = 'market_save'
        and r.idempotency_key = 'refund:' || e.idempotency_key
    )
  order by e.created_at desc
  limit 1;

  if v_open_key is not null then
    insert into public.shopper_market_unlocks (user_id, listing_id, vin, market)
    values (p_user_id, p_listing_id, v_vin, p_market);
    return query select true, true, false, coalesce(v_balance, 0), p_market;
    return;
  end if;

  if coalesce(v_balance, 0) < 1 then
    return query select false, false, false, coalesce(v_balance, 0), null::jsonb;
    return;
  end if;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = v_key
  ) then
    select r.id
      into v_refund_id
    from public.shopper_credit_events as r
    where r.user_id = p_user_id
      and r.listing_id = p_listing_id
      and r.event_type = 'refund'
      and r.spend_kind = 'market_save'
    order by r.created_at desc
    limit 1;
    if v_refund_id is null then
      raise exception 'refunded market save has no refund row';
    end if;
    v_key := 'use:market_save:' || p_listing_id || ':after:' || v_refund_id::text;
  end if;

  insert into public.shopper_credit_events (
    user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key
  )
  values (p_user_id, 'use', 1, p_listing_id, 'market_save', 'market_intel', v_key);

  update public.shopper_credits as c
  set balance = c.balance - 1,
      lifetime_used = c.lifetime_used + 1,
      updated_at = pg_catalog.now()
  where c.user_id = p_user_id
    and c.balance >= 1
  returning c.balance into v_balance;

  if not found then
    raise exception 'key was not consumed';
  end if;

  insert into public.shopper_market_unlocks (user_id, listing_id, vin, market)
  values (p_user_id, p_listing_id, v_vin, p_market);

  return query select true, false, true, v_balance, p_market;
exception
  when unique_violation then
    select c.balance into v_balance
    from public.shopper_credits c
    where c.user_id = p_user_id;
    select u.market into v_existing
    from public.shopper_market_unlocks u
    where u.user_id = p_user_id and u.listing_id = p_listing_id;
    if v_existing is null then
      insert into public.shopper_market_unlocks (user_id, listing_id, vin, market)
      values (p_user_id, p_listing_id, v_vin, p_market)
      on conflict (user_id, listing_id) do nothing;
      select u.market into v_existing
      from public.shopper_market_unlocks u
      where u.user_id = p_user_id and u.listing_id = p_listing_id;
    end if;
    return query select true, true, false, coalesce(v_balance, 0), coalesce(v_existing, p_market);
end;
$$;

revoke execute on function public.unlock_market_intel_atomic(uuid, text, text, jsonb) from anon, authenticated, public;
grant execute on function public.unlock_market_intel_atomic(uuid, text, text, jsonb) to service_role;

-- Same open-spend rule for the reserve that runs before the paid lookup.
create or replace function public.consume_market_save_atomic(
  p_user_id uuid,
  p_listing_id text
)
returns table(
  consumed boolean,
  already_consumed boolean,
  balance integer,
  lifetime_purchased integer,
  lifetime_used integer,
  lifetime_refunded integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
  v_open_key text;
  v_refund_id uuid;
begin
  if p_listing_id is null or p_listing_id !~ '^[A-Za-z0-9_-]{4,64}$' then
    raise exception 'listing id is required';
  end if;

  v_key := 'use:market_save:' || p_listing_id;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance, c.lifetime_purchased, c.lifetime_used, c.lifetime_refunded
    into v_balance, v_purchased, v_used, v_refunded
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  select e.idempotency_key
    into v_open_key
  from public.shopper_credit_events as e
  where e.user_id = p_user_id
    and e.listing_id = p_listing_id
    and e.event_type = 'use'
    and e.spend_kind = 'market_save'
    and not exists (
      select 1
      from public.shopper_credit_events as r
      where r.user_id = e.user_id
        and r.event_type = 'refund'
        and r.spend_kind = 'market_save'
        and r.idempotency_key = 'refund:' || e.idempotency_key
    )
  order by e.created_at desc
  limit 1;

  if v_open_key is not null then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  if coalesce(v_balance, 0) <= 0 then
    return query select false, false, coalesce(v_balance, 0), coalesce(v_purchased, 0), coalesce(v_used, 0), coalesce(v_refunded, 0);
    return;
  end if;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = v_key
  ) then
    select r.id
      into v_refund_id
    from public.shopper_credit_events as r
    where r.user_id = p_user_id
      and r.listing_id = p_listing_id
      and r.event_type = 'refund'
      and r.spend_kind = 'market_save'
    order by r.created_at desc
    limit 1;
    if v_refund_id is null then
      raise exception 'refunded market save has no refund row';
    end if;
    v_key := 'use:market_save:' || p_listing_id || ':after:' || v_refund_id::text;
  end if;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key
    )
    values (p_user_id, 'use', 1, p_listing_id, 'market_save', 'market_intel', v_key);
  exception when unique_violation then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  update public.shopper_credits as c
  set balance = c.balance - 1,
      lifetime_used = c.lifetime_used + 1,
      updated_at = pg_catalog.now()
  where c.user_id = p_user_id
    and c.balance >= 1
  returning c.balance, c.lifetime_purchased, c.lifetime_used, c.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  if not found then
    raise exception 'key was not consumed';
  end if;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

revoke execute on function public.consume_market_save_atomic(uuid, text) from anon, authenticated, public;
grant execute on function public.consume_market_save_atomic(uuid, text) to service_role;

revoke truncate, references, trigger on public.shopper_market_unlocks from authenticated;
