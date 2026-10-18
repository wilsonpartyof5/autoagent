-- Sending domains for shopper aliases.
-- One dealer keeps one domain for every conversation. The domain is chosen
-- when the first identity is assigned and does not change. New dealers are
-- spread across the configured list. The apex drevvy.com is not a sending
-- domain.
-- ADDITIVE ONLY. Applies on merge. Service role only.

alter table public.identity_settings
  add column if not exists alias_domains text[] not null
  default array[
    'offers.drevvy.com',
    'deals.drevvy.com',
    'quotes.drevvy.com',
    'buyers.drevvy.com'
  ];

comment on column public.identity_settings.alias_domains is
  'Telnyx sending domains. New dealers are spread across this list. A dealer keeps the domain stored on its identities. ALIAS_DOMAINS overrides this when set.';

create or replace function private.alias_domains_valid(domains text[])
returns boolean
language sql
immutable
as $$
  select domains is not null
    and cardinality(domains) between 1 and 16
    and not exists (
      select 1
      from unnest(domains) as domain
      where domain !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.drevvy\.com$'
    );
$$;

revoke all on function private.alias_domains_valid(text[]) from public, anon, authenticated;

alter table public.identity_settings
  drop constraint if exists identity_settings_alias_domains_check;

alter table public.identity_settings
  add constraint identity_settings_alias_domains_check
  check (private.alias_domains_valid(alias_domains));

alter table public.conversation_identities
  add column if not exists alias_domain text;

update public.conversation_identities
set alias_domain = split_part(email_alias, '@', 2)
where alias_domain is null
  and email_alias ~ '@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.drevvy\.com$';

alter table public.conversation_identities
  alter column alias_domain set not null;

alter table public.conversation_identities
  drop constraint if exists conversation_identities_email_alias_check;

alter table public.conversation_identities
  add constraint conversation_identities_email_alias_check check (
    email_alias ~ '^[a-z]{1,20}\.[a-z0-9]{4,6}@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.drevvy\.com$'
    and split_part(email_alias, '@', 2) = alias_domain
    and split_part(email_alias, '@', 1) !~* 'offers'
    and split_part(email_alias, '@', 1) !~* 'deals'
    and split_part(email_alias, '@', 1) !~* 'quotes'
    and split_part(email_alias, '@', 1) !~* 'buyers'
    and split_part(email_alias, '@', 1) !~* 'drevvy'
  );

alter table public.conversation_identities
  drop constraint if exists conversation_identities_alias_domain_check;

alter table public.conversation_identities
  add constraint conversation_identities_alias_domain_check check (
    alias_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.drevvy\.com$'
  );

alter table public.conversation_identities
  drop constraint if exists conversation_identities_first_name_check;

alter table public.conversation_identities
  add constraint conversation_identities_first_name_check check (
    shopper_first_name ~ '^[A-Za-z][A-Za-z .''-]{0,39}$'
    and shopper_first_name !~* 'offers'
    and shopper_first_name !~* 'deals'
    and shopper_first_name !~* 'quotes'
    and shopper_first_name !~* 'buyers'
    and shopper_first_name !~* 'drevvy'
  );

comment on column public.conversation_identities.alias_domain is
  'Sending domain copied onto this identity at assignment. It stays with the dealer and does not change.';

create index if not exists conversation_identities_dealer_domain
  on public.conversation_identities (dealer_id, alias_domain);

create table if not exists public.dealer_alias_domains (
  dealer_id text primary key,
  alias_domain text not null,
  created_at timestamptz not null default now(),
  constraint dealer_alias_domains_domain_check check (
    alias_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.drevvy\.com$'
  )
);

comment on table public.dealer_alias_domains is
  'The one sending domain for a dealer. The first identity insert wins. Later identities for that dealer must use the same domain.';

insert into public.dealer_alias_domains (dealer_id, alias_domain)
select distinct on (dealer_id) dealer_id, alias_domain
from public.conversation_identities
order by dealer_id, created_at
on conflict (dealer_id) do nothing;

create or replace function private.guard_dealer_alias_domain()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.dealer_id is distinct from old.dealer_id
       or new.alias_domain is distinct from old.alias_domain
    then
      raise exception 'dealer sending domain is locked';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_dealer_alias_domain() from public, anon, authenticated;

drop trigger if exists dealer_alias_domains_guard on public.dealer_alias_domains;
create trigger dealer_alias_domains_guard
  before update on public.dealer_alias_domains
  for each row
  execute function private.guard_dealer_alias_domain();

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

alter table public.dealer_alias_domains enable row level security;
alter table public.dealer_alias_domains force row level security;
revoke all on table public.dealer_alias_domains from public, anon, authenticated;
grant select, insert, update, delete on table public.dealer_alias_domains to service_role;
