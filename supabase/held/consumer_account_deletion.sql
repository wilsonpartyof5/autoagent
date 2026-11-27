-- HELD. Needs DW approval before anyone applies it.
-- Do NOT move this file into supabase/migrations. Files there apply to
-- production on merge. This file does not.
--
-- Why it exists:
-- Shopper account deletion (DELETE /api/consumer/profile) calls
-- public.delete_consumer_account(uuid) once. That function clears the shopper
-- id on dealer chats and outreach. It does not touch shopper_credit_events.
-- Today those foreign keys are ON DELETE CASCADE, and two triggers reject the
-- update that clears the shopper. Deleting the auth user would erase dealer
-- threads and the purchase ledger. This change lets those rows stay, with the
-- shopper id set to null (or, for conversation_identities, to the deleted
-- placeholders). The credit-event user_id becomes null only through the
-- foreign key when auth.users is actually deleted.
--
-- Until this is applied, the API returns 500 deletion_schema_pending and does
-- not delete the auth user. The API calls public.delete_consumer_account(uuid)
-- once. That function does every shopper-data change in one transaction.
-- It does not UPDATE or DELETE public.shopper_credit_events. That ledger's
-- user_id becomes null only when auth.users is deleted, through the
-- ON DELETE SET NULL foreign key below. Leaving the row attached keeps
-- starter_grant and purchase:<transaction id> matched to the user if
-- auth.admin.deleteUser fails and the shopper signs in again.
--
-- Tables this file changes (anonymize and keep):
--   shopper_deals.consumer_user_id
--   shopper_dealer_conversations.consumer_user_id
--   shopper_outreach_messages.consumer_user_id
--   shopper_offers.consumer_user_id
--   shopper_deal_events.consumer_user_id
--   shopper_deal_lifecycle.consumer_user_id
--     Prod has public.shopper_deal_lifecycle. consumer_user_id references
--     auth.users(id) ON DELETE CASCADE. This file replaces that foreign key
--     with ON DELETE SET NULL, and delete_consumer_account sets the column
--     null. The function does not skip the table. deal_id stays
--     references public.shopper_deals(id) ON DELETE CASCADE.
--   shopper_credit_events.user_id
-- Triggers:
--   private.protect_shopper_deal — allow consumer_user_id to become null
--     when the listing, snapshot, status, and timestamps stay put
--   private.guard_conversation_identity — allow shopper_id = 'deleted' and
--     shopper_first_name = 'Deleted' when the alias, numbers, and dealer stay put
--
-- Deleted inside public.delete_consumer_account, not by a separate API write:
--   saved_cars, device_tokens, shopper_market_*, off_network_otd_requests,
--   shopper_credits, consumer_profiles.
--   Their ON DELETE CASCADE from auth.users is fine because the row should go.
--   dealer_close_fees and the desk warning rows have no shopper id.
--   conversation alias and text number stay locked so dealer replies still route.

create or replace function private.protect_shopper_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Account deletion detaches the shopper. The car and the deal stay.
  if tg_op = 'UPDATE'
     and new.consumer_user_id is null
     and old.consumer_user_id is not null
     and new.id is not distinct from old.id
     and new.listing_id is not distinct from old.listing_id
     and new.vehicle_snapshot is not distinct from old.vehicle_snapshot
     and new.created_at is not distinct from old.created_at
     and new.outreach_locked_until_paid is not distinct from old.outreach_locked_until_paid
     and new.status is not distinct from old.status
  then
    new.updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now());
    return new;
  end if;

  if new.consumer_user_id is distinct from old.consumer_user_id
     or new.listing_id is distinct from old.listing_id
     or new.vehicle_snapshot is distinct from old.vehicle_snapshot
     or new.created_at is distinct from old.created_at
     or new.outreach_locked_until_paid is distinct from true
  then
    raise exception 'shopper deal identity is immutable';
  end if;

  if new.status is distinct from old.status
     and not (
       (old.status = 'interested' and new.status in ('negotiating', 'closed'))
       or (old.status = 'negotiating' and new.status in ('accepted', 'closed'))
       or (old.status = 'accepted' and new.status = 'closed')
     )
  then
    raise exception 'shopper deal status cannot move backward';
  end if;

  new.updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now());
  return new;
