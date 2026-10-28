-- Drevvy dealer cadence log. Not applied.
-- One row per outbound send or inbound reply, including call transcripts.
-- Shopper routes must not read this table. Service role is the only client.
-- Depends on no other table so it can be applied on its own later.

create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null,
  dealer_id text not null,
  vehicle_id text not null,
  touchpoint text not null check (touchpoint in (
    'D0-E1', 'D0-C1', 'D0-T1', 'D0-TS', 'D0-C2',
    'D1-E2', 'D1-T2', 'D2-C3', 'D2-T3',
    'D4-E3', 'D4-T4', 'D5-E4',
    'D6-E3', 'D6-T4', 'D7-E4', 'VM-1'
  )),
  variant text not null check (variant in ('A', 'B', 'C')),
  channel text not null check (channel in ('email', 'sms', 'call', 'voicemail')),
  direction text not null check (direction in ('outbound', 'inbound')),
  to_type text not null check (to_type in ('main_line', 'salesperson', 'email')),
  sent_at timestamptz not null,
  dealer_local_time text not null,
  dealer_tz text not null,
  day_of_week text not null,
  status text not null check (status in (
    'queued', 'sent', 'delivered', 'bounced', 'failed', 'skipped_not_textable'
  )),
  opened_at timestamptz,
  replied boolean not null default false,
  reply_at timestamptz,
  reply_channel text check (reply_channel in ('email', 'sms', 'call')),
  call_outcome text check (call_outcome in (
    'number_captured', 'transferred', 'voicemail', 'sold', 'refused', 'no_answer'
  )),
  call_duration_s integer,
  captured_number text,
  opt_out boolean not null default false,
  dealer_type text check (dealer_type in ('franchise', 'independent')),
  brand text,
  region text,
  dealer_size text,
  body text,
  transcript text,
  summary text
);

create index if not exists outreach_events_sent_at
  on public.outreach_events (sent_at desc);

create index if not exists outreach_events_deal_time
  on public.outreach_events (deal_id, sent_at desc);

create index if not exists outreach_events_touchpoint_variant
  on public.outreach_events (touchpoint, variant);

alter table public.outreach_events enable row level security;
alter table public.outreach_events force row level security;

revoke all on table public.outreach_events from public, anon, authenticated;
grant select, insert, update, delete on table public.outreach_events to service_role;
