-- Stamp Analytics key fields on spend/refund writes.
-- AutoAgent prod already has key_kind / vdp_match_id / refund_reason
-- (drevvy_key_pack_prices + drevvy_keys_network_otd). This migration is
-- idempotent: add the columns if missing, then replace the RPCs so every
-- spend/refund insert stamps them. Do not recreate Analytics triggers.

alter table public.shopper_credit_events
  add column if not exists spend_kind text;

alter table public.shopper_credit_events
  add column if not exists listing_id text;

alter table public.shopper_credit_events
  add column if not exists pack_price_cents integer;

alter table public.shopper_credit_events
  add column if not exists key_kind text;

alter table public.shopper_credit_events
  add column if not exists vdp_match_id uuid;

alter table public.shopper_credit_events
  add column if not exists refund_reason text;

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

  if not exists (
    select 1 from pg_constraint
    where conname = 'shopper_credit_events_key_kind_check'
  ) then
    alter table public.shopper_credit_events
      add constraint shopper_credit_events_key_kind_check
      check (key_kind is null or key_kind in ('market_intel', 'conversation'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'shopper_credit_events_refund_reason_check'
  ) then
    alter table public.shopper_credit_events
      add constraint shopper_credit_events_refund_reason_check
      check (refund_reason is null or refund_reason in (
        'no_reply_7d', 'sold', 'dealer_declined', 'dealer_opted_out', 'admin'
      ));
  end if;
end $$;

comment on column public.shopper_credit_events.key_kind is
  'Analytics key type. market_intel is never refunded. conversation starts the 7-day clock and $300 close-fee path.';

comment on column public.shopper_credit_events.vdp_match_id is
  'drevvy_vdp_matches.id for an in-network conversation spend. Required by private.drevvy_conversation_key_guard.';

comment on column public.shopper_credit_events.refund_reason is
  'Why the conversation key was returned: no_reply_7d, sold, dealer_declined, dealer_opted_out, or admin.';

drop function if exists public.consume_credit_atomic(uuid, uuid);
drop function if exists public.consume_credit_atomic(uuid, uuid, uuid);

create function public.consume_credit_atomic(
  p_user_id uuid,
  p_deal_id uuid,
  p_vdp_match_id uuid default null
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
      user_id, event_type, amount, deal_id, spend_kind, key_kind, vdp_match_id, idempotency_key
    )
    values (
      p_user_id, 'use', 1, p_deal_id, 'dealer_conversation', 'conversation', p_vdp_match_id, v_key
    );
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
      user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key
    )
    values (p_user_id, 'use', 1, p_listing_id, 'market_save', 'market_intel', v_key);
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

drop function if exists public.refund_credit_atomic(uuid, uuid, text);
drop function if exists public.refund_credit_atomic(uuid, uuid, text, text);

create function public.refund_credit_atomic(
  p_user_id uuid,
  p_deal_id uuid,
  p_idempotency_key text,
  p_refund_reason text default null
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
  v_reason text;
begin
  if p_refund_reason is not null
     and p_refund_reason not in ('no_reply_7d', 'sold', 'dealer_declined', 'dealer_opted_out', 'admin') then
    raise exception 'invalid refund reason';
  end if;
  v_reason := p_refund_reason;

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
    insert into public.shopper_credit_events (
      user_id, event_type, amount, deal_id, spend_kind, key_kind, refund_reason, idempotency_key
    )
    values (
      p_user_id, 'refund', 1, p_deal_id, 'dealer_conversation', 'conversation', v_reason, p_idempotency_key
    );
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

revoke execute on function public.consume_credit_atomic(uuid, uuid, uuid) from anon, authenticated, public;
grant execute on function public.consume_credit_atomic(uuid, uuid, uuid) to service_role;

revoke execute on function public.consume_market_save_atomic(uuid, text) from anon, authenticated, public;
grant execute on function public.consume_market_save_atomic(uuid, text) to service_role;

revoke execute on function public.refund_credit_atomic(uuid, uuid, text, text) from anon, authenticated, public;
grant execute on function public.refund_credit_atomic(uuid, uuid, text, text) to service_role;
