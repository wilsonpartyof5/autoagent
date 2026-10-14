-- Dealer mobile API support: rooftop-aware lead access, read-only balances,
-- and user-owned APNs device registrations.

create or replace function private.user_has_rooftop_access(
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
    (select auth.uid()) is not null
    and (
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
      )
    );
$$;

revoke all on function private.user_has_rooftop_access(uuid, text) from public, anon;
grant execute on function private.user_has_rooftop_access(uuid, text) to authenticated;

drop policy if exists "Members can view dealership leads" on public.leads;
drop policy if exists "Members can update dealership leads" on public.leads;

create policy "Members can view dealership leads"
  on public.leads for select to authenticated
  using (
    (select private.user_has_rooftop_access(dealership_id, dealer_id))
  );

create policy "Members can update dealership leads"
  on public.leads for update to authenticated
  using (
    (select private.user_has_rooftop_access(dealership_id, dealer_id))
  )
  with check (
    (select private.user_has_rooftop_access(dealership_id, dealer_id))
  );

create table if not exists public.dealership_billing_accounts (
  dealership_id uuid primary key references public.dealerships(id) on delete cascade,
  cash_balance_cents bigint not null default 0 check (cash_balance_cents >= 0),
  included_leads_remaining integer not null default 0 check (included_leads_remaining >= 0),
  lead_price_cents integer not null default 2000 check (lead_price_cents > 0),
  auto_replenish_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.dealership_billing_accounts enable row level security;

drop policy if exists "Members can view dealership billing accounts"
  on public.dealership_billing_accounts;

create policy "Members can view dealership billing accounts"
  on public.dealership_billing_accounts for select to authenticated
  using (
    exists (
      select 1
      from public.user_dealerships ud
      where ud.user_id = (select auth.uid())
        and ud.dealership_id = dealership_billing_accounts.dealership_id
    )
    or (select private.is_platform_admin())
  );

revoke all on public.dealership_billing_accounts from public, anon, authenticated;
grant select on public.dealership_billing_accounts to authenticated;
grant all on public.dealership_billing_accounts to service_role;

create table if not exists public.dealer_mobile_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform = 'ios'),
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_dealer_mobile_devices_user_id
  on public.dealer_mobile_devices(user_id);

alter table public.dealer_mobile_devices enable row level security;

drop policy if exists "Users can view their mobile devices" on public.dealer_mobile_devices;
drop policy if exists "Users can register their mobile devices" on public.dealer_mobile_devices;
drop policy if exists "Users can update their mobile devices" on public.dealer_mobile_devices;
drop policy if exists "Users can remove their mobile devices" on public.dealer_mobile_devices;

create policy "Users can view their mobile devices"
  on public.dealer_mobile_devices for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can register their mobile devices"
  on public.dealer_mobile_devices for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their mobile devices"
  on public.dealer_mobile_devices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their mobile devices"
  on public.dealer_mobile_devices for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.dealer_mobile_devices from public, anon, authenticated;
grant select, insert, update, delete on public.dealer_mobile_devices to authenticated;
grant all on public.dealer_mobile_devices to service_role;
