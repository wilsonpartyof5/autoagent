-- Lock private rooms: transactional rooftop create, created_by ownership,
-- and block client writes to privileged profile columns.

alter table public.dealerships
  add column if not exists created_by uuid references auth.users(id);

update public.dealerships d
set created_by = (
  select ud.user_id
  from public.user_dealerships ud
  where ud.dealership_id = d.id
    and ud.role = 'owner'
  order by ud.created_at
  limit 1
)
where d.created_by is null;

create or replace function public.create_own_dealership(
  p_name text,
  p_marketcheck_dealer_id text default null,
  p_marketcheck_zip text default null,
  p_marketcheck_website_url text default null,
  p_logo_url text default null
)
returns public.dealerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  created public.dealerships;
begin
  uid := (select auth.uid());
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.dealerships (
    name,
    marketcheck_dealer_id,
    marketcheck_zip,
    marketcheck_website_url,
    logo_url,
    created_by
  ) values (
    p_name,
    p_marketcheck_dealer_id,
    p_marketcheck_zip,
    p_marketcheck_website_url,
    p_logo_url,
    uid
  )
  returning * into created;

  insert into public.user_dealerships (user_id, dealership_id, role)
  values (uid, created.id, 'owner');

  return created;
end;
$$;

revoke all on function public.create_own_dealership(text, text, text, text, text) from public;
grant execute on function public.create_own_dealership(text, text, text, text, text) to authenticated;

create or replace function private.prevent_privileged_profile_client_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
  session_role text;
begin
  jwt_role := current_setting('request.jwt.claim.role', true);
  session_role := current_setting('role', true);

  if jwt_role = 'service_role'
     or session_role in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if new.platform_role is distinct from old.platform_role
     or new.marketcheck_dealer_id is distinct from old.marketcheck_dealer_id
     or new.inventory_connected is distinct from old.inventory_connected
     or new.billing_active is distinct from old.billing_active
     or new.dms_provider is distinct from old.dms_provider
     or new.marketcheck_zip is distinct from old.marketcheck_zip
     or new.marketcheck_website_url is distinct from old.marketcheck_website_url
     or new.lead_delivery_method is distinct from old.lead_delivery_method
     or new.lead_delivery_endpoint is distinct from old.lead_delivery_endpoint
     or new.lead_delivery_email is distinct from old.lead_delivery_email
  then
    raise exception 'privileged profile fields cannot be changed from the client';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_privileged_profile_client_change on public.profiles;
create trigger prevent_privileged_profile_client_change
  before update on public.profiles
  for each row
  execute function private.prevent_privileged_profile_client_change();

revoke all on function private.prevent_privileged_profile_client_change() from public;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
