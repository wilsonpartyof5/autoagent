-- SEC-23: a shopper with no profiles row can POST /rest/v1/profiles and set
-- platform_role = platform_admin. anon and authenticated still have INSERT,
-- the archived policy "Users can insert own profile" (auth.uid() = id) was
-- never dropped, and both role guards are BEFORE UPDATE only.
--
-- Apple sign-in (and Google, when that migration is applied) does not insert
-- a profiles row, so the shopper is the one who creates it.
--
-- This migration does not replace public.handle_new_user(). That function is
-- SECURITY DEFINER and inserts as its owner (postgres), which keeps the
-- privilege after the revoke below and is allow-listed by the insert trigger.

revoke insert on table public.profiles from public, anon, authenticated;

drop policy if exists "Users can insert own profile" on public.profiles;

create schema if not exists private;

-- SECURITY INVOKER so current_user is the role that issued the INSERT.
-- The update guards are SECURITY DEFINER, which would make current_user the
-- function owner and skip this check. The allow-list matches those guards:
-- postgres, supabase_admin, and service_role.
create or replace function private.coerce_client_profile_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor text;
begin
  actor := current_user::text;

  if actor in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  new.platform_role := 'dealer_user';
  new.marketcheck_dealer_id := null;
  new.marketcheck_zip := null;
  new.marketcheck_website_url := null;
  new.lead_delivery_method := null;
  new.lead_delivery_endpoint := null;
  new.lead_delivery_email := null;
  -- Same privileged columns the update guard rejects, so a re-granted INSERT
  -- cannot plant a value the client is forbidden to change later.
  new.inventory_connected := false;
  new.billing_active := false;
  new.dms_provider := null;

  return new;
end;
$$;

drop trigger if exists coerce_client_profile_insert on public.profiles;
create trigger coerce_client_profile_insert
  before insert on public.profiles
  for each row
  execute function private.coerce_client_profile_insert();

revoke all on function private.coerce_client_profile_insert() from public;

-- Re-assert the BEFORE UPDATE guard. Its role check is unchanged. The column
-- list is the full privileged set: platform_role, MarketCheck, lead delivery,
-- inventory_connected, billing_active, and dms_provider.
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

comment on function private.coerce_client_profile_insert() is
  'Client inserts of public.profiles are forced to dealer_user. postgres, supabase_admin, and service_role keep the row they wrote. Signup uses SECURITY DEFINER handle_new_user and is unaffected.';
