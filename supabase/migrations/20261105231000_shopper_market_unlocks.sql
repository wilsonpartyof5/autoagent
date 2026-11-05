-- Shopper Marketplace Intelligence unlock.
-- NOT APPLIED. Do not run this against production from this change.
--
-- A heart save stays in saved_cars and does not spend a key.
-- This table is the owner-only record that the shopper unlocked MI for a
-- listing, plus the MarketCheck snapshot from that unlock. Deleting the
-- heart does not delete the unlock.
--
-- consumer_profiles.zip is a five-digit market area. Email, phone, and
-- street address stay off that table.

alter table public.consumer_profiles
  add column if not exists zip text;

do $$ begin
  alter table public.consumer_profiles
    add constraint consumer_profiles_zip_check
    check (zip is null or zip ~ '^\d{5}$');
exception when duplicate_object then null;
end $$;

comment on column public.consumer_profiles.zip is
  'Optional five-digit market ZIP for fair-price lookup. Email, phone, and street address are not stored here.';

create table if not exists public.shopper_market_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null check (listing_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$'),
  market jsonb not null,
  unlocked_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, listing_id)
);

comment on table public.shopper_market_unlocks is
  'Owner unlock of Marketplace Intelligence. Distinct from saved_cars. One row per shopper and listing. The market snapshot is the value that was charged.';

alter table public.shopper_market_unlocks enable row level security;
alter table public.shopper_market_unlocks force row level security;

drop policy if exists "Shoppers read own market unlocks" on public.shopper_market_unlocks;
create policy "Shoppers read own market unlocks"
  on public.shopper_market_unlocks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.shopper_market_unlocks from anon, public;
revoke insert, update, delete on public.shopper_market_unlocks from authenticated;
grant select on public.shopper_market_unlocks to authenticated;
grant select, insert, update, delete on public.shopper_market_unlocks to service_role;

-- Charges one market_save key and stores the snapshot in the same transaction.
-- A second call for the same shopper and listing inserts nothing and charges nothing.
-- An empty or unreal market raises before any write, so the balance does not move.
create or replace function public.unlock_market_intel_atomic(
  p_user_id uuid,
  p_listing_id text,
  p_vin text,
  p_market jsonb
)
returns table(
  unlocked boolean,
  already_unlocked boolean,
  charged boolean,
  balance integer,
  market jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_balance integer;
  v_vin text;
  v_fair integer;
  v_low integer;
  v_median integer;
  v_high integer;
  v_comps integer;
  v_msrp integer;
  v_listed integer;
  v_new boolean;
  v_used_ok boolean;
  v_new_ok boolean;
  v_existing jsonb;
begin
  if p_listing_id is null or p_listing_id !~ '^[A-Za-z0-9_-]{4,64}$' then
    raise exception 'listing id is required';
  end if;
  if p_market is null or jsonb_typeof(p_market) <> 'object' then
    raise exception 'market intelligence has no value';
  end if;

  v_vin := nullif(upper(btrim(coalesce(p_vin, ''))), '');
  if v_vin is not null and v_vin !~ '^[A-HJ-NPR-Z0-9]{11,17}$' then
    raise exception 'vin is not valid';
  end if;

  v_fair := nullif(p_market->>'fairVehiclePrice', '')::integer;
  v_low := nullif(p_market->>'lowPrice', '')::integer;
  v_median := nullif(p_market->>'medianPrice', '')::integer;
  v_high := nullif(p_market->>'highPrice', '')::integer;
  v_comps := nullif(p_market->>'comparablesCount', '')::integer;
  v_msrp := nullif(p_market->>'msrp', '')::integer;
  v_listed := nullif(p_market->>'listedPrice', '')::integer;
  v_new := coalesce(p_market->>'isNewCar', '') = 'true';

  v_used_ok := v_fair is not null and v_fair > 0
    and coalesce(v_comps, 0) >= 3
    and v_low is not null and v_median is not null and v_high is not null
    and v_low > 0 and v_low <= v_median and v_median <= v_high;
  v_new_ok := v_new
    and v_msrp is not null and v_msrp > 0
    and v_listed is not null and v_listed > 0;

  if not v_used_ok and not v_new_ok then
    raise exception 'market intelligence has no value';
  end if;

  v_key := 'use:market_save:' || p_listing_id;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance
    into v_balance
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  select u.market
    into v_existing
  from public.shopper_market_unlocks u
  where u.user_id = p_user_id and u.listing_id = p_listing_id;

  if v_existing is not null then
    return query select true, true, false, coalesce(v_balance, 0), v_existing;
    return;
  end if;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = v_key
  ) then
    insert into public.shopper_market_unlocks (user_id, listing_id, vin, market)
    values (p_user_id, p_listing_id, v_vin, p_market);
    return query select true, true, false, coalesce(v_balance, 0), p_market;
    return;
  end if;

  if coalesce(v_balance, 0) < 1 then
    return query select false, false, false, coalesce(v_balance, 0), null::jsonb;
    return;
  end if;

  insert into public.shopper_credit_events (
    user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key
  )
  values (p_user_id, 'use', 1, p_listing_id, 'market_save', 'market_intel', v_key);

  update public.shopper_credits
  set balance = shopper_credits.balance - 1,
      lifetime_used = shopper_credits.lifetime_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and shopper_credits.balance >= 1
  returning shopper_credits.balance into v_balance;

  if not found then
    raise exception 'key was not consumed';
  end if;

  insert into public.shopper_market_unlocks (user_id, listing_id, vin, market)
  values (p_user_id, p_listing_id, v_vin, p_market);

  return query select true, false, true, v_balance, p_market;
exception
  when unique_violation then
    select c.balance into v_balance
    from public.shopper_credits c
    where c.user_id = p_user_id;
    select u.market into v_existing
    from public.shopper_market_unlocks u
    where u.user_id = p_user_id and u.listing_id = p_listing_id;
    if v_existing is null then
      insert into public.shopper_market_unlocks (user_id, listing_id, vin, market)
      values (p_user_id, p_listing_id, v_vin, p_market)
      on conflict (user_id, listing_id) do nothing;
      select u.market into v_existing
      from public.shopper_market_unlocks u
      where u.user_id = p_user_id and u.listing_id = p_listing_id;
    end if;
    return query select true, true, false, coalesce(v_balance, 0), coalesce(v_existing, p_market);
end;
$$;

revoke execute on function public.unlock_market_intel_atomic(uuid, text, text, jsonb) from anon, authenticated, public;
grant execute on function public.unlock_market_intel_atomic(uuid, text, text, jsonb) to service_role;
