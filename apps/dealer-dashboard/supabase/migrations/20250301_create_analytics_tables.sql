-- Phase 4: Analytics and Event Tracking Schema
-- Creates events, sessions, and vehicle_snapshot tables for analytics

-- ============================================
-- 1. Sessions Table
-- ============================================
-- Tracks user sessions for grouping events
create table if not exists analytics_sessions (
  id text primary key, -- session_id (generated client-side)
  user_id uuid references auth.users(id) on delete set null,
  dealer_id text, -- marketcheck_dealer_id or dealership identifier
  -- Removed ip_address and user_agent per PII policy
  started_at timestamptz not null default timezone('utc'::text, now()),
  ended_at timestamptz,
  last_activity_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure dealerships have a unique marketcheck_dealer_id for FK references
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dealerships_marketcheck_dealer_id_unique'
  ) then
    alter table dealerships
      add constraint dealerships_marketcheck_dealer_id_unique unique (marketcheck_dealer_id);
  end if;
end;
$$;

-- Foreign key for analytics_sessions.dealer_id -> dealerships.marketcheck_dealer_id
alter table analytics_sessions
  add constraint fk_analytics_sessions_dealer_id
  foreign key (dealer_id)
  references dealerships(marketcheck_dealer_id)
  on delete restrict
  deferrable initially deferred;

-- Indexes for sessions
create index if not exists idx_analytics_sessions_user_id on analytics_sessions(user_id) where user_id is not null;
create index if not exists idx_analytics_sessions_dealer_id on analytics_sessions(dealer_id) where dealer_id is not null;
create index if not exists idx_analytics_sessions_started_at on analytics_sessions(started_at desc);
create index if not exists idx_analytics_sessions_last_activity_at on analytics_sessions(last_activity_at desc);

-- ============================================
-- 2. Events Table (Core)
-- ============================================
-- Core events table storing all tracked events
create table if not exists analytics_events (
  id text primary key, -- request_id or generated UUID
  session_id text, -- Session ID for correlation (nullable for system events)
  event_name text not null,
  source text not null, -- Required: 'mcp-server', 'dashboard', 'widget', 'system'
  dealer_id text, -- Required for dealer-scoped events, nullable for system events
  vehicle_id text, -- UVS vehicle ID (required for vehicle events)
  vin text, -- VIN (required when vehicle_id is provided, for validation)
  user_id uuid references auth.users(id) on delete set null,
  
  -- Event payload (JSONB - validated per event_name type)
  payload jsonb not null default '{}'::jsonb,
  
  -- Request context
  request_id text, -- For correlating related events
  
  -- Timestamp
  timestamp timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  
  -- Constraints
  constraint valid_vehicle_fields check (
    -- If vehicle_id is provided, vin should also be provided
    (vehicle_id is null) or (vin is not null)
  ),
  -- Database-level enforcement of required IDs per event type
  constraint required_dealer_id_for_dealer_events check (
    -- Events that require dealer_id
    (event_name in (
      'vehicle.view', 'vehicle.click', 'vehicle.compare',
      'lead.submit', 'lead.view',
      'dashboard.inventory.status_change',
      'dashboard.inventory.edit', 'dashboard.inventory.delete',
      'dashboard.settings.update'
    ) and dealer_id is not null) or
    -- Events that don't require dealer_id
    (event_name not in (
      'vehicle.view', 'vehicle.click', 'vehicle.compare',
      'lead.submit', 'lead.view',
      'dashboard.inventory.status_change',
      'dashboard.inventory.edit', 'dashboard.inventory.delete',
      'dashboard.settings.update'
    ))
  ),
  constraint required_vehicle_id_for_vehicle_events check (
    -- Events that require vehicle_id
    (event_name in (
      'vehicle.view', 'vehicle.click',
      'lead.submit',
      'dashboard.inventory.status_change',
      'dashboard.inventory.edit', 'dashboard.inventory.delete'
    ) and vehicle_id is not null) or
    -- Events that don't require vehicle_id (vehicle.compare has vehicleIds in payload)
    (event_name not in (
      'vehicle.view', 'vehicle.click',
      'lead.submit',
      'dashboard.inventory.status_change',
      'dashboard.inventory.edit', 'dashboard.inventory.delete'
    ))
  ),
  constraint required_session_id_for_user_events check (
    -- Events that require session_id
    (event_name in (
      'vehicle.view', 'vehicle.click', 'vehicle.compare',
      'lead.submit', 'lead.view',
      'dashboard.login',
      'dashboard.inventory.status_change',
      'dashboard.inventory.edit', 'dashboard.inventory.delete',
      'dashboard.settings.update'
    ) and session_id is not null) or
    -- Events that don't require session_id (system events, anonymous searches)
    (event_name not in (
      'vehicle.view', 'vehicle.click', 'vehicle.compare',
      'lead.submit', 'lead.view',
      'dashboard.login',
      'dashboard.inventory.status_change',
      'dashboard.inventory.edit', 'dashboard.inventory.delete',
      'dashboard.settings.update'
    ))
  )
);

