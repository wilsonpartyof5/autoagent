import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOFTOP_SQL = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261109170000_lock_rooftop_self_claim.sql'),
  'utf8',
);
const LEAD_SQL = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261109170100_hide_lead_contact_payloads.sql'),
  'utf8',
);

const SHOPPER = '11111111-1111-4111-8111-111111111111';
const DEALER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const SALES = '44444444-4444-4444-8444-444444444444';
const CONTACT = 'CONTACT-BLOB-9f3a';
const ADF = '<adf><email>shopper-secret@example.com</email></adf>';
const INVITE = 'invite-token-lakeside-0001';

async function boot(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    alter role service_role bypassrls;

    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      email text
    );

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;

    insert into auth.users (id) values
      ('${SHOPPER}'),
      ('${DEALER}'),
      ('${ADMIN}'),
      ('${SALES}');

    create table public.profiles (
      id uuid primary key,
      platform_role text not null default 'dealer_user'
    );
    insert into public.profiles (id, platform_role) values
      ('${SHOPPER}', 'dealer_user'),
      ('${DEALER}', 'dealer_user'),
      ('${ADMIN}', 'platform_admin'),
      ('${SALES}', 'dealer_user');

    create schema if not exists private;
    create or replace function private.is_platform_admin()
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
    as $$
      select exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.platform_role = 'platform_admin'
      );
    $$;

    create table public.dealerships (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      marketcheck_dealer_id text,
      marketcheck_zip text,
      marketcheck_website_url text,
      logo_url text,
      created_by uuid references auth.users(id),
      created_at timestamptz not null default timezone('utc'::text, now()),
      updated_at timestamptz not null default timezone('utc'::text, now())
    );

    create table public.user_dealerships (
      user_id uuid not null references auth.users(id) on delete cascade,
      dealership_id uuid not null references public.dealerships(id) on delete cascade,
      role text default 'owner',
      created_at timestamptz not null default timezone('utc'::text, now()),
      primary key (user_id, dealership_id)
    );

    create table public.leads (
      id text primary key,
      dealer_id text,
      dealership_id uuid references public.dealerships(id),
      vehicle_id text not null,
      vin text,
      enc_payload text not null,
      consent boolean not null default true,
      created_at timestamptz not null default timezone('utc'::text, now()),
      user_id uuid,
      status text default 'new',
      replied_at timestamptz
    );

    create table public.lead_delivery_logs (
      id uuid primary key default gen_random_uuid(),
      lead_id text not null,
      user_id uuid,
      dealer_id text,
      delivery_method text not null,
      delivery_target text not null,
      status text not null,
      http_status integer,
      response_body text,
      error_message text,
      adf_payload xml not null,
      attempted_at timestamptz not null default timezone('utc'::text, now()),
      attempted_by text default 'system',
      resend_note text,
      created_at timestamptz not null default timezone('utc'::text, now())
    );

    alter table public.dealerships enable row level security;
    alter table public.user_dealerships enable row level security;
    alter table public.leads enable row level security;
    alter table public.lead_delivery_logs enable row level security;

    grant select, insert, update, delete on public.dealerships to anon, authenticated;
    grant select, insert, update, delete on public.user_dealerships to anon, authenticated;
    grant select, insert, update, delete on public.leads to anon, authenticated;
    grant select, insert, update, delete on public.lead_delivery_logs to anon, authenticated;
  `);
  await db.exec(ROOFTOP_SQL);
  await db.exec(LEAD_SQL);
  await db.exec(`
    create policy "Users can view their memberships"
      on public.user_dealerships for select to authenticated
      using (user_id = (select auth.uid()));

    create policy "Members can view dealerships"
      on public.dealerships for select to authenticated
      using (
        exists (
          select 1 from public.user_dealerships ud
          where ud.dealership_id = dealerships.id
            and ud.user_id = (select auth.uid())
        )
      );

    create policy "Owners can update dealerships"
      on public.dealerships for update to authenticated
      using (
        exists (
          select 1 from public.user_dealerships ud
          where ud.dealership_id = dealerships.id
            and ud.user_id = (select auth.uid())
            and ud.role in ('owner', 'owner_gm')
        )
      )
      with check (
        exists (
          select 1 from public.user_dealerships ud
          where ud.dealership_id = dealerships.id
            and ud.user_id = (select auth.uid())
            and ud.role in ('owner', 'owner_gm')
        )
      );

    create policy "Members can view dealership leads"
      on public.leads for select to authenticated
      using (
        exists (
          select 1 from public.user_dealerships ud
          where ud.user_id = (select auth.uid())
            and ud.dealership_id = leads.dealership_id
        )
      );

    create policy "Members can update dealership leads"
      on public.leads for update to authenticated
      using (
        exists (
          select 1 from public.user_dealerships ud
          where ud.user_id = (select auth.uid())
            and ud.dealership_id = leads.dealership_id
        )
      )
      with check (
        exists (
          select 1 from public.user_dealerships ud
          where ud.user_id = (select auth.uid())
            and ud.dealership_id = leads.dealership_id
        )
      );

    create policy "Members can view dealership delivery logs"
      on public.lead_delivery_logs for select to authenticated
      using (
        exists (
          select 1
          from public.user_dealerships ud
          join public.dealerships d on d.id = ud.dealership_id
          where ud.user_id = (select auth.uid())
            and d.marketcheck_dealer_id = lead_delivery_logs.dealer_id
        )
      );

    grant select, update on public.dealerships to authenticated;
    grant select on public.user_dealerships to authenticated;
  `);
  return db;
}

async function actAs(
  db: PGlite,
  userId: string | null,
  role: 'authenticated' | 'anon' | 'service_role',
): Promise<void> {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.query(`select set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.exec(`set role ${role}`);
}

