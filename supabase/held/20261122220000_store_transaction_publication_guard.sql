-- HELD. Do not move this file into supabase/migrations.
-- The Supabase GitHub integration applies files in supabase/migrations on merge.
--
-- Run this in the same manual step as
-- supabase/held/20261122210000_store_transaction_unique_grants.sql,
-- immediately after that file. At apply time this script can be appended
-- to that file. Do not edit the earlier file in git to add this check.
--
-- store_transactions and store_transaction_aliases are service-role only.
-- A publication would copy those rows out of Postgres. This raises if either
-- table appears in pg_publication_tables, or if any publication is
-- FOR ALL TABLES (puballtables).

begin;

do $store_transaction_publication_guard$
begin
  if exists (
    select 1
    from pg_publication_tables
    where schemaname = 'public'
      and tablename in ('store_transactions', 'store_transaction_aliases')
  ) then
    raise exception 'store_transactions or store_transaction_aliases is in a publication';
  end if;

  if exists (
    select 1
    from pg_publication
    where puballtables is true
  ) then
    raise exception 'a publication has puballtables = true';
  end if;
end
$store_transaction_publication_guard$;

commit;
