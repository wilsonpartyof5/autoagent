-- HELD. Needs DW approval before anyone applies it.
-- Do NOT move this file into supabase/migrations. Files there apply to
-- production on merge. This file does not.
--
-- Why it exists:
-- Shopper account deletion (DELETE /api/consumer/profile) clears the shopper
-- id on dealer chats, outreach, and the key ledger, then deletes auth.users.
-- Today those foreign keys are ON DELETE CASCADE, and two triggers reject the
-- update that clears the shopper. Deleting the auth user would erase dealer
-- threads and the purchase ledger. This change lets those rows stay, with the
-- shopper id set to null (or, for conversation_identities, to the deleted
-- placeholders).
--
-- Until this is applied, the API returns 500 deletion_schema_pending and does
-- not delete the auth user when those rows still point at the shopper.
--
-- Tables this file changes (anonymize and keep):
--   shopper_deals.consumer_user_id
--   shopper_dealer_conversations.consumer_user_id
--   shopper_outreach_messages.consumer_user_id
--   shopper_offers.consumer_user_id
--   shopper_deal_events.consumer_user_id
--   shopper_deal_lifecycle.consumer_user_id   (skipped if the table is absent)
--   shopper_credit_events.user_id
-- Triggers:
--   private.protect_shopper_deal — allow consumer_user_id to become null
--     when the listing, snapshot, status, and timestamps stay put
--   private.guard_conversation_identity — allow shopper_id = 'deleted' and
--     shopper_first_name = 'Deleted' when the alias, numbers, and dealer stay put
--
-- Not changed here, on purpose:
--   saved_cars, device_tokens, shopper_market_*, off_network_otd_requests,
--   shopper_credits, consumer_profiles — the API deletes those rows.
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
set search_path = public
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
      and ended_at > now() - make_interval(days => cooldown)
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
      'Shopper auth user. Null after the shopper deletes their account. The row stays for the dealer desk, the key ledger, or legal retention.'
    );
  end loop;
end
$hold$;
