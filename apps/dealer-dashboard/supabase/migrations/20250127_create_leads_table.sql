-- Create leads table in Supabase for Vercel deployment
-- Replaces SQLite-based leads storage

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

-- Indexes for common queries
create index if not exists idx_leads_dealer_id on leads(dealer_id);
create index if not exists idx_leads_vehicle_id on leads(vehicle_id);
create index if not exists idx_leads_user_id on leads(user_id);
create index if not exists idx_leads_created_at on leads(created_at desc);

-- RLS policies
alter table leads enable row level security;

-- Users can view their own leads (scoped by user_id)
create policy "Users can view own leads"
  on leads for select
  using (auth.uid() = user_id);

-- System can insert leads (for lead ingestion)
create policy "System can insert leads"
  on leads for insert
  with check (true);

-- Users can update their own leads
create policy "Users can update own leads"
  on leads for update
  using (auth.uid() = user_id);

