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
