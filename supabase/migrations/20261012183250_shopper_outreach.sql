-- Future outreach storage for shopper deals.
-- Not applied by the admin console. The console reads mock fixtures until this
-- is applied on purpose. Dealer name, phone, and email live here for operators
-- only. Shopper routes must not select those columns.
-- Depends on public.shopper_deals from 20261001_shopper_deals.sql.

create table if not exists public.shopper_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  shopper_deal_id uuid not null references public.shopper_deals(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email', 'voice')),
  direction text not null check (direction in ('outbound', 'inbound')),
  dealer_name text,
  dealer_phone text,
  dealer_email text,
  body text not null,
  occurred_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists shopper_outreach_messages_deal_time
  on public.shopper_outreach_messages (shopper_deal_id, occurred_at desc);

create table if not exists public.shopper_offers (
  id uuid primary key default gen_random_uuid(),
  shopper_deal_id uuid not null references public.shopper_deals(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  dealer_name text,
  vehicle_price numeric,
  otd numeric,
  occurred_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists shopper_offers_deal_time
  on public.shopper_offers (shopper_deal_id, occurred_at desc);

create table if not exists public.shopper_deal_events (
  id uuid primary key default gen_random_uuid(),
  shopper_deal_id uuid not null references public.shopper_deals(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  dealer_name text,
  detail text,
  occurred_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists shopper_deal_events_deal_time
  on public.shopper_deal_events (shopper_deal_id, occurred_at desc);

alter table public.shopper_outreach_messages enable row level security;
alter table public.shopper_offers enable row level security;
alter table public.shopper_deal_events enable row level security;

revoke all on public.shopper_outreach_messages from anon, authenticated;
revoke all on public.shopper_offers from anon, authenticated;
revoke all on public.shopper_deal_events from anon, authenticated;
