-- Dealer research directory and widget chat transcripts. ADDITIVE ONLY.
-- No foreign keys to existing tables. Service role only.
-- Do not store raw MarketCheck listing payloads in these tables.
-- A directory row is due for refresh when last_checked_at is null or older than 30 days.

create table if not exists public.dealer_directory (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  name text,
  phones text[] not null default '{}',
  emails text[] not null default '{}',
  widget_vendor text,
  source_urls text[] not null default '{}',
  confidence numeric(3,2),
  last_checked_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dealer_directory_site_url_unique unique (site_url),
  constraint dealer_directory_site_url_http check (site_url ~ '^https?://[^[:space:]]+$'),
  constraint dealer_directory_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  ),
  constraint dealer_directory_status_check check (
    status in ('active', 'stale', 'unreachable', 'no_widget', 'needs_review')
  )
);

comment on table public.dealer_directory is
  'Dealership sites learned from the dealer''s own pages. Refresh when last_checked_at is null or older than 30 days. MarketCheck contact data is a worker hint and is not stored here.';

comment on column public.dealer_directory.site_url is
  'Dealership website origin, unique. Example: https://www.example-motors.com';

comment on column public.dealer_directory.source_urls is
  'Dealer pages fetched for this row. Not MarketCheck listing URLs.';

create index if not exists dealer_directory_last_checked_idx
  on public.dealer_directory (last_checked_at);

create or replace function public.dealer_directory_due_for_refresh(checked_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select checked_at is null or checked_at < now() - interval '30 days';
$$;

revoke all on function public.dealer_directory_due_for_refresh(timestamptz) from public, anon, authenticated;
grant execute on function public.dealer_directory_due_for_refresh(timestamptz) to service_role;

create or replace function public.touch_dealer_directory_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dealer_directory_set_updated_at on public.dealer_directory;
create trigger dealer_directory_set_updated_at
  before update on public.dealer_directory
  for each row
  execute function public.touch_dealer_directory_updated_at();

create table if not exists public.widget_chat_attempts (
  id uuid primary key default gen_random_uuid(),
  vehicle_page_url text not null,
  dealer_site_url text,
  stock_number text,
  widget_vendor text,
  status text not null,
  price text,
  dry_run boolean not null default true,
  transcript jsonb not null default '[]'::jsonb,
  stop_reason text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint widget_chat_attempts_vehicle_url_http check (vehicle_page_url ~ '^https?://[^[:space:]]+$'),
  constraint widget_chat_attempts_status_check check (
    status in (
      'available',
      'sold',
      'price_given',
      'asked_contact',
      'human_handoff',
      'unknown',
      'dry_run',
      'captcha',
      'contact_form',
      'not_allowlisted',
      'no_widget',
      'turn_limit',
      'error'
    )
  ),
  constraint widget_chat_attempts_transcript_array check (jsonb_typeof(transcript) = 'array')
);

comment on table public.widget_chat_attempts is
  'One row per widget chat attempt, including dry runs. Transcript text only; shopper phone and email are never stored.';

create index if not exists widget_chat_attempts_started_idx
  on public.widget_chat_attempts (started_at desc);

create index if not exists widget_chat_attempts_site_idx
  on public.widget_chat_attempts (dealer_site_url, started_at desc);

alter table public.dealer_directory enable row level security;
alter table public.dealer_directory force row level security;
revoke all on table public.dealer_directory from public, anon, authenticated;
grant select, insert, update, delete on table public.dealer_directory to service_role;

alter table public.widget_chat_attempts enable row level security;
alter table public.widget_chat_attempts force row level security;
revoke all on table public.widget_chat_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.widget_chat_attempts to service_role;
