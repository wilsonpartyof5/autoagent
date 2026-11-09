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
--   * onboarded_at is set only on those paths, or for an explicit
--     (dealership uuid, user uuid) pair in private.reviewed_rooftop_members
--   * that pair table is created empty. A MarketCheck id, an Apple or Google
--     sign-in, or a consumer_profiles row is not a pair and is not a stamp
--   * every existing user_dealerships row is kept. This file does not delete
--     memberships. An unverified membership does not grant RLS access
--   * MarketCheck dealer id and normalized website are unique
--   * client sessions cannot insert dealerships or memberships, and cannot
--     change network identity columns or access_verified_at
--
-- Duplicate checks run before any dealership or membership update. The file
-- must run as one transaction, and it locks dealerships and user_dealerships
-- so a concurrent insert cannot land between the duplicate check and the
-- unique indexes. The demo desk at /dealer/onboarding does not write these
-- tables.
--
-- An empty reviewed-pair table, or any rooftop that still holds a MarketCheck
-- id or website, does not apply unless this same transaction sets
-- drevvy.approve_unpaired_rooftop_lockout to accept-unpaired-lockout. That
-- phrase is an approval, not a rooftop id. Without it, the migration raises
-- and writes nothing.
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

-- Dropped at commit. A later statement that cannot see this table aborts
-- before it updates dealerships or memberships, which is what happens if the
-- file is applied one statement at a time.
create temporary table rooftop_lock_txn_guard (
  ok boolean primary key
) on commit drop;
insert into rooftop_lock_txn_guard (ok) values (true);

-- Runs before any column add or row update. The locks last until commit.
do $$
declare
  dup_mc text;
  dup_site text;
begin
  if to_regclass('pg_temp.rooftop_lock_txn_guard') is null then
    raise exception '20261109170000 must run inside a single transaction';
  end if;

  -- Held until this transaction ends. Concurrent rooftop and membership
  -- writes wait. Reads do not. A runner that autocommits each statement
  -- releases the lock before the next statement, and the guard above then
  -- aborts before any row update.
  lock table public.dealerships in share row exclusive mode;
  lock table public.user_dealerships in share row exclusive mode;

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

-- Explicit pairs only. Leave this table empty until DW has verified the
-- provenance of a specific membership. Do not paste a MarketCheck id, and do
-- not infer a pair from a sign-in provider or from consumer_profiles.
create table if not exists private.reviewed_rooftop_members (
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (dealership_id, user_id)
);

comment on table private.reviewed_rooftop_members is
  'Reviewed (dealership uuid, user uuid) pairs. Empty in this migration. A row here is the only backfill that can stamp an existing membership. It does not create a membership.';

revoke all on table private.reviewed_rooftop_members from public, anon, authenticated;
grant select, insert, delete on table private.reviewed_rooftop_members to service_role;

-- DW: paste reviewed pairs below, one existing membership per row, and only
-- after that membership's provenance is verified. Leave the statement commented.
-- insert into private.reviewed_rooftop_members (dealership_id, user_id)
-- values ('<dealership uuid>', '<user uuid>');

do $$
declare
  missing text;
begin
  if to_regclass('pg_temp.rooftop_lock_txn_guard') is null then
    raise exception '20261109170000 must run inside a single transaction';
  end if;

  select r.dealership_id::text || ' / ' || r.user_id::text
    into missing
  from private.reviewed_rooftop_members r
  where not exists (
    select 1
    from public.user_dealerships ud
    where ud.dealership_id = r.dealership_id
      and ud.user_id = r.user_id
  )
  limit 1;

  if missing is not null then
    raise exception
      'reviewed rooftop pair % has no membership row; this migration does not create memberships',
      missing;
  end if;
end $$;

-- Refuses the accidental lockout. Zero pasted pairs, any membership that is
-- not in the pair table, or any rooftop that still holds a MarketCheck id or
-- website requires the approval setting in this same transaction. The setting
-- is not a dealership id and it does not stamp anyone.
do $$
declare
  unpaired integer;
  occupied integer;
  approval text;
