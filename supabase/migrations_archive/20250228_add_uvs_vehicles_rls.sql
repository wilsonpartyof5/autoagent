-- Add RLS policies for uvs_vehicles table
-- This allows authenticated users to view available vehicles

-- Enable RLS on uvs_vehicles if not already enabled
alter table uvs_vehicles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view vehicles for their dealership" on uvs_vehicles;
drop policy if exists "Authenticated users can view available vehicles" on uvs_vehicles;
drop policy if exists "Service role can manage vehicles" on uvs_vehicles;

-- Policy: Allow authenticated users to view available vehicles
-- This allows any authenticated user to see available vehicles
-- TODO: Restrict this later based on dealership associations if needed
create policy "Authenticated users can view available vehicles"
  on uvs_vehicles for select
  using (
    auth.role() = 'authenticated'
    and availability_status = 'available'
  );

-- Policy: Allow service role to manage vehicles (for ingestion/updates)
-- This is needed for the MCP server to insert/update vehicles
create policy "Service role can manage vehicles"
  on uvs_vehicles for all
  using (auth.role() = 'service_role');

