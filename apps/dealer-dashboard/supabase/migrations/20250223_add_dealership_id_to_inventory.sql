-- Add dealership_id to inventory_vehicles table
-- This allows inventory to be scoped to specific dealerships

alter table inventory_vehicles
  add column if not exists dealership_id uuid references dealerships(id) on delete cascade;

-- Create index for dealership_id
create index if not exists idx_inventory_vehicles_dealership_id on inventory_vehicles(dealership_id);

-- Update RLS policies for inventory_vehicles to use dealership_id
-- Drop old policies
drop policy if exists "Users can view own inventory" on inventory_vehicles;
drop policy if exists "Users can insert own inventory" on inventory_vehicles;
drop policy if exists "Users can delete own inventory" on inventory_vehicles;
drop policy if exists "Users can update own inventory" on inventory_vehicles;

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

