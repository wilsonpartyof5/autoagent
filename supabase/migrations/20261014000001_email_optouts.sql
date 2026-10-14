-- Email opt-out tracking. ADDITIVE ONLY.
-- Records email addresses that have unsubscribed or reported spam via Telnyx.
-- Service role only. Check before every email send.

create table if not exists public.email_optouts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text not null check (reason in ('unsubscribed', 'spam_reported')),
  vendor_event_id text,
  created_at timestamptz not null default now()
);

create index if not exists email_optouts_email on public.email_optouts (email);

alter table public.email_optouts enable row level security;
alter table public.email_optouts force row level security;
revoke all on table public.email_optouts from public, anon, authenticated;
grant select, insert, update, delete on table public.email_optouts to service_role;
