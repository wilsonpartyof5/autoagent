-- Establish platform-admin visibility and attach Honda Cars Of Rock Hill
-- (MarketCheck dealer 1038994) as a second rooftop for Dustin.
--
-- This migration is intentionally additive. It does not delete or reassign
-- existing dealerships, memberships, or inventory records.

alter table public.profiles
  add column if not exists platform_role text not null default 'dealer_user'
  check (platform_role in ('dealer_user', 'platform_admin'));

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_platform_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.platform_role = 'platform_admin'
  );
$$;

revoke all on function private.is_platform_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_platform_admin() to authenticated;

-- The existing Vantous account is the platform admin. Fill its profile email
-- from auth.users while retaining the source-of-truth auth email.
update public.profiles p
set
  platform_role = 'platform_admin',
  email = coalesce(p.email, u.email),
  updated_at = timezone('utc'::text, now())
from auth.users u
where p.id = u.id
  and lower(u.email) = 'vantousgroup@gmail.com';

-- Honda Cars Of Rock Hill inventory already exists in UVS under 1038994.
-- Create a distinct dealership row without touching the existing Honda Rock
-- Hill / 1283655 record.
insert into public.dealerships (
  name,
  marketcheck_dealer_id,
  marketcheck_zip
)
select
  'Honda Cars Of Rock Hill',
  '1038994',
  null
where not exists (
  select 1
  from public.dealerships
  where marketcheck_dealer_id = '1038994'
);

-- Add the Honda Cars rooftop to Dustin's existing multi-rooftop login.
insert into public.user_dealerships (
  user_id,
  dealership_id,
  role
)
select
  u.id,
  d.id,
  'owner'
from auth.users u
join public.dealerships d on d.marketcheck_dealer_id = '1038994'
where lower(u.email) = 'dustin.wilson7@gmail.com'
  and not exists (
    select 1
    from public.user_dealerships ud
    where ud.user_id = u.id
      and ud.dealership_id = d.id
  );

-- Platform admins need read visibility into account and rooftop state. Dealer
-- users remain restricted to their own memberships by existing policies.
drop policy if exists "Platform admins can view profiles" on public.profiles;
create policy "Platform admins can view profiles"
  on public.profiles
  for select
  to authenticated
  using ((select private.is_platform_admin()));

drop policy if exists "Platform admins can view dealerships" on public.dealerships;
create policy "Platform admins can view dealerships"
  on public.dealerships
  for select
  to authenticated
  using ((select private.is_platform_admin()));

drop policy if exists "Platform admins can view memberships" on public.user_dealerships;
create policy "Platform admins can view memberships"
  on public.user_dealerships
  for select
  to authenticated
  using ((select private.is_platform_admin()));

drop policy if exists "Platform admins can view preferences" on public.user_preferences;
create policy "Platform admins can view preferences"
  on public.user_preferences
  for select
  to authenticated
  using ((select private.is_platform_admin()));

drop policy if exists "Platform admins can view legacy inventory" on public.inventory_vehicles;
create policy "Platform admins can view legacy inventory"
  on public.inventory_vehicles
  for select
  to authenticated
  using ((select private.is_platform_admin()));

drop policy if exists "Platform admins can view leads" on public.leads;
create policy "Platform admins can view leads"
  on public.leads
  for select
  to authenticated
  using ((select private.is_platform_admin()));

-- Dealer creation and membership creation are performed through trusted
-- server-side admin clients. Remove historical client-side permissive insert
-- policies that allowed arbitrary authenticated inserts.
drop policy if exists "Allow authenticated insert into dealerships" on public.dealerships;
drop policy if exists "Users can insert dealerships" on public.dealerships;

-- Auth triggers do not require Data API execute permission. Remove public RPC
-- access to this security-definer function. Revoke from PUBLIC as well because
-- anon/authenticated inherit EXECUTE through PUBLIC by default.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
