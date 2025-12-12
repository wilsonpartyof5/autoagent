-- Add MarketCheck website URL columns to profiles and dealerships

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS marketcheck_website_url TEXT;

ALTER TABLE public.dealerships
ADD COLUMN IF NOT EXISTS marketcheck_website_url TEXT;
-- Store MarketCheck dealership website for auto-detection
alter table profiles
  add column if not exists marketcheck_website_url text;

alter table dealerships
  add column if not exists marketcheck_website_url text;

