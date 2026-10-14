-- Security fixes for existing advisor findings.
-- NOTE: Turn on leaked-password protection in the Supabase dashboard (not configurable via SQL).

-- 1. Make mc_api_usage_summary a security_invoker view
-- This ensures the view respects RLS of the calling user rather than definer rights
drop view if exists public.mc_api_usage_summary;
create view public.mc_api_usage_summary with (security_invoker = true) as
select
  month,
  sum(call_count)                                          as total_calls,
  sum(case when call_type = 'search' then call_count end) as search_calls,
  sum(case when call_type = 'detail' then call_count end) as detail_calls,
  max(updated_at)                                          as last_call_at
from public.mc_api_usage
group by month
order by month desc;

-- 2. Set a fixed search_path on update_uvs_vehicles_updated_at to prevent search_path hijacking
create or replace function public.update_uvs_vehicles_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- 3. Set a fixed search_path on mc_usage_increment to prevent search_path hijacking
create or replace function public.mc_usage_increment(p_month text, p_call_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into mc_api_usage (month, call_type, call_count, updated_at)
  values (p_month, p_call_type, 1, now())
  on conflict (month, call_type)
  do update set
    call_count = mc_api_usage.call_count + 1,
    updated_at = now();
end;
$$;

-- 4. Revoke EXECUTE on mc_usage_increment from anon, authenticated, and public
-- The function is called via RPC from server-side API routes using service_role,
-- not from the client. This prevents direct invocation from any user.
revoke execute on function public.mc_usage_increment(text, text) from anon;
revoke execute on function public.mc_usage_increment(text, text) from authenticated;
revoke execute on function public.mc_usage_increment(text, text) from public;

-- 5. Align shopper_outreach tables with the rest: revoke from public/anon/authenticated, grant to service_role, force RLS
-- shopper_outreach_messages
alter table public.shopper_outreach_messages force row level security;
revoke all on table public.shopper_outreach_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.shopper_outreach_messages to service_role;

-- shopper_offers
alter table public.shopper_offers force row level security;
revoke all on table public.shopper_offers from public, anon, authenticated;
grant select, insert, update, delete on table public.shopper_offers to service_role;

-- shopper_deal_events
alter table public.shopper_deal_events force row level security;
revoke all on table public.shopper_deal_events from public, anon, authenticated;
grant select, insert, update, delete on table public.shopper_deal_events to service_role;

-- Note: create_own_dealership remains available to authenticated users because
-- it is called from the client during signup/onboarding. It is already revoked
-- from public in 20260910_lock_private_rooms.sql and only granted to authenticated.
