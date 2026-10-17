-- Day-0 channel choice on each outreach attempt. ADDITIVE ONLY.
-- Apply after 20261018120000_widget_playbooks.sql.
-- This file is not applied by the worker.

alter table public.widget_chat_attempts
  add column if not exists selected_channels text;

alter table public.widget_chat_attempts
  add column if not exists channel_reason text;

alter table public.widget_chat_attempts
  add column if not exists fallback text;

alter table public.widget_chat_attempts
  drop constraint if exists widget_chat_attempts_fallback_check;

alter table public.widget_chat_attempts
  add constraint widget_chat_attempts_fallback_check
  check (fallback is null or fallback = 'email_text_call');

comment on column public.widget_chat_attempts.selected_channels is
  'Day-0 channels for this dealer: lead_form, widget,lead_form, or null when a bot wall sends nothing.';

comment on column public.widget_chat_attempts.channel_reason is
  'Why those channels were chosen, including the widget status.';

comment on column public.widget_chat_attempts.fallback is
  'email_text_call when the page is a bot wall and chat and the lead form must not be retried.';
