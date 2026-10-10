-- Dealer inventory identity: VIN belongs to a rooftop, not the whole platform.

alter table public.uvs_vehicles
  add column if not exists dealership_id uuid references public.dealerships(id);

create index if not exists idx_uvs_vehicles_dealership_id
  on public.uvs_vehicles (dealership_id);

update public.uvs_vehicles v
set dealership_id = (
  select d.id
  from public.dealerships d
  where d.marketcheck_dealer_id = v.dealer_id
  order by d.created_at
  limit 1
)
where v.dealership_id is null
  and v.dealer_id is not null;

drop index if exists idx_uvs_vehicles_vin_unique;

update public.uvs_vehicles
set vin = upper(vin)
where vin is not null
  and vin <> upper(vin);

create unique index if not exists idx_uvs_vehicles_dealership_vin
  on public.uvs_vehicles (dealership_id, upper(vin))
  where vin is not null and dealership_id is not null;

create or replace function private.user_can_access_uvs_vehicle(
  target_dealership_id uuid,
  target_dealer_id text
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    (select private.is_platform_admin())
    or (
      target_dealership_id is not null
      and exists (
        select 1
        from public.user_dealerships ud
        where ud.user_id = (select auth.uid())
          and ud.dealership_id = target_dealership_id
      )
    )
    or (
      target_dealership_id is null
      and (select private.user_has_dealer_access(target_dealer_id))
    );
$$;

revoke all on function private.user_can_access_uvs_vehicle(uuid, text) from public, anon;
grant execute on function private.user_can_access_uvs_vehicle(uuid, text) to authenticated;

drop policy if exists "Users can view vehicles for their dealership" on public.uvs_vehicles;
drop policy if exists "Authenticated users can view available vehicles" on public.uvs_vehicles;
drop policy if exists "Members can view rooftop vehicles" on public.uvs_vehicles;
drop policy if exists "Members can update rooftop vehicles" on public.uvs_vehicles;

create policy "Members can view rooftop vehicles"
  on public.uvs_vehicles for select to authenticated
  using ((select private.user_can_access_uvs_vehicle(dealership_id, dealer_id)));

create policy "Members can update rooftop vehicles"
  on public.uvs_vehicles for update to authenticated
  using ((select private.user_can_access_uvs_vehicle(dealership_id, dealer_id)))
  with check ((select private.user_can_access_uvs_vehicle(dealership_id, dealer_id)));
