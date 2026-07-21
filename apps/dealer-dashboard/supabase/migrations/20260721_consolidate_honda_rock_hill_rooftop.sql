-- Consolidate the stale Honda Rock Hill / 1283655 rooftop into the canonical
-- Honda Cars Of Rock Hill / 1038994 rooftop that owns the live UVS inventory.
do $$
declare
  canonical_dealership_id uuid;
  stale_dealership_id uuid;
begin
  select id
  into canonical_dealership_id
  from public.dealerships
  where marketcheck_dealer_id = '1038994';

  if canonical_dealership_id is null then
    raise exception 'Canonical Honda Cars Of Rock Hill dealership 1038994 is missing';
  end if;

  select id
  into stale_dealership_id
  from public.dealerships
  where marketcheck_dealer_id = '1283655';

  update public.dealerships canonical
  set
    name = 'Honda Cars Of Rock Hill',
    marketcheck_website_url = coalesce(
      canonical.marketcheck_website_url,
      (select stale.marketcheck_website_url
       from public.dealerships stale
       where stale.id = stale_dealership_id),
      'hondacarsrockhill.com'
    ),
    marketcheck_zip = coalesce(
      canonical.marketcheck_zip,
      (select stale.marketcheck_zip
       from public.dealerships stale
       where stale.id = stale_dealership_id),
      '29715'
    ),
    updated_at = timezone('utc'::text, now())
  where canonical.id = canonical_dealership_id;

  if stale_dealership_id is not null then
    insert into public.user_dealerships (user_id, dealership_id, role)
    select user_id, canonical_dealership_id, role
    from public.user_dealerships
    where dealership_id = stale_dealership_id
    on conflict do nothing;

    update public.user_preferences
    set
      active_dealership_id = canonical_dealership_id,
      updated_at = timezone('utc'::text, now())
    where active_dealership_id = stale_dealership_id;

    update public.inventory_vehicles
    set
      dealership_id = canonical_dealership_id,
      dealer_id = '1038994',
      updated_at = timezone('utc'::text, now())
    where dealership_id = stale_dealership_id
       or dealer_id = '1283655';

    update public.leads
    set dealer_id = '1038994'
    where dealer_id = '1283655';

    update public.uvs_vehicles
    set
      dealer_id = '1038994',
      updated_at = timezone('utc'::text, now())
    where dealer_id = '1283655';

    delete from public.dealerships
    where id = stale_dealership_id;
  end if;
end;
$$;
