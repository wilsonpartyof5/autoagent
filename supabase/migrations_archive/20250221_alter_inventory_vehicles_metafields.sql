-- Expand inventory_vehicles with full AutoAgent inventory metafields schema

alter table inventory_vehicles
  rename column if exists mileage to miles;

alter table inventory_vehicles
  rename column if exists photo_url to primary_photo_url;

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

-- Ensure created_at column exists and defaults to UTC now
alter table inventory_vehicles
  alter column created_at set default timezone('utc'::text, now());

-- Backfill renamed columns into the new structure where possible
update inventory_vehicles
set thumbnail_url = coalesce(thumbnail_url, primary_photo_url),
    last_synced_at = coalesce(last_synced_at, created_at),
    sync_status = coalesce(sync_status, 'pending'),
    data_source = coalesce(data_source, 'marketcheck-api'),
    lead_status = coalesce(lead_status, 'none')
where true;

create index if not exists idx_inventory_vehicles_listing_id on inventory_vehicles(listing_id);
create index if not exists idx_inventory_vehicles_stock_number on inventory_vehicles(stock_number);
