-- Directory status for a dealer site that presented a bot wall.
-- ADDITIVE ONLY. Apply after 20261018150000_day0_channel_selection.sql.
-- This file is not applied by the worker.
-- blocked rows store the dealer page URL that was walled. They do not store MarketCheck payloads.

alter table public.dealer_directory
  drop constraint if exists dealer_directory_status_check;

alter table public.dealer_directory
  add constraint dealer_directory_status_check
  check (
    status in ('active', 'stale', 'unreachable', 'no_widget', 'needs_review', 'blocked')
  );

comment on column public.dealer_directory.status is
  'active, stale, unreachable, no_widget, needs_review, or blocked. blocked means the dealer site presented a bot wall and contacts were not taken from that page.';
