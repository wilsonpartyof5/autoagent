-- Create uvs_vehicles table matching the Unified Vehicle Schema (UVS)
-- This table stores normalized vehicle inventory from multiple providers

create table if not exists uvs_vehicles (
  -- Primary identifier
  id text primary key, -- UVS id (e.g., 'mc-123', 'csv-456', 'api-789')
  
  -- Base Identity (extracted for indexing)
  vin text,
  year integer not null,
  make text not null,
  model text not null,
  trim text,
  stock_number text,
  listing_id text,
  vehicle_type text check (vehicle_type in ('car', 'truck', 'suv', 'van', 'motorcycle', 'rv', 'trailer', 'other')),
  
  -- Condition (required)
  condition text not null check (condition in ('new', 'used', 'certified')),
  
  -- Pricing (extracted for filtering)
  price numeric not null,
  msrp numeric,
  currency text default 'USD',
  
  -- Core Specs (extracted for filtering)
  body_type text,
  fuel_type text,
  drivetrain text,
  transmission_type text,
  miles numeric,
  kilometers numeric,
  
  -- Location/Dealer (extracted for filtering)
  dealer_id text,
  dealer_name text not null,
  dealer_city text,
  dealer_state text,
  dealer_country text,
  dealer_latitude numeric,
  dealer_longitude numeric,
  
  -- Availability
  availability_status text check (availability_status in ('available', 'pending', 'sold', 'in_transit', 'on_order', 'hold', 'unavailable')),
  is_live boolean default false,
  published_at timestamptz,
  available_date date,
  sold_date date,
  days_on_market integer,
  
  -- Operational metadata
  data_source text, -- e.g., 'marketcheck-api', 'csv-import', 'dealer-api'
  source text, -- Provider-specific source identifier
  last_synced_at timestamptz not null,
  sync_status text check (sync_status in ('pending', 'in_progress', 'success', 'failed')) default 'success',
  sync_error text,
  sync_retry_count integer default 0,
  
  -- Full UVS document stored as JSONB for nested fields
  -- This preserves all nested structures: baseIdentity, coreSpecs, dimensionsPerformance,
  -- pricing details, featuresPackages, media, history, location, availability, marketData,
  -- dealerDefined, operational, leadTracking, enrichment
  uvs_data jsonb not null,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Indexes for common queries
-- Unique constraint on VIN to prevent duplicates
create unique index if not exists idx_uvs_vehicles_vin_unique on uvs_vehicles(vin) where vin is not null;
create index if not exists idx_uvs_vehicles_vin on uvs_vehicles(vin) where vin is not null;
create index if not exists idx_uvs_vehicles_year on uvs_vehicles(year);
create index if not exists idx_uvs_vehicles_make_model on uvs_vehicles(make, model);
create index if not exists idx_uvs_vehicles_dealer_name on uvs_vehicles(dealer_name);
create index if not exists idx_uvs_vehicles_dealer_id on uvs_vehicles(dealer_id) where dealer_id is not null;
create index if not exists idx_uvs_vehicles_condition on uvs_vehicles(condition);
create index if not exists idx_uvs_vehicles_price on uvs_vehicles(price);
create index if not exists idx_uvs_vehicles_availability_status on uvs_vehicles(availability_status);
create index if not exists idx_uvs_vehicles_data_source on uvs_vehicles(data_source);
create index if not exists idx_uvs_vehicles_last_synced_at on uvs_vehicles(last_synced_at desc);
create index if not exists idx_uvs_vehicles_sync_status on uvs_vehicles(sync_status);
create index if not exists idx_uvs_vehicles_location on uvs_vehicles(dealer_latitude, dealer_longitude) where dealer_latitude is not null and dealer_longitude is not null;

-- Composite indexes for common search patterns
create index if not exists idx_uvs_vehicles_search_make_model_year on uvs_vehicles(make, model, year);
create index if not exists idx_uvs_vehicles_search_price_range on uvs_vehicles(price) where availability_status = 'available';
create index if not exists idx_uvs_vehicles_search_condition_price on uvs_vehicles(condition, price) where availability_status = 'available';

-- GIN index for full-text search on JSONB data
create index if not exists idx_uvs_vehicles_uvs_data_gin on uvs_vehicles using gin(uvs_data);

-- Function to update updated_at timestamp
create or replace function update_uvs_vehicles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at
create trigger trigger_update_uvs_vehicles_updated_at
  before update on uvs_vehicles
  for each row
  execute function update_uvs_vehicles_updated_at();

-- Comments for documentation
comment on table uvs_vehicles is 'Stores normalized vehicle inventory using Unified Vehicle Schema (UVS) format';
comment on column uvs_vehicles.id is 'Unique vehicle identifier (provider-specific format)';
comment on column uvs_vehicles.uvs_data is 'Complete UVS document as JSONB preserving all nested structures';
comment on column uvs_vehicles.last_synced_at is 'Timestamp of last successful sync (required by UVS operational.lastSyncedAt)';

