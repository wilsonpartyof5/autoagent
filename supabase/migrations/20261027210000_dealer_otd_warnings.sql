-- In-network OTD withhold warnings (middleman spec, 2026-10-27).
-- Warnings go to the salesperson on that conversation. After 3, recommend
-- network removal. This does not delete the dealership. Come-in is a
-- separate admin flag.

alter table public.shopper_dealer_conversations
  add column if not exists otd_warning_count integer not null default 0
    check (otd_warning_count >= 0 and otd_warning_count <= 3),
  add column if not exists otd_itemized_at timestamptz,
  add column if not exists otd_removal_recommended_at timestamptz,
  add column if not exists come_in_count integer not null default 0
    check (come_in_count >= 0),
  add column if not exists come_in_admin_flag boolean not null default false;

comment on column public.shopper_dealer_conversations.otd_warning_count is
  'Warnings sent on this conversation when an itemized best OTD is withheld. Max 3.';

comment on column public.shopper_dealer_conversations.otd_itemized_at is
  'Set when a dealer reply on this thread includes an itemized best OTD. Further withhold warnings stop.';

comment on column public.shopper_dealer_conversations.otd_removal_recommended_at is
  'Set after the 3rd warning. Recommends removal from the Drevvy dealer network. Does not delete the rooftop.';

comment on column public.shopper_dealer_conversations.come_in_admin_flag is
  'Dealer pushed come-in more than once. Admin review. Separate from the OTD warning ladder.';

create table if not exists public.dealer_otd_warnings (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.shopper_dealer_conversations(deal_id) on delete cascade,
  warning_number integer not null check (warning_number between 1 and 3),
  body text not null,
  removal_notice text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (deal_id, warning_number)
);

comment on table public.dealer_otd_warnings is
  'OTD withhold warnings sent to the salesperson on that in-network conversation. Not a shopper auto-send.';

alter table public.dealer_otd_warnings enable row level security;
alter table public.dealer_otd_warnings force row level security;

revoke all on public.dealer_otd_warnings from public, anon, authenticated;
grant select, insert, update, delete on public.dealer_otd_warnings to service_role;