async function actAsOwner(db: PGlite): Promise<void> {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.query(`select set_config('request.jwt.claim.role', '', false)`);
}

async function expectReject(
  db: PGlite,
  run: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  let failed = false;
  try {
    await run();
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern);
  } finally {
    await db.exec('rollback').catch(() => undefined);
  }
  assert.equal(failed, true);
}

async function flag(db: PGlite, sql: string): Promise<boolean> {
  const result = await db.query<{ ok: boolean }>(sql);
  return result.rows[0]?.ok === true;
}

async function count(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  const result = await db.query<{ n: number | string }>(sql, params);
  return Number(result.rows[0]?.n ?? 0);
}

test('a shopper JWT cannot create or claim a rooftop, and operator or invite paths still can', async () => {
  const db = await boot();
  try {
    const hondaKey = await db.query<{ key: string }>(
      `select public.rooftop_website_key($1) as key`,
      ['https://www.HondaCars.example/'],
    );
    const sameKey = await db.query<{ key: string }>(
      `select public.rooftop_website_key($1) as key`,
      ['http://hondacars.example'],
    );
    const otherKey = await db.query<{ key: string }>(
      `select public.rooftop_website_key($1) as key`,
      ['https://www.group.example/rock-hill'],
    );
    assert.equal(hondaKey.rows[0]?.key, 'hondacars.example');
    assert.equal(sameKey.rows[0]?.key, 'hondacars.example');
    assert.equal(otherKey.rows[0]?.key, 'group.example/rock-hill');

    assert.equal(await flag(
      db,
      `select has_function_privilege('authenticated', 'public.create_own_dealership(text,text,text,text,text)', 'execute') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_function_privilege('anon', 'public.create_own_dealership(text,text,text,text,text)', 'execute') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_function_privilege('service_role', 'public.create_onboarded_rooftop(uuid,text,text,text,text,text,text)', 'execute') as ok`,
    ), true);
    assert.equal(await flag(
      db,
      `select has_function_privilege('authenticated', 'public.issue_dealership_invite(text,text,text,text,text,text,uuid,timestamptz,text)', 'execute') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_function_privilege('authenticated', 'public.accept_dealership_invite(text)', 'execute') as ok`,
    ), true);
    assert.equal(await flag(
      db,
      `select has_table_privilege('authenticated', 'public.dealerships', 'INSERT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_table_privilege('authenticated', 'public.user_dealerships', 'INSERT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_table_privilege('authenticated', 'public.dealership_invites', 'SELECT') as ok`,
    ), false);

    await actAs(db, null, 'service_role');
    const honda = await db.query<{ id: string; onboarded_at: string }>(
      `select id, onboarded_at
       from public.create_onboarded_rooftop($1, $2, $3, null, $4, null, 'owner')`,
      [DEALER, 'Honda Cars', '1038994', 'https://www.HondaCars.example/'],
    );
    const hondaId = honda.rows[0]?.id ?? '';
    assert.equal(hondaId.length > 0, true);
    assert.equal(honda.rows[0]?.onboarded_at != null, true);

    await expectReject(
      db,
      () => db.query(
        `select id from public.create_onboarded_rooftop($1, $2, $3, null, $4, null, 'owner')`,
        [DEALER, 'Honda copy', '1038994', 'https://other.example'],
      ),
      /marketcheck dealer id is already claimed/,
    );
    await expectReject(
      db,
      () => db.query(
        `select id from public.create_onboarded_rooftop($1, $2, null, null, $3, null, 'owner')`,
        [DEALER, 'Honda web', 'http://hondacars.example'],
      ),
      /rooftop website is already claimed/,
    );

    const invited = await db.query<{ token: string }>(
      `select token
       from public.issue_dealership_invite($1, $2, null, $3, null, 'owner', null, null, $4)`,
      ['Lakeside', '555', 'https://www.lakeside.example/sales', INVITE],
    );
    assert.equal(invited.rows[0]?.token, INVITE);
    await expectReject(
      db,
      () => db.query(
        `select token from public.issue_dealership_invite($1, $2, null, $3, null, 'owner', null, null, null)`,
        ['Lakeside copy', '555', 'https://unused.example'],
      ),
      /marketcheck dealer id is already claimed/,
    );

    await actAs(db, SHOPPER, 'authenticated');
    await expectReject(
      db,
      () => db.query(
        `select id from public.create_own_dealership($1, $2, null, $3, null)`,
        ['Stolen Honda', '1038994', 'https://stolen.example'],
      ),
      /permission denied for function create_own_dealership/i,
    );
    await expectReject(
      db,
      () => db.query(
        `select id from public.create_onboarded_rooftop($1, $2, $3, null, null, null, 'owner')`,
        [SHOPPER, 'Stolen', '999',],
      ),
      /permission denied for function create_onboarded_rooftop/i,
    );
    await expectReject(
      db,
      () => db.query(`select token from public.issue_dealership_invite('Nope', '1', null, null, null, 'owner', null, null, null)`),
      /permission denied for function issue_dealership_invite/i,
    );
    await expectReject(
      db,
      () => db.query(`select id from public.accept_dealership_invite($1)`, ['not-a-real-invite-token']),
      /invite not found/,
    );
    await expectReject(
      db,
      () => db.query(`select token from public.dealership_invites`),
      /permission denied/i,
    );
    await actAsOwner(db);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.dealerships where btrim(marketcheck_dealer_id) = '1038994'`,
    ), 1);

    await actAsOwner(db);
    await db.exec(`grant execute on function public.create_own_dealership(text, text, text, text, text) to authenticated`);
    await actAs(db, SHOPPER, 'authenticated');
    await expectReject(
      db,
      () => db.query(
        `select id from public.create_own_dealership($1, $2, null, $3, null)`,
        ['Still stolen', '1038994', 'https://stolen.example'],
      ),
      /shoppers cannot create or claim a rooftop/,
    );
    await actAsOwner(db);
    await db.exec(`revoke execute on function public.create_own_dealership(text, text, text, text, text) from authenticated`);

    await actAs(db, DEALER, 'authenticated');
    const lakeside = await db.query<{ id: string; marketcheck_dealer_id: string; onboarded_at: string }>(
      `select id, marketcheck_dealer_id, onboarded_at from public.accept_dealership_invite($1)`,
      [INVITE],
    );
    assert.equal(lakeside.rows[0]?.marketcheck_dealer_id, '555');
    assert.equal(lakeside.rows[0]?.onboarded_at != null, true);
    const lakesideId = lakeside.rows[0]?.id ?? '';
    const retry = await db.query<{ id: string }>(
      `select id from public.accept_dealership_invite($1)`,
      [INVITE],
    );
    assert.equal(retry.rows[0]?.id, lakesideId);

    await actAs(db, SALES, 'authenticated');
    await expectReject(
      db,
      () => db.query(`select id from public.accept_dealership_invite($1)`, [INVITE]),
      /invite already used/,
    );

    await actAsOwner(db);
    const join = await db.query<{ token: string }>(
      `select token from public.issue_dealership_invite(null, null, null, null, null, 'salesperson', $1, null, null)`,
      [hondaId],
    );
    const joinToken = join.rows[0]?.token ?? '';
    assert.equal(joinToken.length >= 20, true);
    await actAs(db, SALES, 'authenticated');
    const joined = await db.query<{ id: string }>(
      `select id from public.accept_dealership_invite($1)`,
      [joinToken],
    );
    assert.equal(joined.rows[0]?.id, hondaId);
    await actAsOwner(db);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.user_dealerships where user_id = $1 and dealership_id = $2`,
      [SALES, hondaId],
    ), 1);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.dealerships where btrim(marketcheck_dealer_id) = '1038994'`,
    ), 1);

    await actAs(db, null, 'service_role');
    const empty = await db.query<{ id: string }>(
      `select id from public.create_onboarded_rooftop($1, 'Empty lot', null, null, null, null, 'owner')`,
      [SHOPPER],
    );
    const emptyId = empty.rows[0]?.id ?? '';
    await actAs(db, SHOPPER, 'authenticated');
    await db.query(`update public.dealerships set name = 'Shopper renamed' where id = $1`, [emptyId]);
    await expectReject(
      db,
      () => db.query(
        `update public.dealerships set marketcheck_dealer_id = '1038994' where id = $1`,
        [emptyId],
      ),
      /rooftop network identity cannot be changed from the client/,
    );
    await expectReject(
      db,
      () => db.query(
        `update public.dealerships set marketcheck_website_url = 'https://hondacars.example' where id = $1`,
        [emptyId],
      ),
      /rooftop network identity cannot be changed from the client/,
    );
    await expectReject(
      db,
      () => db.query(
        `insert into public.dealerships (name, marketcheck_dealer_id) values ('Direct', '4242')`,
      ),
      /permission denied/i,
    );
    await expectReject(
      db,
      () => db.query(
        `insert into public.user_dealerships (user_id, dealership_id, role) values ($1, $2, 'owner')`,
        [SHOPPER, hondaId],
      ),
      /permission denied/i,
    );

    await actAsOwner(db);
    await db.exec(`grant insert on public.dealerships to authenticated`);
    await actAs(db, SHOPPER, 'authenticated');
    await expectReject(
      db,
      () => db.query(`insert into public.dealerships (name) values ('Direct anyway')`),
      /rooftops cannot be created from the client/,
    );
    await actAsOwner(db);
    await db.exec(`revoke insert on public.dealerships from authenticated`);

    const renamed = await db.query<{ name: string; marketcheck_dealer_id: string | null }>(
      `select name, marketcheck_dealer_id from public.dealerships where id = $1`,
      [emptyId],
    );
    assert.equal(renamed.rows[0]?.name, 'Shopper renamed');
    assert.equal(renamed.rows[0]?.marketcheck_dealer_id, null);

    await db.query(
      `insert into public.dealerships (id, name, marketcheck_dealer_id, onboarded_at)
       values ('99999999-9999-4999-8999-999999999999', 'Not yet', '7777', null)`,
    );
    await db.query(
      `insert into public.user_dealerships (user_id, dealership_id, role)
       values ($1, '99999999-9999-4999-8999-999999999999', 'owner')`,
      [DEALER],
    );

    const network = await db.query<{ marketcheck_dealer_id: string | null }>(
      `select d.marketcheck_dealer_id
       from public.dealerships d
       join public.user_dealerships ud on ud.dealership_id = d.id
       where d.onboarded_at is not null
       order by d.marketcheck_dealer_id nulls last`,
    );
    const ids = network.rows.map((row) => row.marketcheck_dealer_id);
    assert.equal(ids.includes('1038994'), true);
    assert.equal(ids.includes('555'), true);
    assert.equal(ids.includes('7777'), false);
    assert.equal(await count(db, `select count(*)::int as n from public.dealerships`), 4);

    await actAs(db, ADMIN, 'authenticated');
    await expectReject(
      db,
      () => db.query(`select id from public.create_own_dealership('Admin store', '8888', null, 'https://admin-store.example', null)`),
      /permission denied for function create_own_dealership/i,
    );
    await actAsOwner(db);
    await db.exec(`grant execute on function public.create_own_dealership(text, text, text, text, text) to authenticated`);
    await actAs(db, ADMIN, 'authenticated');
    const adminRoof = await db.query<{ marketcheck_dealer_id: string; onboarded_at: string }>(
      `select marketcheck_dealer_id, onboarded_at
       from public.create_own_dealership('Admin store', '8888', null, 'https://admin-store.example', null)`,
    );
    assert.equal(adminRoof.rows[0]?.marketcheck_dealer_id, '8888');
    assert.equal(adminRoof.rows[0]?.onboarded_at != null, true);
    await actAsOwner(db);
    await db.exec(`revoke all on function public.create_own_dealership(text, text, text, text, text) from authenticated`);
    assert.equal(await flag(
      db,
      `select has_function_privilege('authenticated', 'public.create_own_dealership(text,text,text,text,text)', 'execute') as ok`,
    ), false);
  } finally {
    await db.exec('reset role').catch(() => undefined);
    await db.close();
  }
});

test('a shopper or dealer JWT cannot read or update lead contact payloads', async () => {
  const db = await boot();
  try {
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.leads', 'enc_payload', 'SELECT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.leads', 'enc_payload', 'UPDATE') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_column_privilege('anon', 'public.leads', 'enc_payload', 'SELECT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.leads', 'vin', 'SELECT') as ok`,
    ), true);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.leads', 'vin', 'UPDATE') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.leads', 'status', 'UPDATE') as ok`,
    ), true);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.leads', 'replied_at', 'SELECT') as ok`,
    ), true);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.lead_delivery_logs', 'adf_payload', 'SELECT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.lead_delivery_logs', 'adf_payload', 'UPDATE') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_column_privilege('authenticated', 'public.lead_delivery_logs', 'response_body', 'SELECT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_table_privilege('authenticated', 'public.lead_delivery_logs', 'INSERT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_function_privilege('authenticated', 'public.update_dealer_lead_status(text,text)', 'execute') as ok`,
    ), true);

    const viewColumns = await db.query<{ column_name: string }>(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'dealer_leads'`,
    );
    const leadView = viewColumns.rows.map((row) => row.column_name);
    assert.equal(leadView.includes('enc_payload'), false);
    assert.equal(leadView.includes('vin'), true);
    assert.equal(leadView.includes('status'), true);
    assert.equal(leadView.includes('replied_at'), true);

    const logColumns = await db.query<{ column_name: string }>(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'dealer_lead_delivery_logs'`,
    );
    const logView = logColumns.rows.map((row) => row.column_name);
    assert.equal(logView.includes('adf_payload'), false);
    assert.equal(logView.includes('response_body'), false);
    assert.equal(logView.includes('status'), true);
    assert.equal(logView.includes('delivery_target'), true);

    const options = await db.query<{ reloptions: string[] | null }>(
      `select c.reloptions
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'dealer_leads'`,
    );
    assert.equal((options.rows[0]?.reloptions ?? []).includes('security_invoker=true'), true);

    await actAs(db, null, 'service_role');
    const honda = await db.query<{ id: string }>(
      `select id from public.create_onboarded_rooftop($1, 'Honda Cars', '1038994', null, 'https://hondacars.example', null, 'owner')`,
      [DEALER],
    );
    const hondaId = honda.rows[0]?.id;
    await actAsOwner(db);
    await db.query(
      `insert into public.leads (id, dealer_id, dealership_id, vehicle_id, vin, enc_payload, status)
       values ('lead-1', '1038994', $1, 'veh-1', '1HGCM82633A004352', $2, 'new')`,
      [hondaId, CONTACT],
    );
    await db.query(
      `insert into public.lead_delivery_logs
         (lead_id, dealer_id, delivery_method, delivery_target, status, adf_payload, response_body)
       values ('lead-1', '1038994', 'email', 'crm@dealer.example', 'success', $1::xml, $2)`,
      [ADF, '<echo>shopper-secret@example.com</echo>'],
    );

    const operatorPayload = await db.query<{ enc_payload: string }>(
      `select enc_payload from public.leads where id = 'lead-1'`,
    );
    assert.equal(operatorPayload.rows[0]?.enc_payload, CONTACT);

    await actAs(db, DEALER, 'authenticated');
    const visible = await db.query<{ vin: string; status: string; replied_at: string | null }>(
      `select vin, status, replied_at from public.dealer_leads where id = 'lead-1'`,
    );
    assert.equal(visible.rows[0]?.vin, '1HGCM82633A004352');
    assert.equal(visible.rows[0]?.status, 'new');
    const dumped = await db.query<Record<string, unknown>>(
      `select * from public.dealer_leads where id = 'lead-1'`,
    );
    assert.equal(JSON.stringify(dumped.rows).includes(CONTACT), false);
    const logs = await db.query<Record<string, unknown>>(
      `select * from public.dealer_lead_delivery_logs where lead_id = 'lead-1'`,
    );
    assert.equal(logs.rows.length, 1);
    assert.equal(JSON.stringify(logs.rows).includes('shopper-secret@example.com'), false);
    assert.equal(logs.rows[0]?.status, 'success');

    const base = await db.query<{ vin: string; status: string }>(
      `select vin, status from public.leads where id = 'lead-1'`,
    );
    assert.equal(base.rows[0]?.vin, '1HGCM82633A004352');
    assert.equal(base.rows[0]?.status, 'new');
    await expectReject(db, () => db.query(`select * from public.leads where id = 'lead-1'`), /permission denied/i);
    await expectReject(db, () => db.query(`select enc_payload from public.leads where id = 'lead-1'`), /permission denied/i);
    await expectReject(
      db,
      () => db.query(`update public.leads set enc_payload = 'replaced' where id = 'lead-1'`),
      /permission denied/i,
    );
    await expectReject(
      db,
      () => db.query(`update public.leads set vin = 'CHANGEDVIN0000000' where id = 'lead-1'`),
      /permission denied/i,
    );
    await expectReject(
      db,
      () => db.query(`select adf_payload from public.lead_delivery_logs`),
      /permission denied/i,
    );
    await expectReject(
      db,
      () => db.query(`update public.lead_delivery_logs set adf_payload = '<adf/>'::xml`),
      /permission denied/i,
    );
    await expectReject(
      db,
      () => db.query(
        `insert into public.lead_delivery_logs (lead_id, dealer_id, delivery_method, delivery_target, status, adf_payload)
         values ('lead-1', '1038994', 'email', 'crm@dealer.example', 'failed', '<adf/>'::xml)`,
      ),
      /permission denied/i,
    );

    const updated = await db.query<{ status: string }>(
      `select status from public.update_dealer_lead_status('lead-1', 'contacted')`,
    );
    assert.equal(updated.rows[0]?.status, 'contacted');
    assert.equal(JSON.stringify(updated.rows).includes(CONTACT), false);

    await actAs(db, SHOPPER, 'authenticated');
    const hidden = await db.query(`select id from public.dealer_leads`);
    assert.equal(hidden.rows.length, 0);
    await expectReject(
      db,
      () => db.query(`select enc_payload from public.leads`),
      /permission denied/i,
    );
    await expectReject(
      db,
      () => db.query(`select status from public.update_dealer_lead_status('lead-1', 'closed')`),
      /lead not found/,
    );

    await actAs(db, null, 'anon');
    await expectReject(
      db,
      () => db.query(`select enc_payload from public.leads`),
      /permission denied/i,
    );
    await expectReject(
      db,
      () => db.query(`select * from public.dealer_leads`),
      /permission denied/i,
    );

    await actAsOwner(db);
    const stored = await db.query<{ status: string; enc_payload: string; vin: string }>(
      `select status, enc_payload, vin from public.leads where id = 'lead-1'`,
    );
    assert.equal(stored.rows[0]?.status, 'contacted');
    assert.equal(stored.rows[0]?.enc_payload, CONTACT);
    assert.equal(stored.rows[0]?.vin, '1HGCM82633A004352');
  } finally {
    await db.exec('reset role').catch(() => undefined);
    await db.close();
  }
});
