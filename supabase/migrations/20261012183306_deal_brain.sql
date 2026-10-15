-- Drevvy Deal Brain. ADDITIVE ONLY: creates new tables, touches nothing existing.
-- No FKs to existing tables, so it applies independently of the unapplied
-- 20261006/20261010/20261011 outreach migrations. Service role only.

create table if not exists public.brain_vendor_events (
  id uuid primary key default gen_random_uuid(),
  vendor text not null check (vendor in ('telnyx','elevenlabs')),
  vendor_event_id text not null,              -- Telnyx data.id / ElevenLabs conversation_id (idempotency)
  event_type text not null,                   -- e.g. call.hangup, message.finalized, post_call_transcription
  channel text check (channel in ('call','sms','email','voicemail')),
  direction text check (direction in ('outbound','inbound')),
  deal_id text,                               -- matches outreach_events.deal_id (text)
  dealer_id text,
  touchpoint text,
  variant text,
  status text,                                -- delivered, failed, busy, no_answer, completed...
  error_code text,
  error_detail text,
  duration_s integer,
  transcript text,
  summary text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  signature_verified boolean not null default false,
  payload jsonb not null,
  unique (vendor, vendor_event_id, event_type)
);
create index if not exists brain_vendor_events_time on public.brain_vendor_events (occurred_at desc);
create index if not exists brain_vendor_events_deal on public.brain_vendor_events (deal_id, occurred_at desc);
create index if not exists brain_vendor_events_failures on public.brain_vendor_events (vendor, occurred_at desc) where error_code is not null;

create table if not exists public.vendor_incidents (
  id uuid primary key default gen_random_uuid(),
  vendor text not null check (vendor in ('telnyx','elevenlabs','openai','supabase','vercel','railway')),
  external_id text not null,
  title text not null,
  status text,                                -- investigating, identified, monitoring, resolved
  impact text,                                -- none, minor, major, critical
  components text[],
  url text,
  started_at timestamptz,
  resolved_at timestamptz,
  last_polled_at timestamptz not null default now(),
  raw jsonb,
  unique (vendor, external_id)
);
create index if not exists vendor_incidents_open on public.vendor_incidents (vendor) where resolved_at is null;

create table if not exists public.brain_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('health_check','daily_digest','reply_decision','eval')),
  model text not null,
  prompt_version text not null,
  trigger_ref text,                           -- e.g. brain_vendor_events.id for reply_decision
  status text not null default 'running' check (status in ('running','ok','error','blocked_by_guardrail')),
  input_tokens integer, output_tokens integer, cost_usd numeric(10,4),
  tool_calls jsonb not null default '[]'::jsonb,
  output jsonb,
  guardrail_hits text[],
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists brain_runs_job_time on public.brain_runs (job, started_at desc);

create table if not exists public.brain_lessons (
  id uuid primary key default gen_random_uuid(),
  lesson text not null,
  scope jsonb not null default '{}'::jsonb,   -- {brand, region, dealer_type, touchpoint}
  evidence jsonb,                             -- metric snapshot backing the lesson
  confidence numeric(3,2) check (confidence between 0 and 1),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','retired')),
  source_run_id uuid references public.brain_runs(id) on delete set null,
  approved_by text, approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.brain_eval_cases (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reply_decision','classification','digest')),
  input jsonb not null,                       -- dealer message + deal context
  expected jsonb not null,                    -- expected action / must_not rules
  label text check (label in ('good','bad')),
  tags text[],
  created_at timestamptz not null default now()
);

create table if not exists public.brain_eval_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.brain_eval_cases(id) on delete cascade,
  run_id uuid references public.brain_runs(id) on delete set null,
  model text not null, prompt_version text not null,
  passed boolean not null, score numeric, notes text,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['brain_vendor_events','vendor_incidents','brain_runs','brain_lessons','brain_eval_cases','brain_eval_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
