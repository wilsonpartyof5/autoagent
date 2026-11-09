-- SEC-02: shoppers cannot create or claim a rooftop.
--
-- create_own_dealership was security definer and granted to authenticated, so any
-- shopper JWT became owner of a dealership and could set a MarketCheck id or
-- website. In-network matching treats those as the rooftop for that dealer.
--
-- After this migration:
--   * client roles cannot execute create_own_dealership
--   * a rooftop is created by service_role (create_onboarded_rooftop) or by
--     accepting an operator-issued dealership_invites row
--   * onboarded_at is set only on those paths
--   * MarketCheck dealer id and normalized website are unique
--   * client sessions cannot insert dealerships or memberships, and cannot
--     change network identity columns
--
-- Existing member rooftops are backfilled so current dealer logins stay
-- in-network. The demo desk at /dealer/onboarding does not write these tables.
--
-- Rollback is a forward migration, not an edit of this file. See the PR.

create schema if not exists private;
revoke all on schema private from public;

create or replace function public.rooftop_website_key(raw text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  value text;
  host text;
  path text;
  slash int;
begin
  value := nullif(btrim(raw), '');
  if value is null then
    return null;
  end if;
  if value !~* '^https?://' then
    value := 'https://' || value;
  end if;
  value := regexp_replace(value, '^https?://', '', 'i');
  value := regexp_replace(value, '[?#].*$', '');
  value := regexp_replace(value, '/+$', '');
  if value = '' then
    return null;
  end if;

  slash := strpos(value, '/');
  if slash = 0 then
    host := value;
    path := '';
  else
    host := substring(value from 1 for slash - 1);
    path := substring(value from slash + 1);
  end if;

  host := lower(host);
  host := regexp_replace(host, '\.+$', '');
  host := regexp_replace(host, ':(80|443)$', '');
  host := regexp_replace(host, '^www\.', '');
  path := lower(regexp_replace(path, '/+$', ''));

  if host = '' or position(' ' in host) > 0 then
    return null;
  end if;
  if path = '' then
    return host;
  end if;
  return host || '/' || path;
end;
$$;

comment on function public.rooftop_website_key(text) is
  'Uniqueness key for dealerships.marketcheck_website_url. Host plus path, lowercased, www and default port stripped. Matching in the app uses the same shape.';

revoke all on function public.rooftop_website_key(text) from public, anon, authenticated;
grant execute on function public.rooftop_website_key(text) to service_role;

alter table public.dealerships
  add column if not exists onboarded_at timestamptz;

comment on column public.dealerships.onboarded_at is
  'Set when an operator or an accepted invite puts this rooftop on the network. A membership alone is not enough.';

update public.dealerships
set marketcheck_dealer_id = null
where marketcheck_dealer_id is not null
  and btrim(marketcheck_dealer_id) = '';

update public.dealerships
set marketcheck_website_url = null
where marketcheck_website_url is not null
  and btrim(marketcheck_website_url) = '';

do $$
declare
  dup_mc text;
  dup_site text;
begin
  select btrim(marketcheck_dealer_id)
    into dup_mc
  from public.dealerships
  where marketcheck_dealer_id is not null
    and btrim(marketcheck_dealer_id) <> ''
  group by btrim(marketcheck_dealer_id)
  having count(*) > 1
  limit 1;

  if dup_mc is not null then
    raise exception
      'duplicate marketcheck_dealer_id % must be resolved before locking rooftop claims',
      dup_mc;
  end if;

  select public.rooftop_website_key(marketcheck_website_url)
    into dup_site
  from public.dealerships
  where public.rooftop_website_key(marketcheck_website_url) is not null
  group by public.rooftop_website_key(marketcheck_website_url)
  having count(*) > 1
  limit 1;

  if dup_site is not null then
    raise exception
      'duplicate rooftop website % must be resolved before locking rooftop claims',
      dup_site;
  end if;
end $$;

create unique index if not exists dealerships_marketcheck_dealer_id_key
  on public.dealerships (btrim(marketcheck_dealer_id))
  where marketcheck_dealer_id is not null
    and btrim(marketcheck_dealer_id) <> '';

create unique index if not exists dealerships_website_key
  on public.dealerships (public.rooftop_website_key(marketcheck_website_url))
  where public.rooftop_website_key(marketcheck_website_url) is not null;

update public.dealerships d
set onboarded_at = coalesce(d.created_at, timezone('utc'::text, now()))
where d.onboarded_at is null
  and exists (
    select 1
    from public.user_dealerships ud
    where ud.dealership_id = d.id
  );

create or replace function private.caller_can_provision_rooftop()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  jwt_role text;
  session_role text;
begin
  jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
  session_role := current_setting('role', true);

  -- PostgREST copies the verified JWT role into request.jwt.claim.role.
  -- A security definer body must not treat current_user/postgres as the caller.
  if jwt_role = 'service_role' or session_role = 'service_role' then
    return true;
  end if;

  if jwt_role in ('authenticated', 'anon') or session_role in ('authenticated', 'anon') then
    if to_regprocedure('private.is_platform_admin()') is not null
       and coalesce((select private.is_platform_admin()), false) then
      return true;
    end if;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function private.caller_can_provision_rooftop() from public, anon, authenticated;

create or replace function private.assert_rooftop_identity_available(
  p_marketcheck_dealer_id text,
  p_marketcheck_website_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mc text;
  v_key text;
begin
  v_mc := nullif(btrim(coalesce(p_marketcheck_dealer_id, '')), '');
  v_key := public.rooftop_website_key(p_marketcheck_website_url);

  if v_mc is not null and exists (
    select 1
    from public.dealerships d
    where d.marketcheck_dealer_id is not null
      and btrim(d.marketcheck_dealer_id) = v_mc
  ) then
    raise exception 'marketcheck dealer id is already claimed';
  end if;

  if v_key is not null and exists (
    select 1
    from public.dealerships d
    where public.rooftop_website_key(d.marketcheck_website_url) = v_key
  ) then
    raise exception 'rooftop website is already claimed';
  end if;
end;
$$;

revoke all on function private.assert_rooftop_identity_available(text, text) from public, anon, authenticated;

create or replace function private.create_onboarded_rooftop(
  p_owner uuid,
  p_name text,
  p_marketcheck_dealer_id text,
  p_marketcheck_zip text,
  p_marketcheck_website_url text,
  p_logo_url text,
  p_role text
)
returns public.dealerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.dealerships;
  v_name text;
  v_mc text;
  v_zip text;
  v_site text;
  v_logo text;
  v_role text;
begin
  if p_owner is null then
    raise exception 'rooftop owner is required';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    raise exception 'rooftop name is required';
  end if;

  v_role := coalesce(nullif(btrim(coalesce(p_role, '')), ''), 'owner');
  if v_role not in ('owner', 'gm', 'owner_gm', 'sales_manager', 'salesperson', 'bdc') then
    raise exception 'invalid rooftop role';
  end if;

  v_mc := nullif(btrim(coalesce(p_marketcheck_dealer_id, '')), '');
  v_zip := nullif(btrim(coalesce(p_marketcheck_zip, '')), '');
  v_site := nullif(btrim(coalesce(p_marketcheck_website_url, '')), '');
  v_logo := nullif(btrim(coalesce(p_logo_url, '')), '');

  perform private.assert_rooftop_identity_available(v_mc, v_site);

  insert into public.dealerships (
    name,
    marketcheck_dealer_id,
    marketcheck_zip,
    marketcheck_website_url,
    logo_url,
    created_by,
    onboarded_at
  ) values (
    v_name,
    v_mc,
    v_zip,
    v_site,
    v_logo,
    p_owner,
    timezone('utc'::text, now())
  )
  returning * into created;

  insert into public.user_dealerships (user_id, dealership_id, role)
  values (p_owner, created.id, v_role)
  on conflict (user_id, dealership_id) do nothing;

  return created;
exception
  when unique_violation then
    raise exception 'rooftop identity is already claimed';
end;
$$;

revoke all on function private.create_onboarded_rooftop(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;

create or replace function private.guard_rooftop_network_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'rooftops cannot be created from the client';
  end if;

  if new.marketcheck_dealer_id is distinct from old.marketcheck_dealer_id
     or new.marketcheck_website_url is distinct from old.marketcheck_website_url
     or new.onboarded_at is distinct from old.onboarded_at
     or new.created_by is distinct from old.created_by
  then
    raise exception 'rooftop network identity cannot be changed from the client';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_rooftop_network_identity on public.dealerships;
create trigger guard_rooftop_network_identity
  before insert or update on public.dealerships
  for each row
  execute function private.guard_rooftop_network_identity();

revoke all on function private.guard_rooftop_network_identity() from public, anon, authenticated;

create or replace function private.guard_rooftop_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'rooftop membership cannot be created from the client';
  end if;

  if new.user_id is distinct from old.user_id
     or new.dealership_id is distinct from old.dealership_id
     or new.role is distinct from old.role
  then
    raise exception 'rooftop membership cannot be changed from the client';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_rooftop_membership on public.user_dealerships;
create trigger guard_rooftop_membership
  before insert or update on public.user_dealerships
  for each row
  execute function private.guard_rooftop_membership();

revoke all on function private.guard_rooftop_membership() from public, anon, authenticated;

drop function if exists public.create_own_dealership(text, text, text, text, text);

create function public.create_own_dealership(
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
begin
  if not private.caller_can_provision_rooftop() then
    raise exception 'shoppers cannot create or claim a rooftop';
  end if;

  uid := (select auth.uid());
  if uid is null then
    raise exception 'operator rooftop create needs a user; call create_onboarded_rooftop';
  end if;

  return private.create_onboarded_rooftop(
    uid,
    p_name,
    p_marketcheck_dealer_id,
    p_marketcheck_zip,
    p_marketcheck_website_url,
    p_logo_url,
    'owner'
  );
end;
$$;

comment on function public.create_own_dealership(text, text, text, text, text) is
  'Operator-only. Shopper JWTs cannot execute this. Use create_onboarded_rooftop or accept_dealership_invite.';

revoke all on function public.create_own_dealership(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_own_dealership(text, text, text, text, text)
  to service_role;

create function public.create_onboarded_rooftop(
  p_owner_user_id uuid,
  p_name text,
  p_marketcheck_dealer_id text default null,
  p_marketcheck_zip text default null,
  p_marketcheck_website_url text default null,
  p_logo_url text default null,
  p_role text default 'owner'
)
returns public.dealerships
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.caller_can_provision_rooftop() then
    raise exception 'shoppers cannot create or claim a rooftop';
  end if;

  return private.create_onboarded_rooftop(
    p_owner_user_id,
    p_name,
    p_marketcheck_dealer_id,
    p_marketcheck_zip,
    p_marketcheck_website_url,
    p_logo_url,
    p_role
  );
end;
$$;

comment on function public.create_onboarded_rooftop(uuid, text, text, text, text, text, text) is
  'Operator path. service_role creates an onboarded rooftop and one membership. Not granted to shoppers.';

revoke all on function public.create_onboarded_rooftop(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_onboarded_rooftop(uuid, text, text, text, text, text, text)
  to service_role;

drop policy if exists "Allow authenticated insert into dealerships" on public.dealerships;
drop policy if exists "Users can insert dealerships" on public.dealerships;
drop policy if exists "Users can insert their memberships" on public.user_dealerships;

revoke insert on table public.dealerships from public, anon, authenticated;
revoke insert on table public.user_dealerships from public, anon, authenticated;

create table if not exists public.dealership_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  dealership_id uuid references public.dealerships(id),
  name text,
  marketcheck_dealer_id text,
  marketcheck_zip text,
  marketcheck_website_url text,
  logo_url text,
  role text not null default 'owner',
  invited_by uuid,
  expires_at timestamptz not null,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint dealership_invites_target_check check (
    dealership_id is not null
    or (name is not null and length(btrim(name)) > 0)
  )
);

comment on table public.dealership_invites is
  'Operator-issued rooftop invite. The token is the secret. Client roles cannot read this table. Accepting it is the only authenticated create path, and the MarketCheck id and website are the ones the operator stored.';

alter table public.dealership_invites enable row level security;

revoke all on table public.dealership_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.dealership_invites to service_role;

create or replace function public.issue_dealership_invite(
  p_name text default null,
  p_marketcheck_dealer_id text default null,
  p_marketcheck_zip text default null,
  p_marketcheck_website_url text default null,
  p_logo_url text default null,
  p_role text default 'owner',
  p_dealership_id uuid default null,
  p_expires_at timestamptz default null,
  p_token text default null
)
returns table (invite_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_role text;
  v_expires timestamptz;
  v_id uuid;
begin
  if not private.caller_can_provision_rooftop() then
    raise exception 'shoppers cannot create or claim a rooftop';
  end if;

  v_role := coalesce(nullif(btrim(coalesce(p_role, '')), ''), 'owner');
  if v_role not in ('owner', 'gm', 'owner_gm', 'sales_manager', 'salesperson', 'bdc') then
    raise exception 'invalid rooftop role';
  end if;

  if p_dealership_id is null then
    if p_name is null or btrim(p_name) = '' then
      raise exception 'rooftop name is required';
    end if;
    perform private.assert_rooftop_identity_available(
      p_marketcheck_dealer_id,
      p_marketcheck_website_url
    );
    if nullif(btrim(coalesce(p_marketcheck_dealer_id, '')), '') is not null
       and exists (
         select 1
         from public.dealership_invites i
         where i.accepted_at is null
           and i.expires_at > timezone('utc'::text, now())
           and i.dealership_id is null
           and btrim(coalesce(i.marketcheck_dealer_id, ''))
             = btrim(p_marketcheck_dealer_id)
       ) then
      raise exception 'marketcheck dealer id is already claimed';
    end if;
    if public.rooftop_website_key(p_marketcheck_website_url) is not null
       and exists (
         select 1
         from public.dealership_invites i
         where i.accepted_at is null
           and i.expires_at > timezone('utc'::text, now())
           and public.rooftop_website_key(i.marketcheck_website_url)
             = public.rooftop_website_key(p_marketcheck_website_url)
       ) then
      raise exception 'rooftop website is already claimed';
    end if;
  elsif not exists (
    select 1 from public.dealerships d where d.id = p_dealership_id
  ) then
    raise exception 'rooftop not found';
  end if;

  v_token := nullif(btrim(coalesce(p_token, '')), '');
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
  elsif length(v_token) < 20 then
    raise exception 'invite token is too short';
  end if;

  v_expires := coalesce(p_expires_at, timezone('utc'::text, now()) + interval '14 days');
  if v_expires <= timezone('utc'::text, now()) then
    raise exception 'invite expired';
  end if;

  insert into public.dealership_invites (
    token,
    dealership_id,
    name,
    marketcheck_dealer_id,
    marketcheck_zip,
    marketcheck_website_url,
    logo_url,
    role,
    invited_by,
    expires_at
  ) values (
    v_token,
    p_dealership_id,
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_marketcheck_dealer_id, '')), ''),
    nullif(btrim(coalesce(p_marketcheck_zip, '')), ''),
    nullif(btrim(coalesce(p_marketcheck_website_url, '')), ''),
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    v_role,
    (select auth.uid()),
    v_expires
  )
  returning id into v_id;

  return query select v_id, v_token;
end;
$$;

comment on function public.issue_dealership_invite(text, text, text, text, text, text, uuid, timestamptz, text) is
  'Operator path. Binds the rooftop identity. The caller receives the token once. Not granted to shoppers.';

revoke all on function public.issue_dealership_invite(text, text, text, text, text, text, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.issue_dealership_invite(text, text, text, text, text, text, uuid, timestamptz, text)
  to service_role;

create or replace function public.accept_dealership_invite(p_token text)
returns public.dealerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  invite public.dealership_invites;
  created public.dealerships;
begin
  uid := (select auth.uid());
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_token is null or length(btrim(p_token)) < 20 then
    raise exception 'invite not found';
  end if;

  select *
    into invite
  from public.dealership_invites
  where token = btrim(p_token)
  for update;

  if not found then
    raise exception 'invite not found';
  end if;

  if invite.accepted_at is not null then
    if invite.accepted_by = uid and invite.dealership_id is not null then
      select * into created
      from public.dealerships
      where id = invite.dealership_id;
      if not found then
        raise exception 'invite not found';
      end if;
      return created;
    end if;
    raise exception 'invite already used';
  end if;

  if invite.expires_at <= timezone('utc'::text, now()) then
    raise exception 'invite expired';
  end if;

  if invite.dealership_id is null then
    created := private.create_onboarded_rooftop(
      uid,
      invite.name,
      invite.marketcheck_dealer_id,
      invite.marketcheck_zip,
      invite.marketcheck_website_url,
      invite.logo_url,
      invite.role
    );
  else
    select * into created
    from public.dealerships
    where id = invite.dealership_id;
    if not found then
      raise exception 'invite not found';
    end if;

    insert into public.user_dealerships (user_id, dealership_id, role)
    values (uid, created.id, invite.role)
    on conflict (user_id, dealership_id) do nothing;

    update public.dealerships
    set onboarded_at = coalesce(onboarded_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    where id = created.id
    returning * into created;
  end if;

  update public.dealership_invites
  set accepted_by = uid,
      accepted_at = timezone('utc'::text, now()),
      dealership_id = created.id
  where id = invite.id;

  return created;
end;
$$;

comment on function public.accept_dealership_invite(text) is
  'Authenticated dealers redeem an operator invite. The function ignores any caller-supplied MarketCheck id or website.';

revoke all on function public.accept_dealership_invite(text) from public, anon;
grant execute on function public.accept_dealership_invite(text) to authenticated, service_role;