-- Add foreign key constraint for session_id (when not null, must reference existing session)
-- Since session_id is nullable, FK only applies when session_id is not null
-- Application code MUST create sessions before inserting events
alter table analytics_events
  add constraint fk_analytics_events_session_id
  foreign key (session_id) 
  references analytics_sessions(id) 
  on delete restrict
  deferrable initially deferred;

-- Foreign key for analytics_events.dealer_id -> dealerships.marketcheck_dealer_id
alter table analytics_events
  add constraint fk_analytics_events_dealer_id
  foreign key (dealer_id)
  references dealerships(marketcheck_dealer_id)
  on delete restrict
  deferrable initially deferred;

-- Foreign key for analytics_events.vehicle_id -> uvs_vehicles.id
alter table analytics_events
  add constraint fk_analytics_events_vehicle_id
  foreign key (vehicle_id)
  references uvs_vehicles(id)
  on delete restrict
  deferrable initially deferred;

-- Function to validate session exists (rejects if missing, does NOT auto-create)
create or replace function validate_session_exists_before_event()
returns trigger as $$
begin
  -- If session_id is provided and not null, it MUST exist (enforces referential integrity)
  if NEW.session_id is not null then
    if not exists (select 1 from analytics_sessions where id = NEW.session_id) then
      raise exception 'Session % does not exist. Session must be created before event insert.', NEW.session_id;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Create trigger to validate session exists (rejects missing sessions, does NOT create)
create trigger trigger_validate_session_exists_before_event
  before insert on analytics_events
  for each row
  execute function validate_session_exists_before_event();

-- Add unique index on analytics_sessions.id (required for FK)
create unique index if not exists analytics_sessions_id_unique on analytics_sessions(id);

-- Indexes for fast queries (as specified in requirements)
create index if not exists idx_analytics_events_source on analytics_events(source);
create index if not exists idx_analytics_events_dealer_id on analytics_events(dealer_id) where dealer_id is not null;
create index if not exists idx_analytics_events_event_name on analytics_events(event_name);
create index if not exists idx_analytics_events_timestamp on analytics_events(timestamp desc);
create index if not exists idx_analytics_events_vin on analytics_events(vin) where vin is not null;
create index if not exists idx_analytics_events_vehicle_id on analytics_events(vehicle_id) where vehicle_id is not null;
create index if not exists idx_analytics_events_session_id on analytics_events(session_id) where session_id is not null;
create index if not exists idx_analytics_events_user_id on analytics_events(user_id) where user_id is not null;
create index if not exists idx_analytics_events_request_id on analytics_events(request_id) where request_id is not null;

-- Composite index for source + event_name queries
create index if not exists idx_analytics_events_source_event on analytics_events(source, event_name);

-- Composite indexes for common query patterns
create index if not exists idx_analytics_events_dealer_timestamp on analytics_events(dealer_id, timestamp desc) where dealer_id is not null;
create index if not exists idx_analytics_events_event_timestamp on analytics_events(event_name, timestamp desc);
create index if not exists idx_analytics_events_dealer_event on analytics_events(dealer_id, event_name) where dealer_id is not null;

