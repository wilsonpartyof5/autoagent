-- Trim verification and the shared Telnyx contact number.
-- Apply after shopper_deals exists. Service role only.
-- deal_trim_checks flags a MarketCheck trim that disagrees with the dealer
-- page or a VIN decode, and keeps the sentence shown to the shopper.
-- contact_phone_disclosures remembers which deal gave a dealer
-- DREVVY_CONTACT_PHONE, so an inbound call or text can be logged on that deal.

create table if not exists public.deal_trim_checks (
  deal_id uuid primary key references public.shopper_deals(id) on delete cascade,
  marketcheck_trim text,
  vdp_trim text,
  vin_decode_trim text,
  verified_trim text,
  mismatch boolean not null default false,
  shopper_message text,
  checked_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.contact_phone_disclosures (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.shopper_deals(id) on delete cascade,
  dealer_id text,
  contact_phone_e164 text not null,
  dealer_phone_e164 text,
  vehicle_page_url text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists contact_phone_disclosures_phone_idx
  on public.contact_phone_disclosures (contact_phone_e164, created_at desc);

alter table public.deal_trim_checks enable row level security;
alter table public.deal_trim_checks force row level security;
revoke all on public.deal_trim_checks from public, anon, authenticated;
grant select, insert, update, delete on public.deal_trim_checks to service_role;

alter table public.contact_phone_disclosures enable row level security;
alter table public.contact_phone_disclosures force row level security;
revoke all on public.contact_phone_disclosures from public, anon, authenticated;
grant select, insert, update, delete on public.contact_phone_disclosures to service_role;
