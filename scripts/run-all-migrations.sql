-- Consolidated Migration Script for Rock Hill GMC Onboarding
-- Run this in Supabase SQL Editor

-- Step 1: Create profiles table (if not exists)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean default false,
  inventory_connected boolean default false,
  billing_active boolean default false,
  dms_provider text,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  lead_delivery_method text,
  lead_delivery_endpoint text,
  lead_delivery_email text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Step 2: Add marketcheck columns to profiles (if not exists)
alter table profiles
  add column if not exists marketcheck_dealer_id text,
  add column if not exists marketcheck_zip text;

-- Step 2b: Add lead delivery columns to profiles (if not exists)
alter table profiles
  add column if not exists lead_delivery_method text,
  add column if not exists lead_delivery_endpoint text,
  add column if not exists lead_delivery_email text;

-- Step 2c: Create demo requests table for marketing forms
create table if not exists demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  dealership text,
  role text,
  interest text,
  message text,
  source text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table demo_requests enable row level security;

-- Step 3: Create inventory_vehicles table (if not exists)
create table if not exists inventory_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  vin text,
  year integer,
  make text,
  model text,
  trim text,
  price numeric,
  mileage numeric,
  photo_url text,
  dealer_name text,
  dealer_address text,
  raw jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Step 4: Expand inventory_vehicles with full schema
-- Note: These ALTER statements handle cases where table might have old column names
do $$ 
begin
  -- Rename mileage to miles if mileage exists
  if exists (select 1 from information_schema.columns 
             where table_schema = 'public' 
             and table_name = 'inventory_vehicles' 
             and column_name = 'mileage') then
    alter table inventory_vehicles rename column mileage to miles;
  end if;
  
  -- Rename photo_url to primary_photo_url if photo_url exists and primary_photo_url doesn't
  if exists (select 1 from information_schema.columns 
             where table_schema = 'public' 
             and table_name = 'inventory_vehicles' 
             and column_name = 'photo_url')
     and not exists (select 1 from information_schema.columns 
                     where table_schema = 'public' 
                     and table_name = 'inventory_vehicles' 
                     and column_name = 'primary_photo_url') then
    alter table inventory_vehicles rename column photo_url to primary_photo_url;
  end if;
end $$;

alter table inventory_vehicles
  add column if not exists vin text,
  add column if not exists stock_number text,
  add column if not exists listing_id text,
  add column if not exists trim text,
  add column if not exists condition text,
  add column if not exists body_type text,
  add column if not exists drivetrain text,
  add column if not exists fuel_type text,
  add column if not exists transmission text,
  add column if not exists msrp numeric,
  add column if not exists price_change_history jsonb,
  add column if not exists dealer_city text,
  add column if not exists dealer_state text,
  add column if not exists dealer_lat numeric,
  add column if not exists dealer_lng numeric,
  add column if not exists dealer_phone text,
  add column if not exists dealer_website text,
  add column if not exists dealer_id text,
  add column if not exists photo_urls text[],
  add column if not exists thumbnail_url text,
  add column if not exists video_url text,
  add column if not exists features text[],
  add column if not exists interior_color text,
  add column if not exists exterior_color text,
  add column if not exists certified boolean default false,
  add column if not exists market_average_price numeric,
  add column if not exists days_on_market integer,
  add column if not exists source text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_status text default 'pending',
  add column if not exists data_source text default 'marketcheck-api',
  add column if not exists lead_status text default 'none',
  add column if not exists last_lead_at timestamptz,
  add column if not exists lead_id text,
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

-- Step 5: Add live/published status fields
alter table inventory_vehicles
  add column if not exists is_live boolean default false,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id);

