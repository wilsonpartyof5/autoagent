-- SMS opt-out line setting and number suppression. ADDITIVE ONLY.
-- The Supabase integration applies this file on merge. Do not apply it by hand.
-- When the settings row is missing, the send gateway uses its code default:
-- first_message_per_thread, with no silence window.

create table if not exists public.sms_send_settings (
  id text primary key default 'default',
  opt_out_line_mode text not null default 'first_message_per_thread'
    check (opt_out_line_mode in ('first_message_per_thread', 'every_message', 'never')),
  opt_out_line_silence_hours integer
    check (
      opt_out_line_silence_hours is null
      or (opt_out_line_silence_hours >= 1 and opt_out_line_silence_hours <= 8760)
    ),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by text,
  constraint sms_send_settings_singleton check (id = 'default'),
  constraint sms_send_settings_updated_by_length check (
    updated_by is null or char_length(updated_by) <= 320
  )
);

comment on table public.sms_send_settings is
  'Operator setting for when outbound SMS appends "Reply STOP to opt out".';

comment on column public.sms_send_settings.opt_out_line_mode is
  'first_message_per_thread (default), every_message, or never.';

comment on column public.sms_send_settings.opt_out_line_silence_hours is
  'Optional. With first_message_per_thread, also append the line after this many hours of silence.';

insert into public.sms_send_settings (id, opt_out_line_mode)
values ('default', 'first_message_per_thread')
on conflict (id) do nothing;

create table if not exists public.sms_optouts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  reason text not null,
  raw_text text,
  vendor_event_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint sms_optouts_phone_e164 check (phone ~ '^\+[0-9]{8,15}$'),
  constraint sms_optouts_reason_length check (char_length(reason) between 1 and 80)
);

comment on table public.sms_optouts is
  'Phone numbers that must not receive any further texts. Service role only.';

create index if not exists sms_optouts_created_at on public.sms_optouts (created_at desc);

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  thread_key text not null,
  phone text not null,
  direction text not null check (direction in ('outbound', 'inbound')),
  body text not null,
  opt_out_line_appended boolean not null default false,
  telnyx_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint sms_messages_phone_e164 check (phone ~ '^\+[0-9]{8,15}$'),
  constraint sms_messages_thread_key_length check (char_length(thread_key) between 1 and 200)
);

comment on table public.sms_messages is
  'Outbound and inbound SMS used to decide the opt-out line and to keep thread silence.';

create index if not exists sms_messages_thread_time
  on public.sms_messages (thread_key, created_at desc);

create index if not exists sms_messages_phone_time
  on public.sms_messages (phone, created_at desc);

do $$ declare t text; begin
  foreach t in array array['sms_send_settings', 'sms_optouts', 'sms_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