begin
  if to_regclass('pg_temp.rooftop_lock_txn_guard') is null then
    raise exception '20261109170000 must run inside a single transaction';
  end if;

  select count(*)
    into unpaired
  from public.user_dealerships ud
  where not exists (
    select 1
    from private.reviewed_rooftop_members r
    where r.dealership_id = ud.dealership_id
      and r.user_id = ud.user_id
  );

  select count(*)
    into occupied
  from public.dealerships d
  where nullif(btrim(d.marketcheck_dealer_id), '') is not null
     or nullif(btrim(d.marketcheck_website_url), '') is not null;

  approval := nullif(current_setting('drevvy.approve_unpaired_rooftop_lockout', true), '');

  if (unpaired > 0 or occupied > 0)
     and approval is distinct from 'accept-unpaired-lockout' then
    raise exception
      'refusing to apply 20261109170000: % memberships are not in reviewed_rooftop_members and % rooftops hold a MarketCheck id or website. Unpaired memberships lose desk, in-network, and membership RLS, and occupied ids stay taken. Review the rollout inventory, record a disposition for each occupied claim, then set drevvy.approve_unpaired_rooftop_lockout to accept-unpaired-lockout in this same transaction. This setting is an approval, not a rooftop id.',
      unpaired,
      occupied;
  end if;
end $$;

alter table public.dealerships
  add column if not exists onboarded_at timestamptz;

comment on column public.dealerships.onboarded_at is
  'Set by an operator create, an accepted invite, or a reviewed membership pair. A MarketCheck id is not a stamp. A membership alone is not enough.';

alter table public.user_dealerships
  add column if not exists access_verified_at timestamptz;

alter table public.user_dealerships
  add column if not exists access_verified_source text;

alter table public.user_dealerships
  drop constraint if exists user_dealerships_access_verified_source_chk;

alter table public.user_dealerships
  add constraint user_dealerships_access_verified_source_chk
  check (
    access_verified_source is null
    or access_verified_source in ('reviewed_pair', 'operator', 'invite')
  );

comment on column public.user_dealerships.access_verified_at is
  'Set on the membership an operator creates, an invite accepts, or a row in private.reviewed_rooftop_members. Other members of the same rooftop stay unverified.';

comment on column public.user_dealerships.access_verified_source is
  'reviewed_pair, operator, or invite. apply_reviewed_rooftop_members clears a reviewed_pair stamp when that pair row is gone. Deleting the pair row alone does not clear it. operator and invite stamps are left in place.';

create or replace function private.apply_reviewed_rooftop_members()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  lock table public.dealerships in share row exclusive mode;
  lock table public.user_dealerships in share row exclusive mode;

  update public.user_dealerships ud
  set access_verified_at = coalesce(ud.access_verified_at, timezone('utc'::text, now())),
      access_verified_source = coalesce(ud.access_verified_source, 'reviewed_pair')
  from private.reviewed_rooftop_members r
  where ud.dealership_id = r.dealership_id
    and ud.user_id = r.user_id
    and (
      ud.access_verified_at is null
      or ud.access_verified_source is null
    );

  -- A deleted pair row does not clear anything until this function runs.
  -- operator and invite stamps are not revoked here.
  update public.user_dealerships ud
  set access_verified_at = null,
      access_verified_source = null
  where ud.access_verified_source = 'reviewed_pair'
    and not exists (
      select 1
      from private.reviewed_rooftop_members r
      where r.dealership_id = ud.dealership_id
        and r.user_id = ud.user_id
    );

  update public.dealerships d
  set onboarded_at = coalesce(d.onboarded_at, timezone('utc'::text, now()))
  where d.onboarded_at is null
    and exists (
      select 1
      from public.user_dealerships ud
      where ud.dealership_id = d.id
        and ud.access_verified_at is not null
    );

  update public.dealerships d
  set onboarded_at = null
  where d.onboarded_at is not null
    and not exists (
      select 1
      from public.user_dealerships ud
      where ud.dealership_id = d.id
        and ud.access_verified_at is not null
    );
end;
$$;