-- Step 6: Create indexes
create index if not exists idx_inventory_vehicles_user_id on inventory_vehicles(user_id);
create index if not exists idx_inventory_vehicles_vin on inventory_vehicles(vin);
create index if not exists idx_inventory_vehicles_listing_id on inventory_vehicles(listing_id);
create index if not exists idx_inventory_vehicles_is_live on inventory_vehicles(user_id, is_live) where is_live = true;
create index if not exists idx_inventory_vehicles_stock_number on inventory_vehicles(stock_number);
create index if not exists idx_inventory_vehicles_dealer_id on inventory_vehicles(dealer_id);

-- Step 6: Enable RLS (if not already enabled)
alter table profiles enable row level security;
alter table inventory_vehicles enable row level security;

-- Step 7: Create RLS policies for profiles
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Step 8: Create RLS policies for inventory_vehicles (legacy - will be replaced by dealership policies)
drop policy if exists "Users can view own inventory" on inventory_vehicles;
create policy "Users can view own inventory"
  on inventory_vehicles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own inventory" on inventory_vehicles;
create policy "Users can insert own inventory"
  on inventory_vehicles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own inventory" on inventory_vehicles;
create policy "Users can delete own inventory"
  on inventory_vehicles for delete
  using (auth.uid() = user_id);

-- Step 9: Create dealerships table for multi-store support
-- Run migrations from: 20250223_create_dealerships.sql
create table if not exists dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  logo_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Create junction table for user-dealership relationships
create table if not exists user_dealerships (
  user_id uuid references auth.users(id) on delete cascade,
  dealership_id uuid references dealerships(id) on delete cascade,
  role text default 'owner',
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, dealership_id)
);

-- Create user preferences table for storing active dealership
create table if not exists user_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  active_dealership_id uuid references dealerships(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Create indexes for dealerships
create index if not exists idx_user_dealerships_user_id on user_dealerships(user_id);
create index if not exists idx_user_dealerships_dealership_id on user_dealerships(dealership_id);
create index if not exists idx_dealerships_marketcheck_dealer_id on dealerships(marketcheck_dealer_id);
create index if not exists idx_user_preferences_user_id on user_preferences(user_id);
create index if not exists idx_user_preferences_active_dealership_id on user_preferences(active_dealership_id);

-- Enable RLS for dealerships
alter table dealerships enable row level security;
alter table user_dealerships enable row level security;
alter table user_preferences enable row level security;

-- RLS Policies for dealerships
drop policy if exists "Users can view their dealerships" on dealerships;
create policy "Users can view their dealerships"
  on dealerships for select
  using (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = dealerships.id
        and user_dealerships.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their dealerships" on dealerships;
create policy "Users can update their dealerships"
  on dealerships for update
  using (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = dealerships.id
        and user_dealerships.user_id = auth.uid()
        and user_dealerships.role = 'owner'
    )
  );

drop policy if exists "Users can insert dealerships" on dealerships;
create policy "Users can insert dealerships"
  on dealerships for insert
  with check (true);

-- RLS Policies for user_dealerships
drop policy if exists "Users can view their memberships" on user_dealerships;
create policy "Users can view their memberships"
  on user_dealerships for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their memberships" on user_dealerships;
create policy "Users can insert their memberships"
  on user_dealerships for insert
  with check (auth.uid() = user_id);

-- RLS Policies for user_preferences
drop policy if exists "Users can view their preferences" on user_preferences;
create policy "Users can view their preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their preferences" on user_preferences;
create policy "Users can update their preferences"
  on user_preferences for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their preferences" on user_preferences;
create policy "Users can insert their preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

-- Step 10: Add dealership_id to inventory_vehicles
alter table inventory_vehicles
  add column if not exists dealership_id uuid references dealerships(id) on delete cascade;

create index if not exists idx_inventory_vehicles_dealership_id on inventory_vehicles(dealership_id);

-- Step 11: Update RLS policies for inventory_vehicles to use dealership_id
-- Drop old user_id-based policies
drop policy if exists "Users can view own inventory" on inventory_vehicles;
drop policy if exists "Users can insert own inventory" on inventory_vehicles;
drop policy if exists "Users can delete own inventory" on inventory_vehicles;
drop policy if exists "Users can update own inventory" on inventory_vehicles;
drop policy if exists "Users can view dealership inventory" on inventory_vehicles;
drop policy if exists "Users can insert dealership inventory" on inventory_vehicles;
drop policy if exists "Users can update dealership inventory" on inventory_vehicles;
drop policy if exists "Users can delete dealership inventory" on inventory_vehicles;

-- New policy: Users can view inventory for their dealerships
create policy "Users can view dealership inventory"
  on inventory_vehicles for select
  using (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = inventory_vehicles.dealership_id
        and user_dealerships.user_id = auth.uid()
    )
  );

