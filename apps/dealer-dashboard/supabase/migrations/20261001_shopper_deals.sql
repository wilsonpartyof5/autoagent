-- Shopper deals for a MarketCheck listing.
-- Owned by the shopper auth user (the same id Sign in with Apple stores on
-- consumer_profiles). This migration does not create that profile table and
-- does not reference onboarded-dealer inventory, rooftop tables, leads, or the old case schema.
-- Outreach stays locked until a later payment migration removes the check.

create table if not exists public.shopper_deals (
  id uuid primary key default gen_random_uuid(),
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null check (listing_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  status text not null default 'interested' check (status in ('interested', 'negotiating', 'accepted', 'closed')),
  outreach_locked_until_paid boolean not null default true check (outreach_locked_until_paid),
  vehicle_snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint shopper_deals_snapshot_is_object check (jsonb_typeof(vehicle_snapshot) = 'object'),
  constraint shopper_deals_snapshot_has_vehicle check (
    vehicle_snapshot ? 'year'
    and vehicle_snapshot ? 'make'
    and vehicle_snapshot ? 'model'
    and vehicle_snapshot ? 'price'
  ),
  constraint shopper_deals_snapshot_has_no_dealer_identity check (
    not (vehicle_snapshot ?| array[
      'dealerName',
      'dealer_name',
      'dealerPhone',
      'dealer_phone',
      'phone',
      'email',
      'website',
      'dealerWebsite',
      'dealer_website',
      'dealerAddress',
      'dealer_address',
      'street',
      'address',
      'salesperson',
      'salesStaff',
      'sales_staff',
      'dealerId',
      'dealer_id',
      'dealerHours',
      'dealer_hours',
      'dealer',
      'seller'
    ])
  )
);

create unique index if not exists shopper_deals_one_open_listing
  on public.shopper_deals (consumer_user_id, listing_id)
  where status in ('interested', 'negotiating');

create index if not exists shopper_deals_consumer_created
  on public.shopper_deals (consumer_user_id, created_at desc);

create or replace function private.protect_shopper_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.consumer_user_id is distinct from old.consumer_user_id
     or new.listing_id is distinct from old.listing_id
     or new.vehicle_snapshot is distinct from old.vehicle_snapshot
     or new.created_at is distinct from old.created_at
     or new.outreach_locked_until_paid is distinct from true
  then
    raise exception 'shopper deal identity is immutable';
  end if;

  if new.status is distinct from old.status
     and not (
       (old.status = 'interested' and new.status in ('negotiating', 'closed'))
       or (old.status = 'negotiating' and new.status in ('accepted', 'closed'))
       or (old.status = 'accepted' and new.status = 'closed')
     )
  then
    raise exception 'shopper deal status cannot move backward';
  end if;

  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

revoke all on function private.protect_shopper_deal() from public, anon, authenticated;

drop trigger if exists shopper_deals_protect on public.shopper_deals;
create trigger shopper_deals_protect
  before update on public.shopper_deals
  for each row
  execute function private.protect_shopper_deal();

alter table public.shopper_deals enable row level security;

drop policy if exists "Shoppers read own deals" on public.shopper_deals;
create policy "Shoppers read own deals"
  on public.shopper_deals
  for select
  to authenticated
  using ((select auth.uid()) = consumer_user_id);

revoke all on public.shopper_deals from anon;
revoke insert, update, delete on public.shopper_deals from authenticated;
grant select on public.shopper_deals to authenticated;
