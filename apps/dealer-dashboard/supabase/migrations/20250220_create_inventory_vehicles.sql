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

create index if not exists idx_inventory_vehicles_user_id on inventory_vehicles(user_id);

create index if not exists idx_inventory_vehicles_vin on inventory_vehicles(vin);
