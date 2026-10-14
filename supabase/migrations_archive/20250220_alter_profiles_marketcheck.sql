alter table profiles
  add column if not exists marketcheck_dealer_id text,
  add column if not exists marketcheck_zip text;
