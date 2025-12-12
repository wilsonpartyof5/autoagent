-- Store MarketCheck dealership website for auto-detection
alter table profiles
  add column if not exists marketcheck_website_url text;

alter table dealerships
  add column if not exists marketcheck_website_url text;

