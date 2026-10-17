-- Playbook name on the dealer directory, and scan statuses on chat attempts.
-- ADDITIVE ONLY. Apply after 20261018030000_widget_attempt_channels.sql.
-- This file is not applied by the worker.

alter table public.dealer_directory
  add column if not exists widget_playbook text;

alter table public.dealer_directory
  drop constraint if exists dealer_directory_widget_playbook_check;

alter table public.dealer_directory
  add constraint dealer_directory_widget_playbook_check
  check (
    widget_playbook is null
    or widget_playbook in ('gubagoo', 'carnow', 'generic')
  );

comment on column public.dealer_directory.widget_playbook is
  'How the worker opens the chat widget: gubagoo, carnow, or generic.';

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
      'already_submitted',
      'widget_offline',
      'page_timeout',
      'composer_not_found'
    )
  );
