-- HELD. DO NOT APPLY. This is not a migration.
-- The running code does not call these functions.
-- In-memory caps cover one process until this is reviewed and applied by hand.

-- One row per shopper per UTC day. Replaces the per-process cap of 20.
create table if not exists public.shopper_market_price_calls (
  user_id uuid not null,
  day date not null,
  calls integer not null default 0,
  primary key (user_id, day)
);

-- One row per UTC day for every shopper. Example ceiling: 200.
create table if not exists public.market_price_call_ceiling (
  day date primary key,
  calls integer not null default 0
);

-- Increments both counters only when each is still under its cap.
-- Returns true when this call may reach MarketCheck.
create or replace function public.consume_fair_price_call(
  p_user_id uuid,
  p_user_cap integer,
  p_global_cap integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (timezone('utc', now()))::date;
  v_user integer;
  v_global integer;
begin
  insert into public.market_price_call_ceiling (day, calls)
  values (v_day, 0)
  on conflict (day) do nothing;

  insert into public.shopper_market_price_calls (user_id, day, calls)
  values (p_user_id, v_day, 0)
  on conflict (user_id, day) do nothing;

  select calls into v_global
  from public.market_price_call_ceiling
  where day = v_day
  for update;

  select calls into v_user
  from public.shopper_market_price_calls
  where user_id = p_user_id and day = v_day
  for update;

  if v_global >= p_global_cap or v_user >= p_user_cap then
    return false;
  end if;

  update public.market_price_call_ceiling
  set calls = calls + 1
  where day = v_day;

  update public.shopper_market_price_calls
  set calls = calls + 1
  where user_id = p_user_id and day = v_day;

  return true;
end;
$$;

-- Optional later: reuse a finished card without a second paid chain.
-- Not required for the cap. Do not store a VIN the shopper typed.
create table if not exists public.market_intel_partials (
  listing_id text primary key,
  fair_price integer,
  no_fair_price boolean not null default false,
  expires_at timestamptz not null
);
