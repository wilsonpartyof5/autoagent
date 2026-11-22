-- HELD. Do not move this file into supabase/migrations.
-- The Supabase GitHub integration applies files in supabase/migrations on merge.
-- Apply this file by hand BEFORE production purchases can grant.
-- Until it is applied, a production claim or restore returns 503 and a
-- PRODUCTION webhook returns 500. Neither grants keys. Allowlisted sandbox
-- grants may still use the previous purchase function. Refunds still call
-- reverse_purchase_atomic, which keeps its previous signature.
--
-- One App Store / RevenueCat transaction grants keys to one shopper.
-- The table, not a partial unique index, is the source of truth because a
-- refund must find that shopper when the webhook names a different app user.
-- Aliases (RevenueCat id, store transaction id, store transaction id form)
-- live on the row and in store_transaction_aliases so a refund or a later
-- grant can match any of them. A reversal recorded first is a tombstone:
-- reversed_at is set and a later grant of any alias does not add keys.
-- A refund debits store_transactions.pack_size, not the product on the event.
--
-- Pre-check (report only, do not delete). Run this before the rest of the file
-- and keep the rows. The backfill below keeps the earliest purchase and does
-- not delete the others:
--
-- select
--   substring(e.idempotency_key from length('purchase:') + 1) as transaction_id,
--   count(distinct e.user_id) as user_count,
--   array_agg(distinct e.user_id) as user_ids
-- from public.shopper_credit_events e
-- where e.event_type = 'purchase'
--   and e.idempotency_key like 'purchase:%'
-- group by 1
-- having count(distinct e.user_id) > 1
-- order by user_count desc, transaction_id;

do $report$
declare
  v_row record;
begin
  for v_row in
    select
      substring(e.idempotency_key from length('purchase:') + 1) as transaction_id,
      count(distinct e.user_id) as user_count,
      array_agg(distinct e.user_id) as user_ids
    from public.shopper_credit_events e
    where e.event_type = 'purchase'
      and e.idempotency_key like 'purchase:%'
    group by 1
    having count(distinct e.user_id) > 1
    order by user_count desc, transaction_id
  loop
    raise warning 'store transaction % is already granted to % users: %',
      v_row.transaction_id, v_row.user_count, v_row.user_ids;
  end loop;
end
$report$;

create table if not exists public.store_transactions (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id),
  product_id text,
  pack_size integer not null check (pack_size > 0),
  pack_price_cents integer,
  aliases text[] not null default '{}',
  granted_at timestamptz not null default now(),
  reversed_at timestamptz
);

alter table public.store_transactions add column if not exists pack_price_cents integer;
alter table public.store_transactions add column if not exists aliases text[] not null default '{}';

create index if not exists store_transactions_aliases_gin
  on public.store_transactions using gin (aliases);

comment on table public.store_transactions is
  'One canonical store transaction grants keys to one shopper. Service role only.';

alter table public.store_transactions enable row level security;
alter table public.store_transactions force row level security;

revoke all on table public.store_transactions from anon, authenticated, public;
grant select, insert, update, delete on table public.store_transactions to service_role;

create table if not exists public.store_transaction_aliases (
  alias text primary key,
  transaction_id text not null references public.store_transactions(transaction_id)
);

comment on table public.store_transaction_aliases is
  'Every id form of one store transaction. Service role only.';

alter table public.store_transaction_aliases enable row level security;
alter table public.store_transaction_aliases force row level security;

revoke all on table public.store_transaction_aliases from anon, authenticated, public;
grant select, insert, update, delete on table public.store_transaction_aliases to service_role;

-- Earliest ledger purchase wins. Later grants for the same id are left in
-- shopper_credit_events and are not deleted. Historical rows only know the
-- id that was stored in the idempotency key.
insert into public.store_transactions (
  transaction_id, user_id, product_id, pack_size, pack_price_cents, aliases, granted_at
)
select distinct on (substring(e.idempotency_key from length('purchase:') + 1))
  substring(e.idempotency_key from length('purchase:') + 1),
  e.user_id,
  null,
  coalesce(e.pack_size, e.amount),
  null,
  array[substring(e.idempotency_key from length('purchase:') + 1)],
  e.created_at
from public.shopper_credit_events e
where e.event_type = 'purchase'
  and e.idempotency_key like 'purchase:%'
  and length(substring(e.idempotency_key from length('purchase:') + 1)) > 0
  and coalesce(e.pack_size, e.amount) > 0
order by substring(e.idempotency_key from length('purchase:') + 1), e.created_at asc
on conflict (transaction_id) do nothing;

update public.store_transactions
set aliases = array[transaction_id]
where aliases = '{}' or aliases is null;

insert into public.store_transaction_aliases (alias, transaction_id)
select transaction_id, transaction_id
from public.store_transactions
on conflict (alias) do nothing;

update public.store_transactions t
set reversed_at = r.created_at
from public.shopper_credit_events r
where r.user_id = t.user_id
  and r.idempotency_key = 'purchase_reversal:' || t.transaction_id
  and t.reversed_at is null;