end;
$$;

revoke all on function private.protect_shopper_deal() from public, anon, authenticated;

create or replace function private.guard_conversation_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cooldown integer;
  dealer_domain text;
begin
  if tg_op = 'UPDATE' then
    -- Account deletion may replace the shopper label only.
    -- The alias and the text number stay so an open dealer thread still routes.
    if new.shopper_id = 'deleted'
       and new.shopper_first_name = 'Deleted'
       and (
         old.shopper_id is distinct from 'deleted'
         or old.shopper_first_name is distinct from 'Deleted'
       )
       and new.id is not distinct from old.id
       and new.deal_id is not distinct from old.deal_id
       and new.dealer_id is not distinct from old.dealer_id
       and new.email_alias is not distinct from old.email_alias
       and new.alias_domain is not distinct from old.alias_domain
       and new.sms_number_e164 is not distinct from old.sms_number_e164
       and new.voice_number_e164 is not distinct from old.voice_number_e164
       and new.locked_at is not distinct from old.locked_at
       and new.created_at is not distinct from old.created_at
       and new.is_test is not distinct from old.is_test
       and new.ended_at is not distinct from old.ended_at
    then
      return new;
    end if;

    if new.deal_id is distinct from old.deal_id
       or new.dealer_id is distinct from old.dealer_id
       or new.shopper_id is distinct from old.shopper_id
       or new.shopper_first_name is distinct from old.shopper_first_name
       or new.email_alias is distinct from old.email_alias
       or new.alias_domain is distinct from old.alias_domain
       or new.sms_number_e164 is distinct from old.sms_number_e164
       or new.voice_number_e164 is distinct from old.voice_number_e164
       or new.locked_at is distinct from old.locked_at
       or new.created_at is distinct from old.created_at
       or new.is_test is distinct from old.is_test
       or new.id is distinct from old.id
    then
      raise exception 'conversation identity is locked';
    end if;
    return new;
  end if;

  insert into public.dealer_alias_domains (dealer_id, alias_domain)
  values (new.dealer_id, new.alias_domain)
  on conflict (dealer_id) do nothing;

  select alias_domain into dealer_domain
  from public.dealer_alias_domains
  where dealer_id = new.dealer_id;

  if dealer_domain is distinct from new.alias_domain then
    raise exception 'dealer already has a sending domain';
  end if;

  if not exists (
    select 1 from public.sms_number_pool
    where phone_e164 = new.sms_number_e164
      and status = 'active'
      and is_test = new.is_test
  ) then
    raise exception 'sms number is not an active pool number for this mode';
  end if;

  select sms_cooldown_days into cooldown from public.identity_settings where id = 1;
  if cooldown is null then
    cooldown := 90;
  end if;

  if exists (
    select 1 from public.conversation_identities
    where dealer_id = new.dealer_id
      and sms_number_e164 = new.sms_number_e164
      and shopper_id is distinct from new.shopper_id
      and ended_at is not null
      and ended_at > pg_catalog.now() - pg_catalog.make_interval(days => cooldown)
  ) then
    raise exception 'sms number is in cooldown for this dealer';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_conversation_identity() from public, anon, authenticated;

-- Nullable shopper id, ON DELETE SET NULL, so deleting auth.users keeps the row.
do $hold$
declare
  target record;
  old_fk record;
