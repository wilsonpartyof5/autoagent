-- First shopper begin grants STARTER_FREE_KEYS (3) into the same shopper_credits
-- balance that market_save spends. The credit event is starter_grant, not purchase,
-- and lifetime_purchased is left unchanged. The idempotency key is one per user,
-- so a later sign-in cannot grant again. Pack prices are not changed.
-- Amount matches STARTER_FREE_KEYS in apps/drevvy-backend/src/lib/shopper/credits.ts.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.shopper_credit_events'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%'
      and pg_get_constraintdef(c.oid) like '%purchase%'
  loop
    execute format('alter table public.shopper_credit_events drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.shopper_credit_events
  drop constraint if exists shopper_credit_events_event_type_check;

alter table public.shopper_credit_events
  add constraint shopper_credit_events_event_type_check
  check (event_type in ('purchase', 'use', 'refund', 'starter_grant'));

create or replace function public.grant_starter_keys_atomic(p_user_id uuid)
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
  v_amount integer := 3;
  v_key text := 'starter_grant';
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
begin
  if p_user_id is null then
    raise exception 'user id is required';
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
    where e.user_id = p_user_id and e.idempotency_key = v_key
  ) then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, idempotency_key
    )
    values (p_user_id, 'starter_grant', v_amount, v_key);
  exception when unique_violation then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  update public.shopper_credits
  set balance = shopper_credits.balance + v_amount,
      updated_at = now()
  where user_id = p_user_id
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$$;

-- Creates the consumer profile on first begin and grants starter keys in the
-- same transaction. An existing profile, including a disabled one, is returned
-- unchanged and does not receive another grant.
create or replace function public.ensure_consumer_profile(p_user_id uuid)
returns table(
  status text,
  starter_granted boolean,
  balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted uuid;
  v_status text;
  v_granted boolean;
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'user id is required';
  end if;

  v_inserted := null;
  insert into public.consumer_profiles (user_id, status)
  values (p_user_id, 'active')
  on conflict (user_id) do nothing
  returning consumer_profiles.user_id into v_inserted;

  if v_inserted is null then
    select cp.status into v_status
    from public.consumer_profiles cp
    where cp.user_id = p_user_id;

    select c.balance into v_balance
    from public.shopper_credits c
    where c.user_id = p_user_id;

    return query select v_status, false, coalesce(v_balance, 0);
    return;
  end if;

  insert into public.consumer_profile_status_events (user_id, status)
  values (p_user_id, 'active');

  select g.granted, g.balance
    into v_granted, v_balance
  from public.grant_starter_keys_atomic(p_user_id) g;

  return query select 'active'::text, coalesce(v_granted, false), coalesce(v_balance, 0);
end;
$$;

revoke execute on function public.grant_starter_keys_atomic(uuid) from anon, authenticated, public;
grant execute on function public.grant_starter_keys_atomic(uuid) to service_role;

revoke execute on function public.ensure_consumer_profile(uuid) from anon, authenticated, public;
grant execute on function public.ensure_consumer_profile(uuid) to service_role;