-- New policy: Users can insert inventory for their dealerships
create policy "Users can insert dealership inventory"
  on inventory_vehicles for insert
  with check (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = inventory_vehicles.dealership_id
        and user_dealerships.user_id = auth.uid()
    )
  );

-- New policy: Users can update inventory for their dealerships
create policy "Users can update dealership inventory"
  on inventory_vehicles for update
  using (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = inventory_vehicles.dealership_id
        and user_dealerships.user_id = auth.uid()
    )
  );

-- New policy: Users can delete inventory for their dealerships
create policy "Users can delete dealership inventory"
  on inventory_vehicles for delete
  using (
    exists (
      select 1 from user_dealerships
      where user_dealerships.dealership_id = inventory_vehicles.dealership_id
        and user_dealerships.user_id = auth.uid()
    )
  );

-- Step 12: Backfill existing data - Create dealerships for existing users
do $$
declare
  user_record record;
  new_dealership_id uuid;
  user_profile_record record;
begin
  -- Loop through all users with profiles
  for user_record in
    select distinct p.id as user_id, p.email
    from profiles p
    where p.id is not null
      and not exists (
        select 1 from user_dealerships ud
        where ud.user_id = p.id
      )
  loop
    -- Get profile data for this user
    select 
      marketcheck_dealer_id,
      marketcheck_zip
    into user_profile_record
    from profiles
    where id = user_record.user_id;

    -- Create a default dealership for this user
    insert into dealerships (
      name,
      marketcheck_dealer_id,
      marketcheck_zip,
      created_at,
      updated_at
    )
    values (
      coalesce(
        (select dealer_name from inventory_vehicles where user_id = user_record.user_id limit 1),
        'Your Dealership'
      ),
      user_profile_record.marketcheck_dealer_id,
      user_profile_record.marketcheck_zip,
      now(),
      now()
    )
    returning id into new_dealership_id;

    -- Link user to dealership
    insert into user_dealerships (
      user_id,
      dealership_id,
      role,
      created_at
    )
    values (
      user_record.user_id,
      new_dealership_id,
      'owner',
      now()
    )
    on conflict (user_id, dealership_id) do nothing;

    -- Set as active dealership
    insert into user_preferences (
      user_id,
      active_dealership_id,
      created_at,
      updated_at
    )
    values (
      user_record.user_id,
      new_dealership_id,
      now(),
      now()
    )
    on conflict (user_id) 
    do update set 
      active_dealership_id = new_dealership_id,
      updated_at = now();

    -- Update all inventory_vehicles for this user to use the new dealership_id
    update inventory_vehicles
    set dealership_id = new_dealership_id
    where user_id = user_record.user_id
      and dealership_id is null;
  end loop;
end $$;

-- Step 13: Verify schema
select 
  'profiles' as table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public' 
  and table_name = 'profiles'
  and column_name in ('marketcheck_dealer_id', 'marketcheck_zip')
order by column_name;

select 
  'inventory_vehicles' as table_name,
  count(*) as column_count
from information_schema.columns
where table_schema = 'public' 
  and table_name = 'inventory_vehicles';

select 
  'dealerships' as table_name,
  count(*) as dealership_count
from dealerships;
