-- Shopper car credits system. Replaces monthly quota with one-time car packs.
-- Car packs (3/$47, 5/$67, 10/$97) never expire and never reset monthly.
-- Credits are refunded on: sold, ended_no_response, dealer_declined.
-- The credit_events table ensures idempotent refunds (exactly once per deal).

create table if not exists public.shopper_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_purchased integer not null default 0,
  lifetime_used integer not null default 0,
  lifetime_refunded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopper_credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('purchase', 'use', 'refund')),
  amount integer not null check (amount > 0),
  deal_id uuid,
  pack_size integer,
  pack_price_usd integer,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists shopper_credit_events_user_time
  on public.shopper_credit_events (user_id, created_at desc);

create index if not exists shopper_credit_events_deal
  on public.shopper_credit_events (deal_id) where deal_id is not null;

alter table public.shopper_credits enable row level security;
alter table public.shopper_credits force row level security;
alter table public.shopper_credit_events enable row level security;
alter table public.shopper_credit_events force row level security;

drop policy if exists "Shoppers read own credits" on public.shopper_credits;
create policy "Shoppers read own credits"
  on public.shopper_credits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Shoppers read own credit events" on public.shopper_credit_events;
create policy "Shoppers read own credit events"
  on public.shopper_credit_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.shopper_credits from anon, public;
revoke insert, update, delete on public.shopper_credits from authenticated;
grant select on public.shopper_credits to authenticated;
grant select, insert, update, delete on public.shopper_credits to service_role;

revoke all on public.shopper_credit_events from anon, public;
revoke insert, update, delete on public.shopper_credit_events from authenticated;
grant select on public.shopper_credit_events to authenticated;
grant select, insert, update, delete on public.shopper_credit_events to service_role;

-- Atomic credit refund: inserts event and updates balance in one transaction.
-- Returns: refunded (true if credit was added), already_refunded (true if idempotency key existed).
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
  -- Check for existing refund (idempotent)
  select id into v_existing_refund_id
  from public.shopper_credit_events
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  limit 1;

  if v_existing_refund_id is not null then
    select balance into v_new_balance from public.shopper_credits where user_id = p_user_id;
    return query select false, true, coalesce(v_new_balance, 0);
    return;
  end if;

  -- Check that a use event exists for this deal
  select id into v_use_event_id
  from public.shopper_credit_events
  where user_id = p_user_id and idempotency_key = 'use:' || p_deal_id::text
  limit 1;

  if v_use_event_id is null then
    select balance into v_new_balance from public.shopper_credits where user_id = p_user_id;
    return query select false, false, coalesce(v_new_balance, 0);
    return;
  end if;

  -- Insert refund event (unique constraint provides additional idempotency)
  begin
    insert into public.shopper_credit_events (user_id, event_type, amount, deal_id, idempotency_key)
    values (p_user_id, 'refund', 1, p_deal_id, p_idempotency_key);
  exception when unique_violation then
    select balance into v_new_balance from public.shopper_credits where user_id = p_user_id;
    return query select false, true, coalesce(v_new_balance, 0);
    return;
  end;

  -- Atomic balance update with returning
  update public.shopper_credits
  set balance = balance + 1,
      lifetime_refunded = lifetime_refunded + 1,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_new_balance;

  return query select true, false, coalesce(v_new_balance, 0);
end;
$$;

revoke execute on function public.refund_credit_atomic(uuid, uuid, text) from anon, authenticated, public;
grant execute on function public.refund_credit_atomic(uuid, uuid, text) to service_role;