comment on function private.apply_reviewed_rooftop_members() is
  'Stamps reviewed pairs and clears reviewed_pair stamps whose pair row is gone, including onboarded_at when no verified membership remains. Does not insert or delete memberships and does not restore membership-only access helpers. Deleting a pair row without calling this function leaves the stamp. Granted to service_role.';

revoke all on function private.apply_reviewed_rooftop_members() from public, anon, authenticated;
grant execute on function private.apply_reviewed_rooftop_members() to service_role;

-- First writes to existing rows. Still refused unless the guard table from
-- the start of this file is visible.
do $$
begin
  if to_regclass('pg_temp.rooftop_lock_txn_guard') is null then
    raise exception '20261109170000 must run inside a single transaction';
  end if;

  update public.dealerships
  set marketcheck_dealer_id = null
  where marketcheck_dealer_id is not null
    and btrim(marketcheck_dealer_id) = '';

  update public.dealerships
  set marketcheck_website_url = null
  where marketcheck_website_url is not null
    and btrim(marketcheck_website_url) = '';

  perform private.apply_reviewed_rooftop_members();
end $$;

create unique index if not exists dealerships_marketcheck_dealer_id_key
  on public.dealerships (btrim(marketcheck_dealer_id))
  where marketcheck_dealer_id is not null
    and btrim(marketcheck_dealer_id) <> '';

create unique index if not exists dealerships_website_key
  on public.dealerships (public.rooftop_website_key(marketcheck_website_url))
  where public.rooftop_website_key(marketcheck_website_url) is not null;

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
  claims_text text;
begin
  -- PostgREST puts the verified role on request.jwt.claims (json) and, on
  -- older stacks, request.jwt.claim.role. A present claims role wins so a
  -- stale legacy GUC cannot upgrade the caller. Empty, missing, or unreadable
  -- claims fall through to the legacy GUC. Anything else is refused.
  claims_text := nullif(current_setting('request.jwt.claims', true), '');
  if claims_text is not null then
    begin
      jwt_role := nullif(claims_text::jsonb ->> 'role', '');
    exception
      when others then
        jwt_role := null;
    end;
  end if;

  if jwt_role is null then
    jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
  end if;

  session_role := current_setting('role', true);

  if jwt_role = 'service_role' or session_role = 'service_role' then
    return true;
  end if;

  if jwt_role in ('authenticated', 'anon') or session_role in ('authenticated', 'anon') then
    if to_regprocedure('private.is_platform_admin()') is not null
       and coalesce((select private.is_platform_admin()), false) then
      return true;
    end if;
  end if;

  return false;
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

  insert into public.user_dealerships (
    user_id, dealership_id, role, access_verified_at, access_verified_source
  )
  values (p_owner, created.id, v_role, timezone('utc'::text, now()), 'operator')
  on conflict (user_id, dealership_id) do update
  set role = excluded.role,
      access_verified_at = coalesce(
        public.user_dealerships.access_verified_at,
        excluded.access_verified_at
      ),
      access_verified_source = coalesce(
        public.user_dealerships.access_verified_source,
        excluded.access_verified_source
      );

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
     or new.access_verified_at is distinct from old.access_verified_at
     or new.access_verified_source is distinct from old.access_verified_source
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

-- SHA-256 in core SQL. pgcrypto is not on every preview image or on the PGlite
-- harness, and the digest has to match in both places. Tokens are short.
create or replace function private.sha256_hex(payload bytea)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  mask bigint := 4294967295;
  k bigint[] := array[
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
    3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
    3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
    2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
    666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
    2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
    430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
    1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298
  ];
  hh bigint[] := array[
    1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225
  ];
  w bigint[];
  padded bytea;
  bit_len bigint;
  blocks int;
  block int;
  i int;
  j int;
  a bigint;
  b bigint;
  c bigint;
  d bigint;
  e bigint;
  f bigint;
  g bigint;
  h bigint;
  s0 bigint;
  s1 bigint;
  ch bigint;
  maj bigint;
  t1 bigint;
  t2 bigint;
  word bigint;
  out_hex text := '';
