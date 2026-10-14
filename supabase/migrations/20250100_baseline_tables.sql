-- Baseline migration: ensures tables exist before other migrations reference them.
-- Uses IF NOT EXISTS so it's a no-op on existing databases.
-- Required because some tables were created outside the migration system.

-- leads table (referenced by 20250127_add_leads_status.sql)
create table if not exists leads (
  id text primary key,
  dealer_id text,
  vehicle_id text not null,
  vin text,
  enc_payload text not null,
  consent boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  user_id uuid references auth.users(id) on delete cascade
);

-- dealerships table (referenced by 20250223_add_dealership_id_to_inventory.sql)
create table if not exists dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  logo_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- user_dealerships junction table (referenced by dealership RLS policies)
create table if not exists user_dealerships (
  user_id uuid references auth.users(id) on delete cascade,
  dealership_id uuid references dealerships(id) on delete cascade,
  role text default 'owner',
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, dealership_id)
);

-- uvs_vehicles table (referenced by 20250228_add_uvs_vehicles_rls.sql)
create table if not exists uvs_vehicles (
  id uuid primary key default gen_random_uuid(),
  vin text,
  year integer,
  make text,
  model text,
  trim text,
  price integer,
  miles integer,
  exterior_color text,
  interior_color text,
  availability_status text default 'available',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
