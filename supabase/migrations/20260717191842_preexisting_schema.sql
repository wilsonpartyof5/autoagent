-- Pre-existing schema that live production already has, but no recorded
-- migration created. Preview starts from an empty database and replays every
-- local file, so these objects must exist before 20260717191843.
--
-- Every statement is a no-op when the object already exists: CREATE TABLE
-- IF NOT EXISTS, ENABLE ROW LEVEL SECURITY (already on in production), and
-- a create-if-absent function. No CREATE OR REPLACE, no grants, no revokes.
-- The 26 archived files under supabase/migrations_archive are not in this
-- directory, so they cannot re-run on production.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  onboarding_completed boolean default false,
  inventory_connected boolean default false,
  billing_active boolean default false,
  dms_provider text,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  marketcheck_website_url text,
  lead_delivery_method text,
  lead_delivery_endpoint text,
  lead_delivery_email text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

-- Preview needs a trigger function before 20260717191843 revokes EXECUTE on it.
-- Production already has the Apple-skip body from 20261001172059, so create
-- this older body only when public.handle_new_user is absent.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_user'
  ) then
    execute $fn$
      create function public.handle_new_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        insert into public.profiles (id, email)
        values (new.id, new.email);
        return new;
      end;
      $body$
    $fn$;
  end if;
end;
$$;

create table if not exists public.dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  marketcheck_website_url text,
  logo_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_dealerships (
  user_id uuid not null references auth.users(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  role text default 'owner',
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, dealership_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_dealership_id uuid references public.dealerships(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.inventory_vehicles (
  id uuid primary key default gen_random_uuid(),
  dealer_id text,
  dealership_id uuid references public.dealerships(id),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.leads (
  id text primary key,
  dealer_id text,
  vehicle_id text not null,
  vin text,
  enc_payload text not null,
  consent boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'new'
);

create table if not exists public.lead_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  dealer_id text,
  delivery_method text not null,
  delivery_target text not null,
  status text not null,
  http_status integer,
  response_body text,
  error_message text,
  adf_payload xml not null,
  attempted_at timestamptz not null default timezone('utc'::text, now()),
  attempted_by text default 'system',
  resend_note text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Stub only: later recorded migrations alter this table. IF NOT EXISTS so
-- production (which already has the full table) is unchanged.
create table if not exists public.uvs_vehicles (
  id text primary key,
  vin text,
  dealer_id text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.mc_api_usage (
  month text not null,
  call_type text not null,
  call_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (month, call_type)
);

alter table public.dealerships enable row level security;
alter table public.user_dealerships enable row level security;
alter table public.user_preferences enable row level security;
alter table public.inventory_vehicles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_delivery_logs enable row level security;
alter table public.uvs_vehicles enable row level security;
alter table public.mc_api_usage enable row level security;