begin
  bit_len := octet_length(payload) * 8;
  padded := payload || '\x80'::bytea;
  while (octet_length(padded) % 64) <> 56 loop
    padded := padded || '\x00'::bytea;
  end loop;
  for i in 0..7 loop
    padded := padded || set_byte('\x00'::bytea, 0, ((bit_len >> ((7 - i) * 8)) & 255)::int);
  end loop;

  blocks := octet_length(padded) / 64;
  for block in 0..blocks - 1 loop
    w := array_fill(0::bigint, array[64]);
    for i in 0..15 loop
      word := 0;
      for j in 0..3 loop
        word := ((word << 8) | get_byte(padded, block * 64 + i * 4 + j)) & mask;
      end loop;
      w[i + 1] := word;
    end loop;

    for i in 16..63 loop
      word := w[i - 14];
      s0 := (
        ((word >> 7) | ((word << 25) & mask))
        # ((word >> 18) | ((word << 14) & mask))
        # (word >> 3)
      ) & mask;
      word := w[i - 1];
      s1 := (
        ((word >> 17) | ((word << 15) & mask))
        # ((word >> 19) | ((word << 13) & mask))
        # (word >> 10)
      ) & mask;
      w[i + 1] := (w[i - 15] + s0 + w[i - 6] + s1) & mask;
    end loop;

    a := hh[1];
    b := hh[2];
    c := hh[3];
    d := hh[4];
    e := hh[5];
    f := hh[6];
    g := hh[7];
    h := hh[8];

    for i in 0..63 loop
      s1 := (
        ((e >> 6) | ((e << 26) & mask))
        # ((e >> 11) | ((e << 21) & mask))
        # ((e >> 25) | ((e << 7) & mask))
      ) & mask;
      ch := ((e & f) # ((mask # e) & g)) & mask;
      t1 := (h + s1 + ch + k[i + 1] + w[i + 1]) & mask;
      s0 := (
        ((a >> 2) | ((a << 30) & mask))
        # ((a >> 13) | ((a << 19) & mask))
        # ((a >> 22) | ((a << 10) & mask))
      ) & mask;
      maj := ((a & b) # (a & c) # (b & c)) & mask;
      t2 := (s0 + maj) & mask;
      h := g;
      g := f;
      f := e;
      e := (d + t1) & mask;
      d := c;
      c := b;
      b := a;
      a := (t1 + t2) & mask;
    end loop;

    hh[1] := (hh[1] + a) & mask;
    hh[2] := (hh[2] + b) & mask;
    hh[3] := (hh[3] + c) & mask;
    hh[4] := (hh[4] + d) & mask;
    hh[5] := (hh[5] + e) & mask;
    hh[6] := (hh[6] + f) & mask;
    hh[7] := (hh[7] + g) & mask;
    hh[8] := (hh[8] + h) & mask;
  end loop;

  for i in 1..8 loop
    out_hex := out_hex || lpad(to_hex(hh[i]), 8, '0');
  end loop;
  return out_hex;
end;
$$;

revoke all on function private.sha256_hex(bytea) from public, anon, authenticated;

create or replace function private.invite_token_hash(raw text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select private.sha256_hex(convert_to(raw, 'utf8'));
$$;

-- 32 bytes from two v4 UUIDs. gen_random_uuid uses the server CSPRNG.
create or replace function private.new_invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(
    decode(replace(gen_random_uuid()::text, '-', ''), 'hex')
    || decode(replace(gen_random_uuid()::text, '-', ''), 'hex'),
    'hex'
  );
$$;

revoke all on function private.invite_token_hash(text) from public, anon, authenticated;
revoke all on function private.new_invite_token() from public, anon, authenticated;

create table if not exists public.dealership_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
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
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint dealership_invites_target_check check (
    dealership_id is not null
    or (name is not null and length(btrim(name)) > 0)
  )
);

comment on table public.dealership_invites is
  'Operator-issued rooftop invite. Only the sha256 of the token is stored. Client roles cannot read this table. Accepting it is the only authenticated create path, and the MarketCheck id and website are the ones the operator stored.';

comment on column public.dealership_invites.token_hash is
  'sha256 hex of the 32-byte token returned once by issue_dealership_invite. The plaintext is not stored.';

create table if not exists private.dealership_invite_attempts (
  user_id uuid not null,
  token_hash text,
  outcome text not null,
  attempted_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists dealership_invite_attempts_user_recent
  on private.dealership_invite_attempts (user_id, attempted_at desc);

revoke all on table private.dealership_invite_attempts from public, anon, authenticated;

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
  p_expires_at timestamptz default null
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
  v_cap timestamptz;
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

  v_token := private.new_invite_token();
  if v_token is null or v_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invite token was not generated';
  end if;

  v_cap := timezone('utc'::text, now()) + interval '14 days';
  v_expires := coalesce(p_expires_at, v_cap);
  if v_expires <= timezone('utc'::text, now()) then
    raise exception 'invite expired';
  end if;
  if v_expires > v_cap then
    raise exception 'invite expiry is capped at 14 days';
  end if;

  insert into public.dealership_invites (
    token_hash,
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
    private.invite_token_hash(v_token),
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

comment on function public.issue_dealership_invite(text, text, text, text, text, text, uuid, timestamptz) is
  'Operator path. Generates a 32-byte token, stores only its sha256, and returns the plaintext once. Not granted to shoppers.';

revoke all on function public.issue_dealership_invite(text, text, text, text, text, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.issue_dealership_invite(text, text, text, text, text, text, uuid, timestamptz)
  to service_role;

create or replace function public.accept_dealership_invite(p_token text)
returns table (dealership public.dealerships, invite_error text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  invite public.dealership_invites;
  created public.dealerships;
  v_token text;
  v_hash text;
  v_recent integer;
begin
  -- Failures return a row and commit. Raising would roll the attempt back,
  -- and the 8-per-15-minutes limit would never stick across requests.
  uid := (select auth.uid());
  if uid is null then
    return query select null::public.dealerships, 'Not authenticated'::text;
    return;
  end if;

  select count(*)
    into v_recent
  from private.dealership_invite_attempts a
  where a.user_id = uid
    and a.attempted_at > timezone('utc'::text, now()) - interval '15 minutes';

  if v_recent >= 8 then
    insert into private.dealership_invite_attempts (user_id, outcome)
    values (uid, 'rate_limited');
    return query select null::public.dealerships, 'too many invite attempts'::text;
    return;
  end if;

  v_token := nullif(btrim(coalesce(p_token, '')), '');
  if v_token is null or v_token !~ '^[0-9a-f]{64}$' then
    insert into private.dealership_invite_attempts (user_id, outcome)
    values (uid, 'not_found');
    return query select null::public.dealerships, 'invite not found'::text;
    return;
  end if;

  v_hash := private.invite_token_hash(v_token);

  select *
    into invite
  from public.dealership_invites
  where token_hash = v_hash
  for update;

  if not found then
    insert into private.dealership_invite_attempts (user_id, token_hash, outcome)
    values (uid, v_hash, 'not_found');
    return query select null::public.dealerships, 'invite not found'::text;
    return;
  end if;

  if invite.accepted_at is not null
     and invite.accepted_by = uid
     and invite.dealership_id is not null then
    select * into created
    from public.dealerships
    where id = invite.dealership_id;
    if not found then
      insert into private.dealership_invite_attempts (user_id, token_hash, outcome)
      values (uid, v_hash, 'not_found');
      return query select null::public.dealerships, 'invite not found'::text;
      return;
    end if;
    return query select created, null::text;
    return;
  end if;

  if invite.failed_attempts >= 5 then
    insert into private.dealership_invite_attempts (user_id, token_hash, outcome)
    values (uid, v_hash, 'locked');
    return query select null::public.dealerships, 'too many invite attempts'::text;
    return;
  end if;

  if invite.accepted_at is not null then
    update public.dealership_invites
    set failed_attempts = failed_attempts + 1
    where id = invite.id;
    insert into private.dealership_invite_attempts (user_id, token_hash, outcome)
    values (uid, v_hash, 'already_used');
    return query select null::public.dealerships, 'invite already used'::text;
    return;
  end if;

  if invite.expires_at <= timezone('utc'::text, now()) then
    update public.dealership_invites
    set failed_attempts = failed_attempts + 1
    where id = invite.id;
    insert into private.dealership_invite_attempts (user_id, token_hash, outcome)
    values (uid, v_hash, 'expired');
    return query select null::public.dealerships, 'invite expired'::text;
    return;
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
      insert into private.dealership_invite_attempts (user_id, token_hash, outcome)
      values (uid, v_hash, 'not_found');
      return query select null::public.dealerships, 'invite not found'::text;
      return;
    end if;

    insert into public.user_dealerships (
      user_id, dealership_id, role, access_verified_at, access_verified_source
    )
    values (uid, created.id, invite.role, timezone('utc'::text, now()), 'invite')
    on conflict (user_id, dealership_id) do update
    set role = excluded.role,
        access_verified_at = coalesce(
          public.user_dealerships.access_verified_at,
          excluded.access_verified_at
        ),
        access_verified_source = 'invite';

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

  return query select created, null::text;
end;
$$;

comment on function public.accept_dealership_invite(text) is
  'Authenticated dealers redeem an operator invite. An existing membership is updated to the invite role, so a salesperson invite does not leave the acceptor verified as owner. Other members of that rooftop are unchanged. Failures return invite_error and commit the attempt so the per-user limit holds. The caller cannot supply a MarketCheck id or website. Eight failures in fifteen minutes, or five failures of the same invite, stop further attempts.';

revoke all on function public.accept_dealership_invite(text) from public, anon;
grant execute on function public.accept_dealership_invite(text) to authenticated, service_role;

-- Membership grants access only when that membership is verified and the
-- rooftop is onboarded. Platform admin stays a separate bypass inside the
-- helpers that already had it. It is not a membership stamp.
create or replace function private.membership_grants_access(
  target_dealership_id uuid,
  target_dealer_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_dealerships ud
    join public.dealerships d on d.id = ud.dealership_id
    where ud.user_id = (select auth.uid())
      and ud.access_verified_at is not null
      and d.onboarded_at is not null
      and (
        (
          target_dealership_id is not null
          and ud.dealership_id = target_dealership_id
        )
        or (
          target_dealership_id is null
          and coalesce(target_dealer_id, '') <> ''
          and d.marketcheck_dealer_id = target_dealer_id
        )
      )
  );
$$;

revoke all on function private.membership_grants_access(uuid, text) from public;
grant execute on function private.membership_grants_access(uuid, text) to anon, authenticated;

create or replace function private.user_has_dealer_access(target_dealer_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(target_dealer_id, '') <> ''
    and (
      (select private.is_platform_admin())
      or (select private.membership_grants_access(null::uuid, target_dealer_id))
    );
$$;

revoke all on function private.user_has_dealer_access(text) from public;
grant execute on function private.user_has_dealer_access(text) to authenticated;

create or replace function private.user_has_rooftop_access(
  target_dealership_id uuid,
  target_dealer_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      (select private.is_platform_admin())
      or (
        target_dealership_id is not null
        and (select private.membership_grants_access(target_dealership_id, null::text))
      )
      or (
        target_dealership_id is null
        and (select private.user_has_dealer_access(target_dealer_id))
      )
    );
$$;

revoke all on function private.user_has_rooftop_access(uuid, text) from public, anon;
grant execute on function private.user_has_rooftop_access(uuid, text) to authenticated;

create or replace function private.user_can_access_uvs_vehicle(
  target_dealership_id uuid,
  target_dealer_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_platform_admin())
    or (
      target_dealership_id is not null
      and (select private.membership_grants_access(target_dealership_id, null::text))
    )
    or (
      target_dealership_id is null
      and (select private.user_has_dealer_access(target_dealer_id))
    );
$$;

revoke all on function private.user_can_access_uvs_vehicle(uuid, text) from public, anon;
grant execute on function private.user_can_access_uvs_vehicle(uuid, text) to authenticated;

-- Policies that inline a membership check are replaced only when they already
-- exist, so a preview database that never replayed the archive files is left
-- alone. The new predicate is the verified-membership helper.
do $$
begin
  if to_regclass('public.dealership_billing_accounts') is not null then
    execute 'drop policy if exists "Members can view dealership billing accounts" on public.dealership_billing_accounts';
    execute $policy$
      create policy "Members can view dealership billing accounts"
        on public.dealership_billing_accounts for select to authenticated
        using (
          (select private.is_platform_admin())
          or (select private.membership_grants_access(dealership_id, null::text))
        )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dealerships'
      and policyname = 'Users can view their dealerships'
  ) then
    execute 'drop policy "Users can view their dealerships" on public.dealerships';
    execute $policy$
      create policy "Users can view their dealerships"
        on public.dealerships for select
        using ((select private.membership_grants_access(id, null::text)))
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dealerships'
      and policyname = 'Users can update their dealerships'
  ) then
    execute 'drop policy "Users can update their dealerships" on public.dealerships';
    execute $policy$
      create policy "Users can update their dealerships"
        on public.dealerships for update
        using (
          (select private.membership_grants_access(id, null::text))
          and exists (
            select 1
            from public.user_dealerships ud
            where ud.dealership_id = dealerships.id
              and ud.user_id = (select auth.uid())
              and ud.role = 'owner'
              and ud.access_verified_at is not null
          )
        )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_vehicles'
      and policyname = 'Users can view dealership inventory'
  ) then
    execute 'drop policy "Users can view dealership inventory" on public.inventory_vehicles';
    execute $policy$
      create policy "Users can view dealership inventory"
        on public.inventory_vehicles for select
        using ((select private.membership_grants_access(dealership_id, null::text)))
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_vehicles'
      and policyname = 'Users can insert dealership inventory'
  ) then
    execute 'drop policy "Users can insert dealership inventory" on public.inventory_vehicles';
    execute $policy$
      create policy "Users can insert dealership inventory"
        on public.inventory_vehicles for insert
        with check ((select private.membership_grants_access(dealership_id, null::text)))
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_vehicles'
      and policyname = 'Users can update dealership inventory'
  ) then
    execute 'drop policy "Users can update dealership inventory" on public.inventory_vehicles';
    execute $policy$
      create policy "Users can update dealership inventory"
        on public.inventory_vehicles for update
        using ((select private.membership_grants_access(dealership_id, null::text)))
        with check ((select private.membership_grants_access(dealership_id, null::text)))
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_vehicles'
      and policyname = 'Users can delete dealership inventory'
  ) then
    execute 'drop policy "Users can delete dealership inventory" on public.inventory_vehicles';
    execute $policy$
      create policy "Users can delete dealership inventory"
        on public.inventory_vehicles for delete
        using ((select private.membership_grants_access(dealership_id, null::text)))
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_sessions'
      and policyname = 'Users can view sessions for their dealerships'
  ) then
    execute 'drop policy "Users can view sessions for their dealerships" on public.analytics_sessions';
    execute $policy$
      create policy "Users can view sessions for their dealerships"
        on public.analytics_sessions for select
        using (
          (user_id is not null and (select auth.uid()) = user_id)
          or (
            dealer_id is not null
            and (select private.membership_grants_access(null::uuid, dealer_id))
          )
        )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'Users can view events for their dealerships'
  ) then
    execute 'drop policy "Users can view events for their dealerships" on public.analytics_events';
    execute $policy$
      create policy "Users can view events for their dealerships"
        on public.analytics_events for select
        using (
          (user_id is not null and (select auth.uid()) = user_id)
          or (
            dealer_id is not null
            and (select private.membership_grants_access(null::uuid, dealer_id))
          )
          or dealer_id is null
        )
    $policy$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_vehicle_snapshots'
      and policyname = 'Users can view snapshots for their dealerships'
  ) then
    execute 'drop policy "Users can view snapshots for their dealerships" on public.analytics_vehicle_snapshots';
    execute $policy$
      create policy "Users can view snapshots for their dealerships"
        on public.analytics_vehicle_snapshots for select
        using (
          (
            dealer_id is not null
            and (select private.membership_grants_access(null::uuid, dealer_id))
          )
          or dealer_id is null
        )
    $policy$;
  end if;
end $$;
