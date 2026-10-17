-- Persist call recordings metadata and label test phone numbers.
-- ADDITIVE ONLY. Applies on merge. Service role only.
-- A call or text is ai_to_ai_test only when every phone party is kind=test.

create table if not exists public.labeled_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  label text not null,
  kind text not null check (kind in ('test', 'live')),
  role text check (role is null or role in ('drevvy_caller', 'dealer', 'other')),
  created_at timestamptz not null default now()
);

comment on table public.labeled_numbers is
  'Operator labels for phone numbers. kind=test marks internal agents such as the Drevvy caller and the dealer test line.';

insert into public.labeled_numbers (phone_e164, label, kind, role)
values
  ('+18039878296', 'test agent 1', 'test', 'drevvy_caller'),
  ('+18392748197', 'test agent 2', 'test', 'dealer')
on conflict (phone_e164) do update
set label = excluded.label,
    kind = excluded.kind,
    role = excluded.role;

alter table public.labeled_numbers enable row level security;
alter table public.labeled_numbers force row level security;
revoke all on table public.labeled_numbers from public, anon, authenticated;
grant select, insert, update, delete on table public.labeled_numbers to service_role;

alter table public.brain_vendor_events
  add column if not exists from_address text,
  add column if not exists to_address text,
  add column if not exists body text,
  add column if not exists recording_path text,
  add column if not exists recording_status text,
  add column if not exists is_test boolean not null default false,
  add column if not exists conversation_type text,
  add column if not exists structured jsonb,
  add column if not exists call_control_id text,
  add column if not exists conversation_id text;

comment on column public.brain_vendor_events.body is
  'Full SMS or email copy. Call transcripts live in transcript.';
comment on column public.brain_vendor_events.recording_path is
  'Private call-recordings object path. Telnyx media URLs are not stored.';
comment on column public.brain_vendor_events.is_test is
  'True when every phone party is a labeled test number.';
comment on column public.brain_vendor_events.conversation_type is
  'ai_to_ai_test when both parties are labeled test numbers. Null for live traffic.';

do $$ begin
  alter table public.brain_vendor_events
    add constraint brain_vendor_events_conversation_type_check
    check (conversation_type is null or conversation_type = 'ai_to_ai_test');
exception when duplicate_object then null;
end $$;

create index if not exists brain_vendor_events_live_time
  on public.brain_vendor_events (occurred_at desc)
  where is_test = false;

create index if not exists brain_vendor_events_call_control
  on public.brain_vendor_events (call_control_id)
  where call_control_id is not null;

alter table public.outreach_events
  add column if not exists from_address text,
  add column if not exists to_address text,
  add column if not exists recording_path text,
  add column if not exists is_test boolean not null default false,
  add column if not exists conversation_type text;

do $$ begin
  alter table public.outreach_events
    add constraint outreach_events_conversation_type_check
    check (conversation_type is null or conversation_type = 'ai_to_ai_test');
exception when duplicate_object then null;
end $$;

create index if not exists outreach_events_live_sent
  on public.outreach_events (sent_at desc)
  where is_test = false;

alter table public.shopper_outreach_messages
  add column if not exists from_address text,
  add column if not exists to_address text,
  add column if not exists recording_path text,
  add column if not exists transcript text,
  add column if not exists summary text,
  add column if not exists duration_s integer,
  add column if not exists status text,
  add column if not exists is_test boolean not null default false,
  add column if not exists conversation_type text;

do $$ begin
  alter table public.shopper_outreach_messages
    add constraint shopper_outreach_messages_conversation_type_check
    check (conversation_type is null or conversation_type = 'ai_to_ai_test');
exception when duplicate_object then null;
end $$;

create index if not exists shopper_outreach_messages_live_time
  on public.shopper_outreach_messages (shopper_deal_id, occurred_at desc)
  where is_test = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'call-recordings',
  'call-recordings',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp3', 'audio/wav']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Private bucket. The service role uploads and the admin API reads.
-- No policy is granted to anon or authenticated.
