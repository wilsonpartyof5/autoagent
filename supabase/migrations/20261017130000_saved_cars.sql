-- Saved cars for a shopper.
-- Columns are the listing id, VIN, when it was saved, and an optional deal.
-- MarketCheck price, photos, dealer, and specs are not columns. Those details
-- are fetched live when the shopper opens the list.
--
-- NOT APPLIED. Do not run this against production from the saved-cars change.

create table if not exists public.saved_cars (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null check (listing_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$'),
  saved_at timestamptz not null default timezone('utc'::text, now()),
  moved_to_deal_id uuid references public.shopper_deals(id) on delete set null,
  primary key (user_id, listing_id)
);

comment on table public.saved_cars is
  'Shopper bookmarks. Listing id and VIN only. Live MarketCheck details are not stored.';

create index if not exists saved_cars_user_saved_at
  on public.saved_cars (user_id, saved_at desc);

create index if not exists saved_cars_moved_to_deal
  on public.saved_cars (moved_to_deal_id);

alter table public.saved_cars enable row level security;

drop policy if exists "Shoppers read own saved cars" on public.saved_cars;
create policy "Shoppers read own saved cars"
  on public.saved_cars
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Shoppers insert own saved cars" on public.saved_cars;
create policy "Shoppers insert own saved cars"
  on public.saved_cars
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      moved_to_deal_id is null
      or exists (
        select 1
        from public.shopper_deals as deals
        where deals.id = moved_to_deal_id
          and deals.consumer_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Shoppers update own saved cars" on public.saved_cars;
create policy "Shoppers update own saved cars"
  on public.saved_cars
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      moved_to_deal_id is null
      or exists (
        select 1
        from public.shopper_deals as deals
        where deals.id = moved_to_deal_id
          and deals.consumer_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Shoppers delete own saved cars" on public.saved_cars;
create policy "Shoppers delete own saved cars"
  on public.saved_cars
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.saved_cars from public, anon;
grant select, insert, update, delete on public.saved_cars to authenticated;
grant select, insert, update, delete on public.saved_cars to service_role;
