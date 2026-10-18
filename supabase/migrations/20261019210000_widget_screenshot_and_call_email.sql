-- Screenshot path for each widget attempt, and a per-dealer call/email-only flag.
-- ADDITIVE ONLY. Apply after 20261019200000.
-- This file is not applied by the worker.
-- screenshot_url is a path or URL. The image bytes are not stored in Postgres.
-- call_email_only is set when the same dealer site fails with a no-form reason repeatedly.
-- The send path then skips the widget channel. Call and email still run.

alter table public.widget_chat_attempts
  add column if not exists screenshot_url text;

comment on column public.widget_chat_attempts.screenshot_url is
  'Path or URL of the page screenshot for this attempt. Null when the page was never opened.';

alter table public.dealer_directory
  add column if not exists call_email_only boolean not null default false;

comment on column public.dealer_directory.call_email_only is
  'True when the widget repeatedly failed because no lead form could be opened. The widget channel is skipped. Call and email remain.';

create index if not exists dealer_directory_call_email_only_idx
  on public.dealer_directory (site_url)
  where call_email_only = true;
