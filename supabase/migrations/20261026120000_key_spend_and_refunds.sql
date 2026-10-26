-- Shopper currency is keys. Two spends, one refundable.
-- market_save: use:market_save:<listing id>. Never refunded.
-- dealer_conversation: use:dealer_conversation:<deal id>.
-- A legacy use:<deal id> row is the dealer-conversation spend from before this split.
-- Refunds use refund:<deal id> and return that one key only.
-- Pack prices are stored in pack_price_cents. The purchase RPC integer is US cents.

alter table public.shopper_credit_events
  add column if not exists spend_kind text;

alter table public.shopper_credit_events
  add column if not exists listing_id text;

alter table public.shopper_credit_events
  add column if not exists pack_price_cents integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shopper_credit_events_spend_kind_check'
  ) then
    alter table public.shopper_credit_events
      add constraint shopper_credit_events_spend_kind_check
      check (spend_kind is null or spend_kind in ('market_save', 'dealer_conversation'));
  end if;
end $$;

comment on column public.shopper_credit_events.spend_kind is
  'market_save is never refunded. dealer_conversation is the only refundable key.';

comment on column public.shopper_credit_events.pack_price_cents is
  'US cents for a key pack. Null on rows written before key packs, which kept whole dollars in pack_price_usd.';

-- p_pack_price_usd is US cents. New rows leave pack_price_usd null so a legacy $35
-- is not read as 35 cents.
create or replace function public.purchase_credits_atomic(
  p_user_id uuid,
  p_pack_size integer,
  p_pack_price_usd integer,
  p_idempotency_key text,
  p_reversal_key text
)
returns table(
  granted boolean,
  already_granted boolean,
  balance integer,
  lifetime_purchased integer,
  lifetime_used integer,
  lifetime_refunded integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
begin
  if p_pack_size is null or p_pack_size <= 0 then
    raise exception 'pack size must be positive';
  end if;
  if p_pack_price_usd is null or p_pack_price_usd <= 0 then
    raise exception 'pack price must be positive';
  end if;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance, c.lifetime_purchased, c.lifetime_used, c.lifetime_refunded
    into v_balance, v_purchased, v_used, v_refunded
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = p_idempotency_key
  ) then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = p_reversal_key
  ) then
    return query select false, false, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, pack_size, pack_price_usd, pack_price_cents, idempotency_key
    )
    values (
      p_user_id, 'purchase', p_pack_size, p_pack_size, null, p_pack_price_usd, p_idempotency_key
    );
  exception when unique_violation then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  update public.shopper_credits
  set balance = shopper_credits.balance + p_pack_size,
      lifetime_purchased = shopper_credits.lifetime_purchased + p_pack_size,
      updated_at = now()
  where user_id = p_user_id
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

create or replace function public.consume_credit_atomic(
  p_user_id uuid,
  p_deal_id uuid
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
set search_path = public
as $$
declare
  v_key text;
  v_legacy text;
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
begin
  if p_deal_id is null then
    raise exception 'deal id is required';
  end if;

  v_key := 'use:dealer_conversation:' || p_deal_id::text;
  v_legacy := 'use:' || p_deal_id::text;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance, c.lifetime_purchased, c.lifetime_used, c.lifetime_refunded
    into v_balance, v_purchased, v_used, v_refunded
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id
      and e.event_type = 'use'
      and (e.idempotency_key = v_key or e.idempotency_key = v_legacy)
  ) then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  if coalesce(v_balance, 0) <= 0 then
    return query select false, false, coalesce(v_balance, 0), coalesce(v_purchased, 0), coalesce(v_used, 0), coalesce(v_refunded, 0);
    return;
  end if;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, deal_id, spend_kind, idempotency_key
    )
    values (p_user_id, 'use', 1, p_deal_id, 'dealer_conversation', v_key);
  exception when unique_violation then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  update public.shopper_credits
  set balance = shopper_credits.balance - 1,
      lifetime_used = shopper_credits.lifetime_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and shopper_credits.balance >= 1
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  if not found then
    raise exception 'key was not consumed';
  end if;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

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
set search_path = public
as $$
declare
  v_key text;
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
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

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = v_key
  ) then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  if coalesce(v_balance, 0) <= 0 then
    return query select false, false, coalesce(v_balance, 0), coalesce(v_purchased, 0), coalesce(v_used, 0), coalesce(v_refunded, 0);
    return;
  end if;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, listing_id, spend_kind, idempotency_key
    )
    values (p_user_id, 'use', 1, p_listing_id, 'market_save', v_key);
  exception when unique_violation then
    return query select true, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  update public.shopper_credits
  set balance = shopper_credits.balance - 1,
      lifetime_used = shopper_credits.lifetime_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and shopper_credits.balance >= 1
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  if not found then
    raise exception 'key was not consumed';
  end if;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

-- Returns the dealer-conversation key only. market_save rows are ignored.
-- refund:<deal id> makes a second call a no-op.
create or replace function public.refund_credit_atomic(
  p_user_id uuid,
  p_deal_id uuid,
  p_idempotency_key text
)
returns table(refunded boolean, already_refunded boolean, new_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_refund_id uuid;
  v_use_event_id uuid;
  v_new_balance integer;
begin
  select id into v_existing_refund_id
  from public.shopper_credit_events
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  limit 1;

  if v_existing_refund_id is not null then
    select balance into v_new_balance from public.shopper_credits where user_id = p_user_id;
    return query select false, true, coalesce(v_new_balance, 0);
    return;
  end if;

  select id into v_use_event_id
  from public.shopper_credit_events
  where user_id = p_user_id
    and event_type = 'use'
    and deal_id = p_deal_id
    and (
      idempotency_key = 'use:dealer_conversation:' || p_deal_id::text
      or (
        idempotency_key = 'use:' || p_deal_id::text
        and coalesce(spend_kind, 'dealer_conversation') = 'dealer_conversation'
      )
    )
  limit 1;

  if v_use_event_id is null then
    select balance into v_new_balance from public.shopper_credits where user_id = p_user_id;
    return query select false, false, coalesce(v_new_balance, 0);
    return;
  end if;

  begin
    insert into public.shopper_credit_events (user_id, event_type, amount, deal_id, idempotency_key)
    values (p_user_id, 'refund', 1, p_deal_id, p_idempotency_key);
  exception when unique_violation then
    select balance into v_new_balance from public.shopper_credits where user_id = p_user_id;
    return query select false, true, coalesce(v_new_balance, 0);
    return;
  end;

  update public.shopper_credits
  set balance = shopper_credits.balance + 1,
      lifetime_refunded = shopper_credits.lifetime_refunded + 1,
      updated_at = now()
  where user_id = p_user_id
  returning shopper_credits.balance into v_new_balance;

  return query select true, false, coalesce(v_new_balance, 0);
end;
$$;

revoke execute on function public.purchase_credits_atomic(uuid, integer, integer, text, text) from anon, authenticated, public;
grant execute on function public.purchase_credits_atomic(uuid, integer, integer, text, text) to service_role;

revoke execute on function public.consume_credit_atomic(uuid, uuid) from anon, authenticated, public;
grant execute on function public.consume_credit_atomic(uuid, uuid) to service_role;

revoke execute on function public.consume_market_save_atomic(uuid, text) from anon, authenticated, public;
grant execute on function public.consume_market_save_atomic(uuid, text) to service_role;

revoke execute on function public.refund_credit_atomic(uuid, uuid, text) from anon, authenticated, public;
grant execute on function public.refund_credit_atomic(uuid, uuid, text) to service_role;