drop function if exists public.purchase_credits_atomic(uuid, integer, integer, text, text);
drop function if exists public.purchase_credits_atomic(uuid, integer, integer, text, text, text);
drop function if exists public.purchase_credits_atomic(uuid, integer, integer, text, text, text, text[]);

create function public.purchase_credits_atomic(
  p_user_id uuid,
  p_pack_size integer,
  p_pack_price_usd integer,
  p_idempotency_key text,
  p_reversal_key text,
  p_product_id text default null,
  p_aliases text[] default null
)
returns table(
  granted boolean,
  already_granted boolean,
  balance integer,
  lifetime_purchased integer,
  lifetime_used integer,
  lifetime_refunded integer,
  already_granted_elsewhere boolean
)
language plpgsql
security definer
set search_path = public
as $purchase$
declare
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
  v_tx text;
  v_alias text;
  v_aliases text[];
  v_hit_tx text;
  v_hit_user uuid;
  v_hit_reversed timestamptz;
begin
  if p_pack_size is null or p_pack_size <= 0 then
    raise exception 'pack size must be positive';
  end if;
  if p_pack_price_usd is null or p_pack_price_usd <= 0 then
    raise exception 'pack price must be positive';
  end if;

  v_tx := substring(p_idempotency_key from length('purchase:') + 1);
  if p_idempotency_key not like 'purchase:%' or length(v_tx) = 0 then
    raise exception 'purchase idempotency key is required';
  end if;

  v_aliases := array[v_tx];
  if p_aliases is not null then
    foreach v_alias in array p_aliases loop
      if v_alias is not null and btrim(v_alias) <> '' and not (btrim(v_alias) = any (v_aliases)) then
        v_aliases := array_append(v_aliases, btrim(v_alias));
      end if;
    end loop;
  end if;

  insert into public.shopper_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select c.balance, c.lifetime_purchased, c.lifetime_used, c.lifetime_refunded
    into v_balance, v_purchased, v_used, v_refunded
  from public.shopper_credits c
  where c.user_id = p_user_id
  for update;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = p_idempotency_key
  ) then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded, false;
    return;
  end if;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = p_user_id and e.idempotency_key = p_reversal_key
  ) then
    return query select false, false, v_balance, v_purchased, v_used, v_refunded, false;
    return;
  end if;

  select s.transaction_id, s.user_id, s.reversed_at
    into v_hit_tx, v_hit_user, v_hit_reversed
  from public.store_transaction_aliases a
  join public.store_transactions s on s.transaction_id = a.transaction_id
  where a.alias = any (v_aliases)
  order by s.reversed_at nulls last
  limit 1
  for update of s;

  if found then
    if v_hit_reversed is not null or v_hit_user = p_user_id then
      return query select false, false, v_balance, v_purchased, v_used, v_refunded, false;
      return;
    end if;
    return query select false, false, v_balance, v_purchased, v_used, v_refunded, true;
    return;
  end if;

  begin
    insert into public.store_transactions (
      transaction_id, user_id, product_id, pack_size, pack_price_cents, aliases
    )
    values (
      v_tx,
      p_user_id,
      nullif(btrim(p_product_id), ''),
      p_pack_size,
      p_pack_price_usd,
      v_aliases
    );

    insert into public.store_transaction_aliases (alias, transaction_id)
    select alias_id, v_tx
    from unnest(v_aliases) as alias_id;

    insert into public.shopper_credit_events (
      user_id, event_type, amount, pack_size, pack_price_usd, pack_price_cents, idempotency_key
    )
    values (
      p_user_id, 'purchase', p_pack_size, p_pack_size, null, p_pack_price_usd, p_idempotency_key
    );
  exception when unique_violation then
    select s.transaction_id, s.user_id, s.reversed_at
      into v_hit_tx, v_hit_user, v_hit_reversed
    from public.store_transaction_aliases a
    join public.store_transactions s on s.transaction_id = a.transaction_id
    where a.alias = any (v_aliases)
    order by s.reversed_at nulls last
    limit 1;
    if v_hit_user is not null and v_hit_reversed is null and v_hit_user <> p_user_id then
      return query select false, false, v_balance, v_purchased, v_used, v_refunded, true;
      return;
    end if;
    if exists (
      select 1 from public.shopper_credit_events e
      where e.user_id = p_user_id and e.idempotency_key = p_idempotency_key
    ) then
      return query select false, true, v_balance, v_purchased, v_used, v_refunded, false;
      return;
    end if;
    return query select false, false, v_balance, v_purchased, v_used, v_refunded, false;
    return;
  end;

  update public.shopper_credits
  set balance = shopper_credits.balance + p_pack_size,
      lifetime_purchased = shopper_credits.lifetime_purchased + p_pack_size,
      updated_at = now()
  where user_id = p_user_id
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded, false;
end;
$purchase$;

revoke execute on function public.purchase_credits_atomic(uuid, integer, integer, text, text, text, text[]) from anon, authenticated, public;
grant execute on function public.purchase_credits_atomic(uuid, integer, integer, text, text, text, text[]) to service_role;

