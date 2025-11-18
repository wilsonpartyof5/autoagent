-- Add live/published status fields to inventory_vehicles
-- This allows dealers to control which vehicles are visible in ChatGPT search

alter table inventory_vehicles
  add column if not exists is_live boolean default false,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id);

-- Index for filtering live vehicles efficiently
create index if not exists idx_inventory_vehicles_is_live 
  on inventory_vehicles(user_id, is_live) 
  where is_live = true;

-- Comment on columns
comment on column inventory_vehicles.is_live is 'Whether this vehicle is published and visible in ChatGPT search';
comment on column inventory_vehicles.published_at is 'Timestamp when vehicle was first published';
comment on column inventory_vehicles.published_by is 'User who published the vehicle';

