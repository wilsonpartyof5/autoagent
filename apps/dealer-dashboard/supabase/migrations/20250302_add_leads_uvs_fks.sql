-- Add UVS foreign key constraints to leads table
-- Ensures leads.vehicle_id references uvs_vehicles.id
-- and leads.dealer_id references dealerships.marketcheck_dealer_id

-- First, ensure uvs_vehicles table exists and has proper structure
-- (This migration assumes uvs_vehicles was created in 20250228_create_uvs_vehicles.sql)

-- Add foreign key constraint for vehicle_id -> uvs_vehicles.id
-- Only add if constraint doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_leads_vehicle_id'
  ) then
    alter table leads
      add constraint fk_leads_vehicle_id
      foreign key (vehicle_id)
      references uvs_vehicles(id)
      on delete restrict
      deferrable initially deferred;
  end if;
end;
$$;

-- Add foreign key constraint for dealer_id -> dealerships.marketcheck_dealer_id
-- Only add if constraint doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_leads_dealer_id'
  ) then
    -- Ensure dealerships.marketcheck_dealer_id is unique (required for FK)
    if not exists (
      select 1 from pg_constraint
      where conname = 'dealerships_marketcheck_dealer_id_unique'
    ) then
      alter table dealerships
        add constraint dealerships_marketcheck_dealer_id_unique unique (marketcheck_dealer_id);
    end if;
    
    alter table leads
      add constraint fk_leads_dealer_id
      foreign key (dealer_id)
      references dealerships(marketcheck_dealer_id)
      on delete restrict
      deferrable initially deferred;
  end if;
end;
$$;

-- Add index for faster joins (if not exists)
create index if not exists idx_leads_vehicle_id_fk on leads(vehicle_id) where vehicle_id is not null;
create index if not exists idx_leads_dealer_id_fk on leads(dealer_id) where dealer_id is not null;

