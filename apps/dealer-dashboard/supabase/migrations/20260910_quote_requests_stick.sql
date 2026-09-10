-- Quote requests stick: rooftop UUID on leads, durable delivery outbox,
-- and the delivery-log table if production never received it.

alter table public.leads
  add column if not exists dealership_id uuid references public.dealerships(id);

create index if not exists idx_leads_dealership_id on public.leads(dealership_id);

update public.leads l
set dealership_id = (
  select d.id
  from public.dealerships d
  where d.marketcheck_dealer_id = l.dealer_id
  order by d.created_at
  limit 1
)
where l.dealership_id is null
  and l.dealer_id is not null;

create table if not exists public.lead_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  dealer_id text,
  delivery_method text not null check (delivery_method in ('http', 'email')),
  delivery_target text not null,
  status text not null check (status in ('pending', 'success', 'failed')),
  http_status integer,
  response_body text,
  error_message text,
  adf_payload xml not null,
  attempted_at timestamptz not null default timezone('utc'::text, now()),
  attempted_by text default 'system',
  resend_note text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_lead_delivery_logs_lead_id on public.lead_delivery_logs(lead_id);
create index if not exists idx_lead_delivery_logs_dealer_id on public.lead_delivery_logs(dealer_id);

alter table public.lead_delivery_logs enable row level security;

drop policy if exists "Users can view own delivery logs" on public.lead_delivery_logs;
drop policy if exists "Users can insert own delivery logs" on public.lead_delivery_logs;
drop policy if exists "Members can view dealership delivery logs" on public.lead_delivery_logs;
drop policy if exists "Members can insert dealership delivery logs" on public.lead_delivery_logs;

create policy "Members can view dealership delivery logs"
  on public.lead_delivery_logs for select to authenticated
  using ((select private.user_has_dealer_access(dealer_id)));

create policy "Members can insert dealership delivery logs"
  on public.lead_delivery_logs for insert to authenticated
  with check ((select private.user_has_dealer_access(dealer_id)));

create table if not exists public.lead_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.leads(id) on delete cascade,
  dealership_id uuid references public.dealerships(id),
  dealer_id text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  next_attempt_at timestamptz not null default timezone('utc'::text, now()),
  idempotency_key text not null unique,
  last_error text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_lead_delivery_jobs_due
  on public.lead_delivery_jobs (next_attempt_at)
  where status in ('pending', 'processing');

alter table public.lead_delivery_jobs enable row level security;

revoke all on public.lead_delivery_jobs from public, anon, authenticated;
grant all on public.lead_delivery_jobs to service_role;