begin
  for target in
    select *
    from (values
      ('shopper_deals', 'consumer_user_id'),
      ('shopper_dealer_conversations', 'consumer_user_id'),
      ('shopper_outreach_messages', 'consumer_user_id'),
      ('shopper_offers', 'consumer_user_id'),
      ('shopper_deal_events', 'consumer_user_id'),
      ('shopper_deal_lifecycle', 'consumer_user_id'),
      ('shopper_credit_events', 'user_id')
    ) as t(table_name, column_name)
  loop
    if to_regclass('public.' || target.table_name) is null then
      continue;
    end if;

    for old_fk in
      select c.conname
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_attribute att on att.attrelid = rel.oid and att.attnum = any (c.conkey)
      where nsp.nspname = 'public'
        and rel.relname = target.table_name
        and c.contype = 'f'
        and att.attname = target.column_name
    loop
      execute format('alter table public.%I drop constraint %I', target.table_name, old_fk.conname);
    end loop;

    execute format(
      'alter table public.%I alter column %I drop not null',
      target.table_name,
      target.column_name
    );

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      target.table_name,
      target.table_name || '_' || target.column_name || '_fkey',
      target.column_name
    );

    execute format(
      'comment on column public.%I.%I is %L',
      target.table_name,
      target.column_name,
      'Shopper auth user. Null after the shopper deletes their account. The row stays for the dealer desk, the key ledger, or legal retention. shopper_credit_events.user_id is cleared only by this foreign key when auth.users is deleted. The deletion function does not update or delete that table.'
    );
  end loop;
end
$hold$;

-- Word-boundary, case-insensitive name scrub.
-- Also strips the opener suffix ". ZIP #####" and the shopper profile ZIP
-- (##### or #####-####) wherever that ZIP stands alone. A longer number that
-- only contains those digits stays. "Bo" does not rewrite "Boston".
drop function if exists private.scrub_deleted_shopper_text(text, text[]);

create or replace function private.scrub_deleted_shopper_text(
  p_body text,
  p_names text[],
  p_zips text[]
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_zip text;
  v_next text;
  v_pattern text;
begin
  if p_body is null then
    return null;
  end if;
  v_next := pg_catalog.regexp_replace(p_body, '\. ZIP [0-9]{5}(-[0-9]{4})?', '', 'gi');
  if p_zips is not null then
    foreach v_zip in array p_zips loop
      v_zip := pg_catalog.btrim(v_zip);
      if v_zip is null or v_zip !~ '^[0-9]{5}(-[0-9]{4})?$' then
        continue;
      end if;
      v_zip := pg_catalog.left(v_zip, 5);
      v_pattern := '\y' || v_zip || '(-[0-9]{4})?\y';
      v_next := pg_catalog.regexp_replace(v_next, v_pattern, '', 'g');
    end loop;
  end if;
  v_next := pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(v_next, ' {2,}', ' ', 'g'),
    ' +([.,])',
    '\1',
    'g'
  ));
  if p_names is null then
    return v_next;
  end if;
  foreach v_name in array p_names loop
    v_name := pg_catalog.btrim(v_name);
    if v_name is null or pg_catalog.char_length(v_name) < 2 then
      continue;
    end if;
    v_pattern := '\y' || pg_catalog.regexp_replace(v_name, '([^[:alnum:]])', '\\\1', 'g') || '\y';
    v_next := pg_catalog.regexp_replace(v_next, v_pattern, 'A shopper', 'gi');
  end loop;
  return v_next;
end;
$$;

revoke all on function private.scrub_deleted_shopper_text(text, text[], text[]) from public, anon, authenticated, service_role;

drop function if exists private.scrub_deleted_shopper_json(jsonb, text[], text);