create or replace function public.reverse_purchase_atomic(
  p_user_id uuid,
  p_amount integer,
  p_purchase_key text,
  p_reversal_key text
)
returns table(
  reversed boolean,
  already_reversed boolean,
  balance integer,
  lifetime_purchased integer,
  lifetime_used integer,
  lifetime_refunded integer
)
language plpgsql
security definer
set search_path = public
as $reverse$
declare
  v_balance integer;
  v_purchased integer;
  v_used integer;
  v_refunded integer;
  v_purchased_before boolean;
  v_event_tx text;
  v_tx text;
  v_target uuid;
  v_amount integer;
  v_purchase_key text;
  v_reversal_key text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'reversal amount must be positive';
  end if;

  v_event_tx := substring(p_purchase_key from length('purchase:') + 1);
  v_target := p_user_id;
  v_amount := p_amount;
  v_tx := v_event_tx;
  v_purchase_key := p_purchase_key;
  v_reversal_key := p_reversal_key;

  if p_purchase_key like 'purchase:%' and length(v_event_tx) > 0 then
    select s.transaction_id, s.user_id, s.pack_size
      into v_tx, v_target, v_amount
    from public.store_transaction_aliases a
    join public.store_transactions s on s.transaction_id = a.transaction_id
    where a.alias = v_event_tx
    for update of s;
    if not found then
      select s.transaction_id, s.user_id, s.pack_size
        into v_tx, v_target, v_amount
      from public.store_transactions s
      where s.transaction_id = v_event_tx
      for update;
    end if;
    if found then
      v_purchase_key := 'purchase:' || v_tx;
      v_reversal_key := 'purchase_reversal:' || v_tx;
    else
      v_target := p_user_id;
      v_amount := p_amount;
      v_tx := v_event_tx;
      v_purchase_key := p_purchase_key;
      v_reversal_key := p_reversal_key;
    end if;
  end if;

  insert into public.shopper_credits (user_id)
  values (v_target)
  on conflict (user_id) do nothing;

  select c.balance, c.lifetime_purchased, c.lifetime_used, c.lifetime_refunded
    into v_balance, v_purchased, v_used, v_refunded
  from public.shopper_credits c
  where c.user_id = v_target
  for update;

  if exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = v_target and e.idempotency_key = v_reversal_key
  ) then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  v_purchased_before := exists (
    select 1 from public.shopper_credit_events e
    where e.user_id = v_target and e.idempotency_key = v_purchase_key
  );

  begin
    insert into public.shopper_credit_events (
      user_id, event_type, amount, pack_size, idempotency_key
    )
    values (v_target, 'refund', v_amount, v_amount, v_reversal_key);
  exception when unique_violation then
    return query select false, true, v_balance, v_purchased, v_used, v_refunded;
    return;
  end;

  if v_purchase_key like 'purchase:%' and length(v_tx) > 0 then
    insert into public.store_transactions (
      transaction_id, user_id, product_id, pack_size, aliases, reversed_at
    )
    values (v_tx, v_target, null, v_amount, array[v_tx], now())
    on conflict (transaction_id) do update
      set reversed_at = coalesce(public.store_transactions.reversed_at, excluded.reversed_at);

    insert into public.store_transaction_aliases (alias, transaction_id)
    values (v_tx, v_tx)
    on conflict (alias) do nothing;

    if v_event_tx <> v_tx then
      insert into public.store_transaction_aliases (alias, transaction_id)
      values (v_event_tx, v_tx)
      on conflict (alias) do nothing;
    end if;
  end if;

  if not v_purchased_before then
    return query select false, false, v_balance, v_purchased, v_used, v_refunded;
    return;
  end if;

  update public.shopper_credits
  set balance = greatest(shopper_credits.balance - v_amount, 0),
      lifetime_refunded = shopper_credits.lifetime_refunded + v_amount,
      updated_at = now()
  where user_id = v_target
  returning shopper_credits.balance, shopper_credits.lifetime_purchased,
            shopper_credits.lifetime_used, shopper_credits.lifetime_refunded
  into v_balance, v_purchased, v_used, v_refunded;

  return query select true, false, v_balance, v_purchased, v_used, v_refunded;
end;
$reverse$;

revoke execute on function public.reverse_purchase_atomic(uuid, integer, text, text) from anon, authenticated, public;
grant execute on function public.reverse_purchase_atomic(uuid, integer, text, text) to service_role;

-- Rollback (do not run as part of this file):
-- drop function if exists public.purchase_credits_atomic(uuid, integer, integer, text, text, text, text[]);
-- Recreate public.purchase_credits_atomic(uuid, integer, integer, text, text)
-- from supabase/migrations/20261026120000_key_spend_and_refunds.sql.
-- Recreate public.reverse_purchase_atomic(uuid, integer, text, text)
-- from supabase/migrations/20261019220620_qualify_credit_balance_columns.sql.
-- drop table if exists public.store_transaction_aliases;
-- drop table if exists public.store_transactions;
