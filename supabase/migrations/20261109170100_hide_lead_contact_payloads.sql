-- SEC-03: client roles cannot read or update lead contact payloads.
--
-- Members could select and update leads.enc_payload and
-- lead_delivery_logs.adf_payload through PostgREST because RLS is row-scoped
-- and the table grants covered every column.
--
-- Table privileges no longer include those columns for anon or authenticated.
-- dealer_leads and dealer_lead_delivery_logs are security_invoker views of the
-- other columns, so rooftop RLS still applies. response_body is omitted too:
-- a delivery response can echo the ADF body. update_dealer_lead_status writes
-- status only.
--
-- service_role keeps full table access for the server that stores the blob.
-- VIN stays readable and is not client-updatable.
-- anon and authenticated have no INSERT. The member insert policy on
-- lead_delivery_logs from 20260910155723 is dropped here.
-- update_dealer_lead_status allows only new, contacted, qualified, closed,
-- and test_drive_booked. A check constraint blocks other status writes
-- through the column grant.
--
-- Rollback is a forward migration, not an edit of this file. See the PR.

do $$
declare
  cols text;
  col record;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'leads'
    and column_name <> 'enc_payload';

  if cols is null then
    raise exception 'public.leads is missing';
  end if;

  execute 'drop view if exists public.dealer_leads';
  execute format(
    'create view public.dealer_leads with (security_invoker = true) as select %s from public.leads',
    cols
  );

  revoke all on table public.leads from public, anon, authenticated;

  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name <> 'enc_payload'
  loop
    execute format(
      'grant select (%I) on table public.leads to authenticated',
      col.column_name
    );
  end loop;

  grant update (status) on table public.leads to authenticated;
  grant select, insert, update, delete on table public.leads to service_role;
end $$;

drop policy if exists "System can insert leads" on public.leads;
revoke insert on table public.leads from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_status_client_allowed'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_status_client_allowed
      check (
        status is null
        or status in ('new', 'contacted', 'qualified', 'closed', 'test_drive_booked')
      )
      not valid;
  end if;
end $$;

comment on view public.dealer_leads is
  'Contact-free lead columns for a rooftop member. enc_payload is not in this view. security_invoker keeps leads RLS.';

revoke all on table public.dealer_leads from public, anon, authenticated;
grant select on table public.dealer_leads to authenticated, service_role;

do $$
declare
  cols text;
  col record;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'lead_delivery_logs'
    and column_name not in ('adf_payload', 'response_body');

  if cols is null then
    raise exception 'public.lead_delivery_logs is missing';
  end if;

  execute 'drop view if exists public.dealer_lead_delivery_logs';
  execute format(
    'create view public.dealer_lead_delivery_logs with (security_invoker = true) as select %s from public.lead_delivery_logs',
    cols
  );

  revoke all on table public.lead_delivery_logs from public, anon, authenticated;

  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_delivery_logs'
      and column_name not in ('adf_payload', 'response_body')
  loop
    execute format(
      'grant select (%I) on table public.lead_delivery_logs to authenticated',
      col.column_name
    );
  end loop;

  grant select, insert, update, delete on table public.lead_delivery_logs to service_role;
end $$;

drop policy if exists "Users can insert own delivery logs" on public.lead_delivery_logs;
drop policy if exists "Members can insert dealership delivery logs" on public.lead_delivery_logs;
revoke insert on table public.lead_delivery_logs from public, anon, authenticated;

comment on view public.dealer_lead_delivery_logs is
  'Contact-free delivery log. adf_payload and response_body are not in this view. security_invoker keeps lead_delivery_logs RLS.';

revoke all on table public.dealer_lead_delivery_logs from public, anon, authenticated;
grant select on table public.dealer_lead_delivery_logs to authenticated, service_role;

create or replace function public.update_dealer_lead_status(
  p_lead_id text,
  p_status text
)
returns setof public.dealer_leads
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  v_status := nullif(btrim(coalesce(p_status, '')), '');
  if v_status is null then
    raise exception 'status is required';
  end if;
  if v_status not in ('new', 'contacted', 'qualified', 'closed', 'test_drive_booked') then
    raise exception 'status is not allowed';
  end if;

  update public.leads
  set status = v_status
  where id = p_lead_id;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'lead not found';
  end if;

  return query
  select *
  from public.dealer_leads
  where id = p_lead_id;
end;
$$;

comment on function public.update_dealer_lead_status(text, text) is
  'Member status update. Writes one of new, contacted, qualified, closed, test_drive_booked. Returns dealer_leads, which has no contact payload.';

revoke all on function public.update_dealer_lead_status(text, text) from public, anon;
grant execute on function public.update_dealer_lead_status(text, text) to authenticated, service_role;
