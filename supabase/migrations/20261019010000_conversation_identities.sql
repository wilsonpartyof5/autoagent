-- Per-conversation contact identities.
-- One shopper + one car (deal) + one dealer keeps one email alias and one
-- text number for the life of that conversation. The assigned addresses do
-- not change, so a dealer CRM does not open a second lead.
-- ADDITIVE ONLY. Applies on merge. Service role only.

create table if not exists public.identity_settings (
  id integer primary key check (id = 1),
  sms_cooldown_days integer not null default 90 check (sms_cooldown_days between 0 and 3650),
  sms_pool_low_watermark integer not null default 2 check (sms_pool_low_watermark between 0 and 1000),
  updated_at timestamptz not null default now()
);

insert into public.identity_settings (id)
values (1)
on conflict (id) do nothing;

comment on table public.identity_settings is
  'Cooldown before a text number is reused at the same dealer for a different shopper, and the pool size that raises a purchase flag.';

create table if not exists public.sms_number_pool (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  label text not null check (char_length(label) between 1 and 80),
  status text not null default 'active' check (status in ('active', 'retired')),
  is_test boolean not null default false,
  last_assigned_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.sms_number_pool is
  'Telnyx text numbers Drevvy can assign. A number may be live at many dealers, and only one live conversation per dealer.';

-- The seeded Drevvy test caller can be assigned in test mode.
insert into public.sms_number_pool (phone_e164, label, status, is_test)
values ('+18039878296', 'test agent 1', 'active', true)
on conflict (phone_e164) do update
set label = excluded.label,
    is_test = excluded.is_test;

create table if not exists public.voice_numbers (
  id uuid primary key default gen_random_uuid(),
  state_code text not null unique check (state_code ~ '^[A-Z]{2}$'),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  label text not null default '' check (char_length(label) <= 80),
  created_at timestamptz not null default now()
);

comment on table public.voice_numbers is
  'Shared caller ID for a state. The voice agent does not give this number out. It asks for a textable number or an email.';

create table if not exists public.conversation_identities (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null,
  dealer_id text not null,
  shopper_id text not null,
  shopper_first_name text not null,
  email_alias text not null,
  sms_number_e164 text not null,
  voice_number_e164 text,
  locked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  is_test boolean not null default false,
  ended_at timestamptz,
  constraint conversation_identities_deal_dealer_unique unique (deal_id, dealer_id),
  constraint conversation_identities_email_alias_unique unique (email_alias),
  constraint conversation_identities_first_name_check check (
    shopper_first_name ~ '^[A-Za-z][A-Za-z .''-]{0,39}$'
    and shopper_first_name !~* 'offers'
    and shopper_first_name !~* 'drevvy'
  ),
  constraint conversation_identities_email_alias_check check (
    email_alias ~ '^[a-z]{1,20}\.[a-z0-9]{4,6}@offers\.drevvy\.com$'
  ),
  constraint conversation_identities_sms_check check (sms_number_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint conversation_identities_voice_check check (
    voice_number_e164 is null or voice_number_e164 ~ '^\+[1-9][0-9]{7,14}$'
  )
);

comment on table public.conversation_identities is
  'Stable From address and text number for one shopper, one car, and one dealer. locked_at marks the assignment. ended_at frees the text number for later reuse without changing this row''s addresses.';

comment on column public.conversation_identities.email_alias is
  'Opaque alias. The display name is the shopper first name. From and Reply-To both use this address.';

comment on column public.conversation_identities.voice_number_e164 is
  'Caller ID copied from the dealer state. Nullable. It is not recited to the dealer.';

create unique index if not exists conversation_identities_live_sms_per_dealer
  on public.conversation_identities (dealer_id, sms_number_e164)
  where ended_at is null;

create index if not exists conversation_identities_sms
  on public.conversation_identities (sms_number_e164);

create table if not exists public.conversation_parties (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversation_identities (id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  our_address text not null,
  their_address text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_parties_pair
  on public.conversation_parties (channel, our_address, their_address);

comment on table public.conversation_parties is
  'Dealer address we already wrote, paired with our alias or text number, so an inbound reply can find the conversation.';

create table if not exists public.conversation_thread_keys (
  message_id text primary key,
  conversation_id uuid not null references public.conversation_identities (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.conversation_thread_keys is
  'Message-ids used when In-Reply-To or References is the only way to attach an inbound email.';

create table if not exists public.unmatched_inbound (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('call', 'sms', 'email', 'voicemail')),
  from_address text,
  to_address text,
  body text,
  in_reply_to text,
  references_header text,
  received_at timestamptz not null default now(),
  reviewed_at timestamptz,
  is_test boolean not null default false
);

create index if not exists unmatched_inbound_open
  on public.unmatched_inbound (received_at desc)
  where reviewed_at is null;

comment on table public.unmatched_inbound is
  'Inbound Telnyx events that did not match an alias, a text-number pair, a thread header, or client state.';

alter table public.consumer_profiles
  add column if not exists first_name text;

do $$ begin
  alter table public.consumer_profiles
    add constraint consumer_profiles_first_name_check
    check (first_name is null or first_name ~ '^[A-Za-z][A-Za-z .''-]{0,39}$');
exception when duplicate_object then null;
end $$;

comment on column public.consumer_profiles.first_name is
  'Shopper first name used when a conversation identity is assigned. Phone and email stay off this table.';

alter table public.brain_vendor_events
  add column if not exists conversation_identity_id uuid;

alter table public.outreach_events
  add column if not exists conversation_identity_id uuid;

alter table public.shopper_outreach_messages
  add column if not exists conversation_identity_id uuid;

create index if not exists brain_vendor_events_identity
  on public.brain_vendor_events (conversation_identity_id, occurred_at desc)
  where conversation_identity_id is not null;

create or replace function private.guard_conversation_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cooldown integer;
begin
  if tg_op = 'UPDATE' then
    if new.deal_id is distinct from old.deal_id
       or new.dealer_id is distinct from old.dealer_id
       or new.shopper_id is distinct from old.shopper_id
       or new.shopper_first_name is distinct from old.shopper_first_name
       or new.email_alias is distinct from old.email_alias
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

drop trigger if exists conversation_identities_guard on public.conversation_identities;
create trigger conversation_identities_guard
  before insert or update on public.conversation_identities
  for each row
  execute function private.guard_conversation_identity();

create or replace function private.touch_sms_pool_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.sms_number_pool
    set last_assigned_at = now()
    where phone_e164 = new.sms_number_e164;
  end if;
  return new;
end;
$$;

revoke all on function private.touch_sms_pool_assignment() from public, anon, authenticated;

drop trigger if exists conversation_identities_touch_pool on public.conversation_identities;
create trigger conversation_identities_touch_pool
  after insert on public.conversation_identities
  for each row
  execute function private.touch_sms_pool_assignment();

do $$ declare t text; begin
  foreach t in array array[
    'identity_settings',
    'sms_number_pool',
    'voice_numbers',
    'conversation_identities',
    'conversation_parties',
    'conversation_thread_keys',
    'unmatched_inbound'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