-- ============================================
-- 3. Vehicle Snapshot Table (Optional)
-- ============================================
-- Snapshots of vehicle state at the time of events
-- Useful for historical analysis of vehicle attributes
create table if not exists analytics_vehicle_snapshots (
  id text primary key default gen_random_uuid()::text,
  vehicle_id text not null, -- UVS vehicle ID
  vin text,
  dealer_id text,
  
  -- Snapshot of vehicle data at event time
  snapshot_data jsonb not null, -- Full vehicle data snapshot
  
  -- Snapshot metadata
  snapshot_type text default 'event', -- 'event', 'daily', 'weekly'
  event_id text references analytics_events(id) on delete cascade,
  
  -- Timestamp
  timestamp timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Indexes for vehicle snapshots
create index if not exists idx_analytics_vehicle_snapshots_vehicle_id on analytics_vehicle_snapshots(vehicle_id);
create index if not exists idx_analytics_vehicle_snapshots_vin on analytics_vehicle_snapshots(vin) where vin is not null;
create index if not exists idx_analytics_vehicle_snapshots_dealer_id on analytics_vehicle_snapshots(dealer_id) where dealer_id is not null;
create index if not exists idx_analytics_vehicle_snapshots_timestamp on analytics_vehicle_snapshots(timestamp desc);
create index if not exists idx_analytics_vehicle_snapshots_event_id on analytics_vehicle_snapshots(event_id) where event_id is not null;

-- ============================================
-- 4. Enable Row Level Security
-- ============================================
alter table analytics_sessions enable row level security;
alter table analytics_events enable row level security;
alter table analytics_vehicle_snapshots enable row level security;

-- RLS Policies for analytics_sessions
-- Users can view sessions associated with their dealerships
create policy "Users can view sessions for their dealerships"
  on analytics_sessions for select
  using (
    -- Users can view their own sessions
    (user_id is not null and auth.uid() = user_id)
    or
    -- Users can view sessions for dealerships they have access to
    (dealer_id is not null and exists (
      select 1 from dealerships d
      inner join user_dealerships ud on ud.dealership_id = d.id
      where d.marketcheck_dealer_id = analytics_sessions.dealer_id
        and ud.user_id = auth.uid()
    ))
  );

-- System can insert sessions (for anonymous tracking)
create policy "System can insert sessions"
  on analytics_sessions for insert
  with check (true);

-- RLS Policies for analytics_events
-- Users can view events for their dealerships
create policy "Users can view events for their dealerships"
  on analytics_events for select
  using (
    -- Users can view their own events
    (user_id is not null and auth.uid() = user_id)
    or
    -- Users can view events for dealerships they have access to
    (dealer_id is not null and exists (
      select 1 from dealerships d
      inner join user_dealerships ud on ud.dealership_id = d.id
      where d.marketcheck_dealer_id = analytics_events.dealer_id
        and ud.user_id = auth.uid()
    ))
    or
    -- Allow viewing events without dealer_id (for system events)
    dealer_id is null
  );

-- System can insert events
create policy "System can insert events"
  on analytics_events for insert
  with check (true);

-- RLS Policies for analytics_vehicle_snapshots
-- Users can view snapshots for their dealerships
create policy "Users can view snapshots for their dealerships"
  on analytics_vehicle_snapshots for select
  using (
    -- Users can view snapshots for dealerships they have access to
    (dealer_id is not null and exists (
      select 1 from dealerships d
      inner join user_dealerships ud on ud.dealership_id = d.id
      where d.marketcheck_dealer_id = analytics_vehicle_snapshots.dealer_id
        and ud.user_id = auth.uid()
    ))
    or
    dealer_id is null
  );

-- System can insert snapshots
create policy "System can insert snapshots"
  on analytics_vehicle_snapshots for insert
  with check (true);

-- ============================================
-- 5. Helper Functions
-- ============================================
-- Function to validate event payload structure (basic check)
create or replace function validate_event_payload()
returns trigger as $$
begin
  -- Basic validation: ensure payload is a JSON object
  if NEW.payload is null or jsonb_typeof(NEW.payload) != 'object' then
    raise exception 'Event payload must be a JSON object';
  end if;
  
  -- Validate source is one of allowed values
  if NEW.source not in ('mcp-server', 'dashboard', 'widget', 'system') then
    raise exception 'Invalid source: % (must be mcp-server, dashboard, widget, or system)', NEW.source;
  end if;
  
  -- Validate event_name format
  if NEW.event_name is null or length(trim(NEW.event_name)) = 0 then
    raise exception 'Event name cannot be empty';
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Trigger to validate event before insert
create trigger trigger_validate_event
  before insert on analytics_events
  for each row
  execute function validate_event_payload();

-- Function to update last_activity_at when event is inserted (session must already exist)
create or replace function update_session_activity_on_event()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.session_id is not null then
    -- Update last activity (session must exist - FK enforces this)
    update analytics_sessions
    set last_activity_at = NEW.timestamp
    where id = NEW.session_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Trigger to update session activity (runs AFTER validation trigger)
-- Session must exist (enforced by FK + validation trigger)
create trigger trigger_update_session_activity_on_event
  after insert on analytics_events
  for each row
  execute function update_session_activity_on_event();