create or replace function private.scrub_deleted_shopper_json(
  p_value jsonb,
  p_names text[],
  p_user_id text,
  p_zips text[]
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_item jsonb;
  v_result jsonb;
begin
  if p_value is null then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(p_value) = 'object' then
    v_result := '{}'::jsonb;
    for v_key, v_item in
      select entry.key, entry.value
      from pg_catalog.jsonb_each(p_value) as entry(key, value)
    loop
      if v_key in ('consumer_user_id', 'email', 'phone', 'first_name', 'firstName', 'name', 'zip') then
        continue;
      end if;
      if pg_catalog.jsonb_typeof(v_item) = 'string' and (v_item #>> '{}') = p_user_id then
        continue;
      end if;
      v_result := v_result || pg_catalog.jsonb_build_object(
        v_key,
        private.scrub_deleted_shopper_json(v_item, p_names, p_user_id, p_zips)
      );
    end loop;
    return v_result;
  end if;
  if pg_catalog.jsonb_typeof(p_value) = 'array' then
    v_result := '[]'::jsonb;
    for v_item in
      select entry.value
      from pg_catalog.jsonb_array_elements(p_value) as entry(value)
    loop
      v_result := v_result || pg_catalog.jsonb_build_array(
        private.scrub_deleted_shopper_json(v_item, p_names, p_user_id, p_zips)
      );
    end loop;
    return v_result;
  end if;
  if pg_catalog.jsonb_typeof(p_value) = 'string' then
    return pg_catalog.to_jsonb(private.scrub_deleted_shopper_text(p_value #>> '{}', p_names, p_zips));
  end if;
  return p_value;
end;
$$;

revoke all on function private.scrub_deleted_shopper_json(jsonb, text[], text, text[]) from public, anon, authenticated, service_role;

-- One transaction. A guard, a missing column, or a missing relation raises,
-- and Postgres rolls the whole call back. The API then returns
-- deletion_schema_pending and does not delete the auth user.
--
-- Residual identifier: conversation_identities.email_alias keeps its
-- first-name local part (maya.ab12@offers.drevvy.com). That is not the
-- shopper's real email. It stays so an open dealer reply still routes.
create or replace function public.delete_consumer_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_names text[];
  v_zips text[];
  v_deal_ids uuid[];
  v_identity_ids uuid[];
begin
  if p_user_id is null then
    raise exception 'deletion_schema_pending' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.user_dealerships as membership
    where membership.user_id = p_user_id
  ) then
    raise exception 'dealer_account' using errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.array_agg(distinct pg_catalog.btrim(source.name)), '{}'::text[])
    into v_names
  from (
    select profile.first_name as name
    from public.consumer_profiles as profile
    where profile.user_id = p_user_id
    union all
    select conversation.shopper_first_name
    from public.shopper_dealer_conversations as conversation
    where conversation.consumer_user_id = p_user_id
    union all
    select identity.shopper_first_name
    from public.conversation_identities as identity
    where identity.shopper_id = p_user_id::text
  ) as source
  where source.name is not null
    and pg_catalog.char_length(pg_catalog.btrim(source.name)) >= 2;

  select coalesce(pg_catalog.array_agg(distinct profile.zip), '{}'::text[])
    into v_zips
  from public.consumer_profiles as profile
  where profile.user_id = p_user_id
    and profile.zip ~ '^[0-9]{5}$';

  select coalesce(pg_catalog.array_agg(distinct source.id), '{}'::uuid[])
    into v_deal_ids
  from (
    select deal.id
    from public.shopper_deals as deal
    where deal.consumer_user_id = p_user_id
    union
    select conversation.deal_id
    from public.shopper_dealer_conversations as conversation
    where conversation.consumer_user_id = p_user_id
  ) as source;

  select coalesce(pg_catalog.array_agg(identity.id), '{}'::uuid[])
    into v_identity_ids
  from public.conversation_identities as identity
  where identity.shopper_id = p_user_id::text;

  -- email_alias is a residual identifier: its local part is the first-name slug.
  update public.conversation_identities as identity
  set shopper_id = 'deleted',
      shopper_first_name = 'Deleted'
  where identity.shopper_id = p_user_id::text;

  update public.shopper_deals as deal
  set consumer_user_id = null
  where deal.consumer_user_id = p_user_id;

  update public.shopper_dealer_conversations as conversation
  set consumer_user_id = null,
      shopper_first_name = null,
      opener = 'A shopper wants your best itemized out-the-door'
  where conversation.consumer_user_id = p_user_id;

  update public.shopper_outreach_messages as message
  set consumer_user_id = null,
      body = private.scrub_deleted_shopper_text(message.body, v_names, v_zips)
  where message.consumer_user_id = p_user_id;

  update public.shopper_offers as offer
  set consumer_user_id = null
  where offer.consumer_user_id = p_user_id;

  update public.shopper_deal_events as event
  set consumer_user_id = null,
      detail = private.scrub_deleted_shopper_text(event.detail, v_names, v_zips)
  where event.consumer_user_id = p_user_id;

  -- Prod has public.shopper_deal_lifecycle. This update always runs.
  -- consumer_user_id is nulled here. deal_id is not changed, so its
  -- ON DELETE CASCADE to public.shopper_deals(id) stays.
  update public.shopper_deal_lifecycle as lifecycle
  set consumer_user_id = null
  where lifecycle.consumer_user_id = p_user_id;

  update public.shopper_dealer_messages as message
  set body = case
    when message.author = 'shopper' then 'Removed when this shopper deleted their account.'
    when message.kind = 'opener' then 'A shopper wants your best itemized out-the-door'
    else coalesce(
      nullif(pg_catalog.btrim(private.scrub_deleted_shopper_text(message.body, v_names, v_zips)), ''),
      'Removed when this shopper deleted their account.'
    )
  end
  where message.deal_id = any (v_deal_ids);

  update public.dealer_otd_warnings as warning
  set body = private.scrub_deleted_shopper_text(warning.body, v_names, v_zips)
  where warning.deal_id = any (v_deal_ids);

  update public.brain_vendor_events as event
  set transcript = private.scrub_deleted_shopper_text(event.transcript, v_names, v_zips),
      summary = private.scrub_deleted_shopper_text(event.summary, v_names, v_zips),
      payload = private.scrub_deleted_shopper_json(event.payload, v_names, p_user_id::text, v_zips)
  where event.deal_id = any (
    select pg_catalog.unnest(v_deal_ids)::text
  )
     or event.conversation_identity_id = any (v_identity_ids);

  with touched as (
    update public.app_events as event
    set payload = private.scrub_deleted_shopper_json(event.payload, v_names, p_user_id::text, v_zips)
    where event.payload @> pg_catalog.jsonb_build_object('consumer_user_id', p_user_id::text)
    returning event.flow_id
  )
  update public.app_sessions as session
  set search_location = null
  where session.id in (select touched.flow_id from touched);

  delete from public.saved_cars where user_id = p_user_id;
  delete from public.device_tokens where user_id = p_user_id;
  delete from public.shopper_market_unlocks where user_id = p_user_id;
  delete from public.shopper_market_lookup_hits where user_id = p_user_id;
  delete from public.shopper_market_refund_slots where user_id = p_user_id;
  delete from public.shopper_market_upstream_attempts where user_id = p_user_id;
  delete from public.off_network_otd_requests where consumer_user_id = p_user_id;
  delete from public.shopper_credits where user_id = p_user_id;
  delete from public.consumer_profile_status_events where user_id = p_user_id;
  delete from public.consumer_profiles where user_id = p_user_id;

  -- Do not UPDATE or DELETE public.shopper_credit_events.
  -- starter_grant and purchase:<transaction id> stay on this user_id so a
  -- failed auth.admin.deleteUser cannot grant starter keys or replay a pack.
end;
$$;

revoke all on function public.delete_consumer_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_consumer_account(uuid) to service_role;

comment on function public.delete_consumer_account(uuid) is
  'Deletes one shopper account in a single transaction. service_role only. Does not modify shopper_credit_events. email_alias keeps a first-name local part so dealer replies still route.';
