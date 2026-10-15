-- Shopper push triggers: price-drop preference, last listing price, and last offer.
-- Price-drop pushes are on by default. A missing row means on.
-- Delivery still uses public.device_tokens. FCM stays a no-op until its env is set.
-- Dealer name, phone, and email are not columns.
--
-- NOT APPLIED. Do not run this against production from the push-trigger change.
-- Leave SHOPPER_PUSH_STORE unset until this file is applied. supabase reads these
-- tables; any other value keeps an in-memory ledger.

create table if not exists public.shopper_push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  price_drops boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.shopper_price_watches (
  deal_id uuid primary key references public.shopper_deals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  price integer not null check (price >= 0 and price <= 10000000),
  observed_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists shopper_price_watches_user
  on public.shopper_price_watches (user_id);

create table if not exists public.shopper_offer_notices (
  deal_id uuid primary key references public.shopper_deals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  amount integer not null check (amount >= 0 and amount <= 10000000),
  notified_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists shopper_offer_notices_user
  on public.shopper_offer_notices (user_id);

alter table public.shopper_push_preferences enable row level security;
alter table public.shopper_push_preferences force row level security;
alter table public.shopper_price_watches enable row level security;
alter table public.shopper_price_watches force row level security;
alter table public.shopper_offer_notices enable row level security;
alter table public.shopper_offer_notices force row level security;

drop policy if exists "Shoppers read own push preferences" on public.shopper_push_preferences;
create policy "Shoppers read own push preferences"
  on public.shopper_push_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Shoppers insert own push preferences" on public.shopper_push_preferences;
create policy "Shoppers insert own push preferences"
  on public.shopper_push_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Shoppers update own push preferences" on public.shopper_push_preferences;
create policy "Shoppers update own push preferences"
  on public.shopper_push_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.shopper_push_preferences from public, anon;
revoke all on public.shopper_price_watches from public, anon, authenticated;
revoke all on public.shopper_offer_notices from public, anon, authenticated;

grant select, insert, update on public.shopper_push_preferences to authenticated;
grant select, insert, update, delete on public.shopper_push_preferences to service_role;
grant select, insert, update, delete on public.shopper_price_watches to service_role;
grant select, insert, update, delete on public.shopper_offer_notices to service_role;
