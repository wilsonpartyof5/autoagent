-- Opening facts on Drevvy's own deal record.
-- The listed price is the number we wrote into our outreach message, kept
-- with that message. It is not a MarketCheck inventory cache.
-- Apply after 20261012183301_deal_lifecycle.sql. Additive only.

alter table public.shopper_deal_lifecycle
  add column if not exists opening jsonb;

comment on column public.shopper_deal_lifecycle.opening is
  'Deal history for the two-question opener: listed price included in our message, when we included it, MarketCheck listing id, the dealer availability answer, and the price the dealer stated.';
