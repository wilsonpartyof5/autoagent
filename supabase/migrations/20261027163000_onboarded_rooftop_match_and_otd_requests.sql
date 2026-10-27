-- Onboarded rooftop match + off-network OTD requests (DECIDED 2026-10-27).
-- A dealer conversation starts only when the listing matches a dealerships
-- rooftop that has at least one user_dealerships membership.
-- Off-network OTD requests are analytics/acquisition only. Not chat. Not Telnyx.

create table if not exists public.off_network_otd_requests (
  id uuid primary key default gen_random_uuid(),
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null check (listing_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  listing_url text,
  dealer_domain text,
  marketcheck_dealer_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (consumer_user_id, listing_id)
);

comment on table public.off_network_otd_requests is
  'Shopper asked for an out-the-door number from a dealership that is not an onboarded rooftop. Not a chat thread.';

create index if not exists off_network_otd_requests_created_idx
  on public.off_network_otd_requests (created_at desc);

alter table public.off_network_otd_requests enable row level security;
alter table public.off_network_otd_requests force row level security;

drop policy if exists "Shoppers read own otd requests" on public.off_network_otd_requests;
create policy "Shoppers read own otd requests"
  on public.off_network_otd_requests
  for select
  to authenticated
  using ((select auth.uid()) = consumer_user_id);

revoke all on public.off_network_otd_requests from public, anon;
revoke insert, update, delete on public.off_network_otd_requests from authenticated;
grant select on public.off_network_otd_requests to authenticated;
grant select, insert, update, delete on public.off_network_otd_requests to service_role;

create table if not exists public.shopper_dealer_conversations (
  deal_id uuid primary key references public.shopper_deals(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null check (listing_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  rooftop_id uuid not null references public.dealerships(id),
  match_method text not null check (match_method in ('marketcheck_dealer_id', 'listing_url', 'dealer_domain')),
  channel text not null default 'in_app_message' check (channel = 'in_app_message'),
  shopper_known boolean not null default true check (shopper_known),
  shopper_first_name text,
  opener text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.shopper_dealer_conversations is
  'In-network dealer chat. Message-only. The dealer sees the shopper first name only. Itemized best OTD at signup terms.';

comment on column public.shopper_dealer_conversations.channel is
  'in_app_message only. Do not wire Telnyx on this row.';

comment on column public.shopper_dealer_conversations.shopper_first_name is
  'First token of the shopper name. Never last name, email, or phone.';

create index if not exists shopper_dealer_conversations_rooftop_idx
  on public.shopper_dealer_conversations (rooftop_id, created_at desc);

alter table public.shopper_dealer_conversations enable row level security;
alter table public.shopper_dealer_conversations force row level security;

drop policy if exists "Shoppers read own dealer conversations" on public.shopper_dealer_conversations;
create policy "Shoppers read own dealer conversations"
  on public.shopper_dealer_conversations
  for select
  to authenticated
  using ((select auth.uid()) = consumer_user_id);

revoke all on public.shopper_dealer_conversations from public, anon;
revoke insert, update, delete on public.shopper_dealer_conversations from authenticated;
grant select on public.shopper_dealer_conversations to authenticated;
grant select, insert, update, delete on public.shopper_dealer_conversations to service_role;

-- Day-7 no-reply clock starts at confirmed delivery, not send/outreach.
-- shopper_deal_lifecycle is opt-in (NOT APPLIED by default). Skip if missing.
alter table if exists public.shopper_deal_lifecycle
  add column if not exists delivery_confirmed_at timestamptz;

do $$
begin
  if to_regclass('public.shopper_deal_lifecycle') is not null then
    execute $c$
      comment on column public.shopper_deal_lifecycle.delivery_confirmed_at is
        'Confirmed delivery of the first in-app dealer message. Day-7 no-reply refund clock starts here.';
    $c$;
  end if;
end $$;

-- $300 close fee when the shopper confirms a purchase. Stripe is not connected; rows stay due.
create table if not exists public.dealer_close_fees (
  deal_id uuid primary key references public.shopper_deals(id) on delete cascade,
  rooftop_id uuid references public.dealerships(id),
  amount_cents integer not null default 30000 check (amount_cents = 30000),
  reason text not null default 'shopper_confirmed_purchase'
    check (reason = 'shopper_confirmed_purchase'),
  status text not null default 'due' check (status in ('due', 'invoiced', 'paid', 'void')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.dealer_close_fees is
  'Dealer pays $300 when the shopper confirms a purchase. Not when a dealer marks the car sold. Stripe is not connected; rows stay due.';

create index if not exists dealer_close_fees_rooftop_idx
  on public.dealer_close_fees (rooftop_id, created_at desc);

alter table public.dealer_close_fees enable row level security;
alter table public.dealer_close_fees force row level security;

revoke all on public.dealer_close_fees from public, anon, authenticated;
grant select, insert, update, delete on public.dealer_close_fees to service_role;
