-- Caps paid MarketCheck work that a refunded market-save would otherwise repeat.
-- Runs after 20261120180000, which created the unlock table and the first
-- refund function. This replaces that refund: the spend row stays, and a
-- refund row is the reversal. The active idempotency key is renamed so the
-- next real value is charged again.
--
-- claim_market_save_lookup is required before a paid lookup. When it is
-- missing, production code does not call MarketCheck Price.

create table if not exists public.market_intel_listing_misses (
  listing_id text primary key check (listing_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  recorded_at timestamptz not null default pg_catalog.now()
);

comment on table public.market_intel_listing_misses is
  'Listing ids whose market lookup had no value. The id and a timestamp only. No VIN, price, or listing body.';

alter table public.market_intel_listing_misses enable row level security;
alter table public.market_intel_listing_misses force row level security;
revoke all on public.market_intel_listing_misses from anon, authenticated, public;
grant select, insert, update, delete on public.market_intel_listing_misses to service_role;

create table if not exists public.shopper_market_lookup_hits (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.now()
);

comment on table public.shopper_market_lookup_hits is
  'Recent market-save claims. ip_hash is a sha256 of the client IP. The raw IP is not stored.';

create index if not exists shopper_market_lookup_hits_user_time
  on public.shopper_market_lookup_hits (user_id, created_at desc);
create index if not exists shopper_market_lookup_hits_ip_time
  on public.shopper_market_lookup_hits (ip_hash, created_at desc);

alter table public.shopper_market_lookup_hits enable row level security;
alter table public.shopper_market_lookup_hits force row level security;
revoke all on public.shopper_market_lookup_hits from anon, authenticated, public;
grant select, insert, update, delete on public.shopper_market_lookup_hits to service_role;

-- 10 claims per user and 30 per IP hash in 10 minutes.
-- 5 market_save refunds per user in 24 hours.
-- A fresh miss blocks another paid call for that listing for 24 hours.
-- hold is true when the active market_save spend for this listing is still open.
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
  v_hold boolean;
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

  if exists (
    select 1
    from public.market_intel_listing_misses as m
    where m.listing_id = p_listing_id
      and m.recorded_at > pg_catalog.now() - interval '24 hours'
  ) then
    select exists (
      select 1
      from public.shopper_credit_events as e
      where e.user_id = p_user_id
        and e.idempotency_key = 'use:market_save:' || p_listing_id
        and e.event_type = 'use'
        and e.spend_kind = 'market_save'
    ) into v_hold;
    return query select 'cached_miss'::text, null::text, coalesce(v_hold, false);
    return;
  end if;

  select count(*)::integer
    into v_refunds
  from public.shopper_credit_events as e
  where e.user_id = p_user_id
    and e.event_type = 'refund'
    and e.spend_kind = 'market_save'
    and e.created_at > pg_catalog.now() - interval '24 hours';

  select exists (
    select 1
    from public.shopper_credit_events as e
    where e.user_id = p_user_id
      and e.idempotency_key = 'use:market_save:' || p_listing_id
      and e.event_type = 'use'
      and e.spend_kind = 'market_save'
  ) into v_hold;

  if coalesce(v_refunds, 0) >= 5 and coalesce(v_hold, false) = false then
    return query select 'refund_cap'::text, null::text, false;
    return;
  end if;

  if coalesce(v_refunds, 0) >= 5 then
    return query select 'refund_cap'::text, null::text, true;
    return;
  end if;

  return query select 'proceed'::text, null::text, coalesce(v_hold, false);
end;
$$;

revoke execute on function public.claim_market_save_lookup(uuid, text, text) from anon, authenticated, public;
grant execute on function public.claim_market_save_lookup(uuid, text, text) to service_role;

create or replace function public.remember_market_listing_miss(p_listing_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_listing_id is null or p_listing_id !~ '^[A-Za-z0-9_-]{4,64}$' then
    return;
  end if;
  insert into public.market_intel_listing_misses (listing_id, recorded_at)
  values (p_listing_id, pg_catalog.now())
  on conflict (listing_id) do update
    set recorded_at = excluded.recorded_at;
end;
$$;

revoke execute on function public.remember_market_listing_miss(text) from anon, authenticated, public;
grant execute on function public.remember_market_listing_miss(text) to service_role;

-- Returns the key and keeps both ledger rows. The spend event's idempotency
-- key is archived so consume_market_save_atomic can charge the next attempt.
-- A stored unlock is left alone.
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
  v_key text;
  v_balance integer;
  v_event_id uuid;
begin
  if p_listing_id is null or p_listing_id !~ '^[A-Za-z0-9_-]{4,64}$' then
    raise exception 'listing id is required';
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

  if exists (
    select 1 from public.shopper_market_unlocks u
    where u.user_id = p_user_id and u.listing_id = p_listing_id
  ) then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  v_event_id := null;
  update public.shopper_credit_events as e
  set idempotency_key = 'use:market_save:' || p_listing_id || ':reversed:' || e.id::text
  where e.user_id = p_user_id
    and e.idempotency_key = v_key
    and e.event_type = 'use'
    and e.spend_kind = 'market_save'
  returning e.id into v_event_id;

  if v_event_id is null then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into public.shopper_credit_events (
    user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key
  )
  values (
    p_user_id,
    'refund',
    1,
    p_listing_id,
    'market_save',
    'market_intel',
    'refund:market_save:' || p_listing_id || ':' || v_event_id::text
  );

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
