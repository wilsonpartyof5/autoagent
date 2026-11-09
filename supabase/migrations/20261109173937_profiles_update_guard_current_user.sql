-- Defense in depth for a direct SQL session. This does not close a
-- demonstrated Data API or RPC privilege escalation.
--
-- 20260910144654 and 20261109172331 left the BEFORE UPDATE guards as
-- SECURITY DEFINER functions that trust request.jwt.claim.role and
-- current_setting('role'). In a SQL session, set_config can set
-- request.jwt.claim.role to service_role without changing current_user.
-- This repository has no anon/authenticated function that does that
-- set_config or runs caller SQL. A shopper REST update is one statement
-- and cannot prefix itself with set_config.
--
-- These replacements match the INSERT trigger: SECURITY INVOKER, and an
-- allow-list of current_user in (postgres, supabase_admin, service_role).
-- They do not read a GUC. Signup is unchanged: handle_new_user stays
-- SECURITY DEFINER and inserts as its owner. A SECURITY DEFINER writer
-- owned by an allow-listed role still updates as that owner.

create or replace function private.prevent_platform_role_client_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor text;
begin
  if new.platform_role is not distinct from old.platform_role then
    return new;
  end if;

  actor := current_user::text;
  if actor in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  raise exception 'platform_role cannot be changed from the client';
end;
$$;

drop trigger if exists prevent_platform_role_client_change on public.profiles;
create trigger prevent_platform_role_client_change
  before update on public.profiles
  for each row
  execute function private.prevent_platform_role_client_change();

revoke all on function private.prevent_platform_role_client_change() from public;

create or replace function private.prevent_privileged_profile_client_change()
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

comment on function private.prevent_platform_role_client_change() is
  'Defense in depth. Client updates of platform_role are rejected unless current_user is postgres, supabase_admin, or service_role. Does not trust request.jwt.claim.role.';

comment on function private.prevent_privileged_profile_client_change() is
  'Defense in depth. Client updates of privileged profile columns are rejected unless current_user is postgres, supabase_admin, or service_role. Does not trust request.jwt.claim.role.';
