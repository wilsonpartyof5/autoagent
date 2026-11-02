-- DRAFT ONLY — do not apply to AutoAgent prod without DW OK (Analytics standing rule).
-- Not a ClickPipes / publication / conversation-cron change. Not a supabase/migrations/ file.
--
-- Why this exists:
--   private.drevvy_emit_event and private.drevvy_user_hash are EXECUTE-only for postgres
--   (proacl {postgres=X/postgres}). service_role has no USAGE on schema private.
--   PostgREST does not expose `private`, so GRANT on the private functions is not enough
--   for supabase-js `admin.rpc(...)`.
--
-- This adds public SECURITY DEFINER wrappers with the same names, revokes PUBLIC, and
-- grants EXECUTE to service_role only. The shopper API then calls:
--   rpc('drevvy_user_hash', { p_user })
--   rpc('drevvy_emit_event', { p_event_type, p_version, ... })
--
-- Until this is applied, twin insert + journey emit soft-fail: the app table
-- public.off_network_otd_requests still succeeds.

create or replace function public.drevvy_user_hash(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  return private.drevvy_user_hash(p_user);
end;
$$;

revoke all on function public.drevvy_user_hash(uuid) from public, anon, authenticated;
grant execute on function public.drevvy_user_hash(uuid) to service_role;

create or replace function public.drevvy_emit_event(
  p_event_type text,
  p_version integer,
  p_idempotency_key text,
  p_consumer_user_id uuid,
  p_shopper_deal_id uuid,
  p_dealer_id uuid,
  p_entity_table text,
  p_entity_id text,
  p_actor text,
  p_listing_source text,
  p_region text,
  p_payload jsonb,
  p_occurred_at timestamp with time zone default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  return private.drevvy_emit_event(
    p_event_type,
    p_version,
    p_idempotency_key,
    p_consumer_user_id,
    p_shopper_deal_id,
    p_dealer_id,
    p_entity_table,
    p_entity_id,
    p_actor,
    p_listing_source,
    p_region,
    p_payload,
    p_occurred_at
  );
end;
$$;

revoke all on function public.drevvy_emit_event(
  text, integer, text, uuid, uuid, uuid, text, text, text, text, text, jsonb, timestamp with time zone
) from public, anon, authenticated;
grant execute on function public.drevvy_emit_event(
  text, integer, text, uuid, uuid, uuid, text, text, text, text, text, jsonb, timestamp with time zone
) to service_role;
