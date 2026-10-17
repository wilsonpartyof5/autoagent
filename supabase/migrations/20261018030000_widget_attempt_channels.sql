-- Channel and first-reply tracking for day-0 outreach. ADDITIVE ONLY.
-- Apply after 20261018014500_dealer_directory_widget_chat.sql.
-- This file is not applied by the worker.

alter table public.widget_chat_attempts
  add column if not exists channel text not null default 'widget';

alter table public.widget_chat_attempts
  drop constraint if exists widget_chat_attempts_channel_check;

alter table public.widget_chat_attempts
  add constraint widget_chat_attempts_channel_check
  check (channel in ('widget', 'lead_form', 'prechat'));

alter table public.widget_chat_attempts
  add column if not exists first_reply_channel text;

alter table public.widget_chat_attempts
  drop constraint if exists widget_chat_attempts_first_reply_channel_check;

alter table public.widget_chat_attempts
  add constraint widget_chat_attempts_first_reply_channel_check
  check (
    first_reply_channel is null
    or first_reply_channel in ('widget', 'lead_form', 'prechat')
  );

alter table public.widget_chat_attempts
  drop constraint if exists widget_chat_attempts_status_check;

alter table public.widget_chat_attempts
  add constraint widget_chat_attempts_status_check
  check (
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
      'error',
      'blocked',
      'submitted',
      'private_info',
      'already_submitted'
    )
  );

comment on column public.widget_chat_attempts.channel is
  'widget, lead_form, or prechat. Shopper phone and email are never stored.';

comment on column public.widget_chat_attempts.first_reply_channel is
  'The channel whose dealer reply was observed first for this vehicle page. Null until a reply arrives.';

create index if not exists widget_chat_attempts_blocked_idx
  on public.widget_chat_attempts (dealer_site_url)
  where status = 'blocked';

create index if not exists widget_chat_attempts_submitted_idx
  on public.widget_chat_attempts (vehicle_page_url, channel)
  where dry_run = false and status = 'submitted';
