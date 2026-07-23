-- Nationwide MarketCheck lead routing and PII-safe ChatGPT flow observability.

alter table public.leads
  add column if not exists inventory_source text
    check (inventory_source in ('uvs_db', 'marketcheck_mcp')),
  add column if not exists routing_status text not null default 'dealer_assigned'
    check (routing_status in ('platform_inbox', 'dealer_assigned', 'routed', 'archived')),
  add column if not exists vehicle_snapshot jsonb,
  add column if not exists external_listing_id text,
  add column if not exists flow_id text,
  add column if not exists routed_at timestamptz,
  add column if not exists routed_by uuid references auth.users(id);

alter table public.leads drop constraint if exists fk_leads_vehicle_id;
alter table public.leads drop constraint if exists fk_leads_dealer_id;

create index if not exists idx_leads_routing_created
  on public.leads (routing_status, created_at desc);
create index if not exists idx_leads_flow_id
  on public.leads (flow_id) where flow_id is not null;
create index if not exists idx_leads_external_listing
  on public.leads (external_listing_id) where external_listing_id is not null;

drop policy if exists "Platform admins can update leads" on public.leads;
create policy "Platform admins can update leads"
  on public.leads for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create table if not exists public.app_sessions (
  id text primary key,
  provider text,
  started_at timestamptz not null default timezone('utc'::text, now()),
  last_activity_at timestamptz not null default timezone('utc'::text, now()),
  search_location text,
  result_count integer,
  lead_id text
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  flow_id text not null references public.app_sessions(id) on delete cascade,
  event_name text not null,
  source text not null check (source in ('mcp-server', 'widget', 'dashboard', 'system')),
  provider text,
  request_id text,
  tool_name text,
  dealer_id text,
  vehicle_id text,
  vin text,
  status text,
  error_code text,
  duration_ms integer,
  result_count integer,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_app_events_flow_time
  on public.app_events (flow_id, occurred_at);
create index if not exists idx_app_events_provider_error
  on public.app_events (provider, error_code, occurred_at desc);
create index if not exists idx_app_events_name_time
  on public.app_events (event_name, occurred_at desc);

alter table public.app_sessions enable row level security;
alter table public.app_events enable row level security;

drop policy if exists "Platform admins can view app sessions" on public.app_sessions;
create policy "Platform admins can view app sessions"
  on public.app_sessions for select to authenticated
  using ((select private.is_platform_admin()));

drop policy if exists "Platform admins can view app events" on public.app_events;
create policy "Platform admins can view app events"
  on public.app_events for select to authenticated
  using ((select private.is_platform_admin()));

revoke insert, update, delete on public.app_sessions from anon, authenticated;
revoke insert, update, delete on public.app_events from anon, authenticated;
