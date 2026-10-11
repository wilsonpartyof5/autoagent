-- Deal lifecycle beside shopper_deals: monthly quota facts, sold / no-response
-- end state, the revealed dealer pin for the shopper geofence, and the
-- "Did you buy it?" answer.
--
-- NOT APPLIED. Do not run this against production from the lifecycle change.
-- shopper_deals itself is unchanged, so current deal reads keep working until
-- this file is applied on purpose and DEAL_LIFECYCLE_STORE=supabase.
-- The dealer pin is latitude, longitude, and radius only.

create table if not exists public.shopper_deal_lifecycle (
  deal_id uuid primary key references public.shopper_deals(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  added_at timestamptz not null,
  removed_at timestamptz,
  first_outreach_at timestamptz,
  first_outreach_channel text check (first_outreach_channel in ('email', 'text', 'call')),
  replied_at timestamptz,
  end_state text not null default 'open' check (end_state in ('open', 'sold', 'ended_no_response', 'removed')),
  ended_at timestamptz,
  offer_forwarded_at timestamptz,
  dealer_revealed boolean not null default false,
  dealer_latitude double precision,
  dealer_longitude double precision,
  visit_radius_meters integer,
  expected_pickup_date date,
  location_granted boolean,
  geofence_exit_at timestamptz,
  buy_prompt_sent_at timestamptz,
  buy_prompt_source text check (buy_prompt_source in ('geofence_exit', 'pickup_fallback')),
  bought boolean,
  final_price integer,
  outcome_answered_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint shopper_deal_lifecycle_visit_pair check (
    (dealer_latitude is null and dealer_longitude is null)
    or (dealer_latitude is not null and dealer_longitude is not null)
  ),
  constraint shopper_deal_lifecycle_lat check (
    dealer_latitude is null or (dealer_latitude >= -90 and dealer_latitude <= 90)
  ),
  constraint shopper_deal_lifecycle_lng check (
    dealer_longitude is null or (dealer_longitude >= -180 and dealer_longitude <= 180)
  ),
  constraint shopper_deal_lifecycle_radius check (
    visit_radius_meters is null or (visit_radius_meters between 50 and 500)
  ),
  constraint shopper_deal_lifecycle_price check (
    final_price is null or final_price >= 0
  )
);

create index if not exists shopper_deal_lifecycle_consumer
  on public.shopper_deal_lifecycle (consumer_user_id, added_at desc);

create index if not exists shopper_deal_lifecycle_pickup
  on public.shopper_deal_lifecycle (expected_pickup_date)
  where buy_prompt_sent_at is null and expected_pickup_date is not null;

alter table public.shopper_deal_lifecycle enable row level security;
alter table public.shopper_deal_lifecycle force row level security;

revoke all on public.shopper_deal_lifecycle from public, anon, authenticated;
grant select, insert, update, delete on public.shopper_deal_lifecycle to service_role;
