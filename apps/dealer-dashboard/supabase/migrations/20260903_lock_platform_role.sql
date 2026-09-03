-- Clients must not escalate themselves to platform_admin.
-- Service-role and superuser updates (admin client / SQL) still work.

create or replace function private.prevent_platform_role_client_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text;
  session_role text;
begin
  if new.platform_role is not distinct from old.platform_role then
    return new;
  end if;

  jwt_role := current_setting('request.jwt.claim.role', true);
  session_role := current_setting('role', true);

  if jwt_role = 'service_role'
     or session_role in ('service_role', 'postgres', 'supabase_admin') then
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
