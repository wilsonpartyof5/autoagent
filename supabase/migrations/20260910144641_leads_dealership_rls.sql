-- ChatGPT leads are stored with user_id null. Dealers must see leads for
-- rooftops they belong to, not only rows they personally "own".

update public.leads l
set user_id = (
  select ud.user_id
  from public.dealerships d
  join public.user_dealerships ud on ud.dealership_id = d.id
  where d.marketcheck_dealer_id = l.dealer_id
  order by ud.created_at
  limit 1
)
where l.user_id is null
  and l.dealer_id is not null;



create or replace function private.user_has_dealer_access(target_dealer_id text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    coalesce(target_dealer_id, '') <> ''
    and (
      (select private.is_platform_admin())
      or exists (
        select 1
        from public.user_dealerships ud
        join public.dealerships d on d.id = ud.dealership_id
        where ud.user_id = (select auth.uid())
          and d.marketcheck_dealer_id = target_dealer_id
      )
    );
$$;

revoke all on function private.user_has_dealer_access(text) from public;
grant execute on function private.user_has_dealer_access(text) to authenticated;

drop policy if exists "Users can view own leads" on public.leads;
drop policy if exists "Users can update own leads" on public.leads;
drop policy if exists "Members can view dealership leads" on public.leads;
drop policy if exists "Members can update dealership leads" on public.leads;

create policy "Members can view dealership leads"
  on public.leads for select to authenticated
  using ((select private.user_has_dealer_access(dealer_id)));

create policy "Members can update dealership leads"
  on public.leads for update to authenticated
  using ((select private.user_has_dealer_access(dealer_id)))
  with check ((select private.user_has_dealer_access(dealer_id)));

drop policy if exists "Users can view own delivery logs" on public.lead_delivery_logs;
drop policy if exists "Members can view dealership delivery logs" on public.lead_delivery_logs;

create policy "Members can view dealership delivery logs"
  on public.lead_delivery_logs for select to authenticated
  using ((select private.user_has_dealer_access(dealer_id)));
