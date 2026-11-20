import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

    create policy "System can insert leads"
      on public.leads for insert to authenticated
      with check (true);
    create policy "Members can insert dealership delivery logs"
      on public.lead_delivery_logs for insert to authenticated
      with check (true);
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
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId ?? '', role }),
  ]);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.query(`select set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.exec(`set role ${role}`);
}

async function actAsOwner(db: PGlite): Promise<void> {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', '', false)`);
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
    for (const sample of ['', 'abc', 'ab'.repeat(40)]) {
      const hashed = await db.query<{ hash: string }>(
        `select private.invite_token_hash($1) as hash`,
        [sample],
      );
      assert.equal(hashed.rows[0]?.hash, createHash('sha256').update(sample).digest('hex'));
    }

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
      `select has_function_privilege('authenticated', 'public.issue_dealership_invite(text,text,text,text,text,text,uuid,timestamptz)', 'execute') as ok`,
    ), false);
    assert.equal(/delete\s+from\s+public\.user_dealerships/i.test(ROOFTOP_SQL), false);
    assert.equal(ROOFTOP_SQL.includes('1038994'), false);
    assert.equal(ROOFTOP_SQL.includes('1283655'), false);
    assert.match(ROOFTOP_SQL, /private\.reviewed_rooftop_members/);
    assert.match(ROOFTOP_SQL, /accept-unpaired-lockout/);
    assert.match(ROOFTOP_SQL, /refusing to apply 20261109170000/);
    assert.ok(
      ROOFTOP_SQL.indexOf('duplicate marketcheck_dealer_id')
        < ROOFTOP_SQL.indexOf('set marketcheck_dealer_id = null'),
    );
    assert.ok(
      ROOFTOP_SQL.indexOf('20261109170000 must run inside a single transaction')
        < ROOFTOP_SQL.indexOf('set marketcheck_dealer_id = null'),
    );
    await actAsOwner(db);
    assert.equal(await flag(db, `select private.caller_can_provision_rooftop() as ok`), false);
    await db.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
    await db.query(`select set_config('request.jwt.claim.role', '', false)`);
    assert.equal(await flag(db, `select private.caller_can_provision_rooftop() as ok`), true);
    await db.query(
      `select set_config('request.jwt.claims', $1, false)`,
      [JSON.stringify({ role: 'authenticated', sub: SHOPPER })],
    );
    await db.query(`select set_config('request.jwt.claim.role', 'service_role', false)`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [SHOPPER]);
    assert.equal(await flag(db, `select private.caller_can_provision_rooftop() as ok`), false);
    await db.query(`select set_config('request.jwt.claims', 'not-json', false)`);
    await db.query(`select set_config('request.jwt.claim.role', 'service_role', false)`);
    assert.equal(await flag(db, `select private.caller_can_provision_rooftop() as ok`), true);
    await actAsOwner(db);
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
    await actAsOwner(db);
    const ownerMembership = await db.query<{ ok: boolean }>(
      `select access_verified_at is not null as ok
       from public.user_dealerships
       where dealership_id = $1 and user_id = $2`,
      [hondaId, DEALER],
    );
    assert.equal(ownerMembership.rows[0]?.ok, true);
    await actAs(db, null, 'service_role');
    await expectReject(
      db,
      () => db.query(
        `select token from public.issue_dealership_invite($1, '999001', null, null, null, 'owner', null, timezone('utc', now()) + interval '15 days')`,
        ['Far expiry'],
      ),
      /invite expiry is capped at 14 days/,
    );

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
       from public.issue_dealership_invite($1, $2, null, $3, null, 'owner', null, null)`,
      ['Lakeside', '555', 'https://www.lakeside.example/sales'],
    );
    const inviteToken = invited.rows[0]?.token ?? '';
    assert.match(inviteToken, /^[0-9a-f]{64}$/);
    const storedInvite = await db.query<{ token_hash: string }>(
      `select token_hash from public.dealership_invites where btrim(marketcheck_dealer_id) = '555'`,
    );
    assert.equal(storedInvite.rows[0]?.token_hash === inviteToken, false);
    assert.equal((storedInvite.rows[0]?.token_hash ?? '').length, 64);
    await expectReject(
      db,
      () => db.query(
        `select token from public.issue_dealership_invite($1, $2, null, $3, null, 'owner', null, null)`,
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
      () => db.query(`select token from public.issue_dealership_invite('Nope', '1', null, null, null, 'owner', null, null)`),
      /permission denied for function issue_dealership_invite/i,
    );
    const missingInvite = await db.query<{ invite_error: string }>(
      `select invite_error from public.accept_dealership_invite($1)`,
      ['not-a-real-invite-token'],
    );
    assert.equal(missingInvite.rows[0]?.invite_error, 'invite not found');
    await expectReject(
      db,
      () => db.query(`select token_hash from public.dealership_invites`),
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
    const lakeside = await db.query<{
      id: string;
      marketcheck_dealer_id: string;
      onboarded_at: string;
      invite_error: string | null;
    }>(
      `select (dealership).id as id,
              (dealership).marketcheck_dealer_id as marketcheck_dealer_id,
              (dealership).onboarded_at as onboarded_at,
              invite_error
       from public.accept_dealership_invite($1)`,
      [inviteToken],
    );
    assert.equal(lakeside.rows[0]?.invite_error ?? null, null);
    assert.equal(lakeside.rows[0]?.marketcheck_dealer_id, '555');
    assert.equal(lakeside.rows[0]?.onboarded_at != null, true);
    const lakesideId = lakeside.rows[0]?.id ?? '';
    const retry = await db.query<{ id: string; invite_error: string | null }>(
      `select (dealership).id as id, invite_error from public.accept_dealership_invite($1)`,
      [inviteToken],
    );
    assert.equal(retry.rows[0]?.invite_error ?? null, null);
    assert.equal(retry.rows[0]?.id, lakesideId);

    await actAs(db, SALES, 'authenticated');
    const reused = await db.query<{ invite_error: string }>(
      `select invite_error from public.accept_dealership_invite($1)`,
      [inviteToken],
    );
    assert.equal(reused.rows[0]?.invite_error, 'invite already used');

    await actAs(db, null, 'service_role');
    const join = await db.query<{ token: string }>(
      `select token from public.issue_dealership_invite(null, null, null, null, null, 'salesperson', $1, null)`,
      [hondaId],
    );
    const joinToken = join.rows[0]?.token ?? '';
    assert.match(joinToken, /^[0-9a-f]{64}$/);
    await actAs(db, SALES, 'authenticated');
    const joined = await db.query<{ id: string; invite_error: string | null }>(
      `select (dealership).id as id, invite_error from public.accept_dealership_invite($1)`,
      [joinToken],
    );
    assert.equal(joined.rows[0]?.invite_error ?? null, null);
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

    await actAs(db, null, 'service_role');
    const lockedInvite = await db.query<{ token: string }>(
      `select token from public.issue_dealership_invite($1, '5656', null, null, null, 'owner', null, null)`,
      ['Locked lot'],
    );
    const lockedToken = lockedInvite.rows[0]?.token ?? '';
    await actAsOwner(db);
    await db.query(
      `update public.dealership_invites
       set failed_attempts = 5
       where token_hash = private.invite_token_hash($1)`,
      [lockedToken],
    );
    await actAs(db, DEALER, 'authenticated');
    const locked = await db.query<{ invite_error: string }>(
      `select invite_error from public.accept_dealership_invite($1)`,
      [lockedToken],
    );
    assert.equal(locked.rows[0]?.invite_error, 'too many invite attempts');

    await actAsOwner(db);
    await db.query(`delete from private.dealership_invite_attempts where user_id = $1`, [SHOPPER]);
    await actAs(db, SHOPPER, 'authenticated');
    const wrongToken = 'ab'.repeat(32);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const miss = await db.query<{ invite_error: string }>(
        `select invite_error from public.accept_dealership_invite($1)`,
        [wrongToken],
      );
      assert.equal(miss.rows[0]?.invite_error, 'invite not found');
    }
    const limited = await db.query<{ invite_error: string }>(
      `select invite_error from public.accept_dealership_invite($1)`,
      [inviteToken],
    );
    assert.equal(limited.rows[0]?.invite_error, 'too many invite attempts');
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
      `select has_table_privilege('anon', 'public.leads', 'INSERT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_table_privilege('authenticated', 'public.leads', 'INSERT') as ok`,
    ), false);
    assert.equal(await flag(
      db,
      `select has_table_privilege('anon', 'public.lead_delivery_logs', 'INSERT') as ok`,
    ), false);
    assert.equal(await count(
      db,
      `select count(*)::int as n
       from pg_policies
       where schemaname = 'public'
         and tablename in ('leads', 'lead_delivery_logs')
         and cmd = 'INSERT'`,
    ), 0);
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
    await expectReject(
      db,
      () => db.query(`select status from public.update_dealer_lead_status('lead-1', 'pwned')`),
      /status is not allowed/,
    );
    await expectReject(
      db,
      () => db.query(`update public.leads set status = 'pwned' where id = 'lead-1'`),
      /leads_status_client_allowed|check constraint/i,
    );
    await expectReject(
      db,
      () => db.query(
        `insert into public.leads (id, vehicle_id, vin, enc_payload, status)
         values ('lead-2', 'veh-2', '1HGCM82633A004352', 'blob', 'new')`,
      ),
      /permission denied/i,
    );

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

test('social sign-in, shopper profiles, email squatters, and claimed MarketCheck ids stay unverified until a pair is reviewed', async () => {
  const db = new PGlite();
  const socialRoof = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const squatRoof = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  const honda = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  const socialUser = '55555555-5555-4555-8555-555555555555';
  const squatter = '66666666-6666-4666-8666-666666666666';
  const peer = '77777777-7777-4777-8777-777777777777';
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema if not exists auth;
      create table auth.users (
        id uuid primary key,
        raw_app_meta_data jsonb
      );
      create table auth.identities (
        user_id uuid not null references auth.users(id),
        provider text not null
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

      insert into auth.users (id, raw_app_meta_data) values
        ('${socialUser}', '{"provider":"apple"}'::jsonb),
        ('${squatter}', '{"provider":"email"}'::jsonb),
        ('${DEALER}', '{"provider":"email"}'::jsonb),
        ('${peer}', '{"provider":"email"}'::jsonb),
        ('${ADMIN}', '{"provider":"email"}'::jsonb);
      insert into auth.identities (user_id, provider) values
        ('${socialUser}', 'apple'),
        ('${squatter}', 'email'),
        ('${DEALER}', 'email');

      create table public.profiles (
        id uuid primary key,
        platform_role text not null default 'dealer_user'
      );
      insert into public.profiles (id, platform_role) values
        ('${socialUser}', 'dealer_user'),
        ('${squatter}', 'dealer_user'),
        ('${DEALER}', 'dealer_user'),
        ('${peer}', 'dealer_user'),
        ('${ADMIN}', 'platform_admin');

      create table public.consumer_profiles (
        user_id uuid primary key references auth.users(id)
      );
      insert into public.consumer_profiles (user_id) values ('${socialUser}');

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
        id uuid primary key,
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
        user_id uuid not null references auth.users(id),
        dealership_id uuid not null references public.dealerships(id),
        role text default 'owner',
        created_at timestamptz not null default timezone('utc'::text, now()),
        primary key (user_id, dealership_id)
      );
      insert into public.dealerships (id, name, marketcheck_dealer_id, created_by) values
        ('${socialRoof}', 'Social rooftop', '5555', '${socialUser}'),
        ('${squatRoof}', 'Email squat', '4242', '${squatter}'),
        ('${honda}', 'Claimed Honda', '1038994', '${DEALER}');
      insert into public.user_dealerships (user_id, dealership_id, role) values
        ('${socialUser}', '${socialRoof}', 'owner'),
        ('${peer}', '${socialRoof}', 'salesperson'),
        ('${squatter}', '${squatRoof}', 'owner'),
        ('${DEALER}', '${honda}', 'owner');

      alter table public.dealerships enable row level security;
      alter table public.user_dealerships enable row level security;
      grant select, update on public.dealerships to authenticated;
      grant select, update on public.user_dealerships to authenticated;
      create policy "Users can view their dealerships"
        on public.dealerships for select
        using (
          exists (
            select 1 from public.user_dealerships ud
            where ud.dealership_id = dealerships.id
              and ud.user_id = (select auth.uid())
          )
        );

      create table public.inventory_vehicles (
        id uuid primary key,
        dealership_id uuid references public.dealerships(id),
        vin text
      );
      insert into public.inventory_vehicles (id, dealership_id, vin)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '${socialRoof}', 'VINSOCIAL');
      alter table public.inventory_vehicles enable row level security;
      grant select on public.inventory_vehicles to authenticated;
      create policy "Users can view dealership inventory"
        on public.inventory_vehicles for select
        using (
          exists (
            select 1 from public.user_dealerships ud
            where ud.dealership_id = inventory_vehicles.dealership_id
              and ud.user_id = (select auth.uid())
          )
        );

      create table public.dealership_billing_accounts (
        dealership_id uuid primary key references public.dealerships(id),
        cash_balance_cents bigint not null default 0
      );
      insert into public.dealership_billing_accounts (dealership_id, cash_balance_cents)
      values ('${socialRoof}', 100);
      alter table public.dealership_billing_accounts enable row level security;
      grant select on public.dealership_billing_accounts to authenticated;
      create policy "Members can view dealership billing accounts"
        on public.dealership_billing_accounts for select to authenticated
        using (
          exists (
            select 1 from public.user_dealerships ud
            where ud.user_id = (select auth.uid())
              and ud.dealership_id = dealership_billing_accounts.dealership_id
          )
          or (select private.is_platform_admin())
        );

      create table public.analytics_sessions (
        id uuid primary key,
        user_id uuid,
        dealer_id text
      );
      insert into public.analytics_sessions (id, user_id, dealer_id) values
        ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', null, '5555'),
        ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '${socialUser}', '4242');
      alter table public.analytics_sessions enable row level security;
      grant select on public.analytics_sessions to authenticated;
      create policy "Users can view sessions for their dealerships"
        on public.analytics_sessions for select
        using (
          (user_id is not null and auth.uid() = user_id)
          or (
            dealer_id is not null and exists (
              select 1 from public.dealerships d
              inner join public.user_dealerships ud on ud.dealership_id = d.id
              where d.marketcheck_dealer_id = analytics_sessions.dealer_id
                and ud.user_id = auth.uid()
            )
          )
        );
    `);
    await db.query(
      `select set_config('drevvy.approve_unpaired_rooftop_lockout', 'accept-unpaired-lockout', false)`,
    );
    await db.exec(ROOFTOP_SQL);
    await db.exec(`grant usage on schema private to authenticated`);

    assert.equal(await count(db, `select count(*)::int as n from public.user_dealerships`), 4);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.user_dealerships where access_verified_at is not null`,
    ), 0);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.dealerships where onboarded_at is not null`,
    ), 0);
    assert.equal(await count(
      db,
      `select count(*)::int as n from private.reviewed_rooftop_members`,
    ), 0);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.dealerships where btrim(marketcheck_dealer_id) = '1038994'`,
    ), 1);

    async function dealerAccess(userId: string, dealerId: string): Promise<boolean> {
      await actAs(db, userId, 'authenticated');
      return flag(db, `select private.user_has_dealer_access('${dealerId}') as ok`);
    }
    async function rooftopAccess(userId: string, dealershipId: string): Promise<boolean> {
      await actAs(db, userId, 'authenticated');
      return flag(
        db,
        `select private.user_has_rooftop_access('${dealershipId}'::uuid, null) as ok`,
      );
    }
    async function vehicleAccess(userId: string, dealershipId: string): Promise<boolean> {
      await actAs(db, userId, 'authenticated');
      return flag(
        db,
        `select private.user_can_access_uvs_vehicle('${dealershipId}'::uuid, null) as ok`,
      );
    }

    assert.equal(await dealerAccess(socialUser, '5555'), false);
    assert.equal(await rooftopAccess(socialUser, socialRoof), false);
    assert.equal(await vehicleAccess(socialUser, socialRoof), false);
    assert.equal(await dealerAccess(squatter, '4242'), false);
    assert.equal(await dealerAccess(DEALER, '1038994'), false);
    assert.equal(await rooftopAccess(peer, socialRoof), false);
    assert.equal(await dealerAccess(ADMIN, '1038994'), true);

    await actAs(db, socialUser, 'authenticated');
    assert.equal((await db.query(`select id from public.dealerships`)).rows.length, 0);
    assert.equal((await db.query(`select vin from public.inventory_vehicles`)).rows.length, 0);
    assert.equal((await db.query(`select dealership_id from public.dealership_billing_accounts`)).rows.length, 0);
    const ownSession = await db.query<{ id: string }>(`select id from public.analytics_sessions`);
    assert.deepEqual(ownSession.rows.map((row) => row.id), ['cccccccc-cccc-4ccc-8ccc-ccccccccccc2']);

    await actAsOwner(db);
    await db.query(
      `insert into private.reviewed_rooftop_members (dealership_id, user_id) values ($1, $2)`,
      [socialRoof, socialUser],
    );
    await db.query(`select private.apply_reviewed_rooftop_members()`);

    assert.equal(await count(db, `select count(*)::int as n from public.user_dealerships`), 4);
    assert.equal(await dealerAccess(socialUser, '5555'), true);
    assert.equal(await rooftopAccess(socialUser, socialRoof), true);
    assert.equal(await vehicleAccess(socialUser, socialRoof), true);
    assert.equal(await dealerAccess(peer, '5555'), false);
    assert.equal(await rooftopAccess(peer, socialRoof), false);
    assert.equal(await dealerAccess(squatter, '4242'), false);
    assert.equal(await dealerAccess(DEALER, '1038994'), false);
    await actAsOwner(db);
    const stamps = await db.query<{ id: string; onboarded_at: string | null }>(
      `select id, onboarded_at from public.dealerships`,
    );
    const onboarded = new Map(stamps.rows.map((row) => [row.id, row.onboarded_at]));
    assert.equal(onboarded.get(socialRoof) != null, true);
    assert.equal(onboarded.get(squatRoof) ?? null, null);
    assert.equal(onboarded.get(honda) ?? null, null);

    await actAs(db, socialUser, 'authenticated');
    assert.equal((await db.query(`select vin from public.inventory_vehicles`)).rows.length, 1);
    assert.equal((await db.query(`select dealership_id from public.dealership_billing_accounts`)).rows.length, 1);
    assert.equal((await db.query(`select id from public.dealerships`)).rows.length, 1);
    const verifiedSessions = await db.query<{ id: string }>(
      `select id from public.analytics_sessions order by id`,
    );
    assert.deepEqual(
      verifiedSessions.rows.map((row) => row.id),
      ['cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'],
    );

    await actAs(db, peer, 'authenticated');
    assert.equal((await db.query(`select vin from public.inventory_vehicles`)).rows.length, 0);
    assert.equal((await db.query(`select dealership_id from public.dealership_billing_accounts`)).rows.length, 0);

    await actAsOwner(db);
    await db.query(
      `update public.user_dealerships
       set access_verified_at = timezone('utc', now()),
           access_verified_source = 'operator'
       where user_id = $1 and dealership_id = $2`,
      [squatter, squatRoof],
    );
    await db.query(
      `update public.dealerships
       set onboarded_at = timezone('utc', now())
       where id = $1`,
      [squatRoof],
    );
    await db.query(`delete from private.reviewed_rooftop_members where user_id = $1`, [socialUser]);
    assert.equal(await dealerAccess(socialUser, '5555'), true);
    await actAsOwner(db);
    await db.query(`select private.apply_reviewed_rooftop_members()`);
    assert.equal(await dealerAccess(socialUser, '5555'), false);
    assert.equal(await dealerAccess(squatter, '4242'), true);
    await actAsOwner(db);
    const afterRevoke = await db.query<{ id: string; onboarded_at: string | null }>(
      `select id, onboarded_at from public.dealerships`,
    );
    const afterMap = new Map(afterRevoke.rows.map((row) => [row.id, row.onboarded_at]));
    assert.equal(afterMap.get(socialRoof) ?? null, null);
    assert.equal(afterMap.get(squatRoof) != null, true);
    assert.equal(await count(db, `select count(*)::int as n from public.user_dealerships`), 4);

    await actAsOwner(db);
    await db.exec(`
      create policy "members can attempt membership updates"
        on public.user_dealerships for update to authenticated
        using (true)
        with check (true);
    `);
    await db.exec(`
      create policy "members can read memberships"
        on public.user_dealerships for select to authenticated
        using (true);
    `);
    await actAs(db, socialUser, 'authenticated');
    await expectReject(
      db,
      () => db.query(
        `update public.user_dealerships
         set access_verified_at = timezone('utc', now())
         where user_id = '${peer}'`,
      ),
      /rooftop membership cannot be changed from the client/,
    );
  } finally {
    await db.exec('reset role').catch(() => undefined);
    await db.close();
  }
});

test('an existing owner who accepts a salesperson invite is verified only as salesperson', async () => {
  const db = await boot();
  try {
    await actAs(db, null, 'service_role');
    const created = await db.query<{ id: string }>(
      `select id from public.create_onboarded_rooftop($1, 'Role lot', '5656', null, null, null, 'owner')`,
      [DEALER],
    );
    const roofId = created.rows[0]?.id ?? '';
    await actAsOwner(db);
    await db.query(
      `insert into public.user_dealerships (user_id, dealership_id, role)
       values ($1, $2, 'owner')`,
      [SALES, roofId],
    );
    await actAs(db, null, 'service_role');
    const invite = await db.query<{ token: string }>(
      `select token from public.issue_dealership_invite(null, null, null, null, null, 'salesperson', $1, null)`,
      [roofId],
    );
    await actAs(db, DEALER, 'authenticated');
    const accepted = await db.query<{ invite_error: string | null }>(
      `select invite_error from public.accept_dealership_invite($1)`,
      [invite.rows[0]?.token],
    );
    assert.equal(accepted.rows[0]?.invite_error ?? null, null);
    await actAsOwner(db);
    const rows = await db.query<{ user_id: string; role: string; verified: boolean; source: string | null }>(
      `select user_id, role, access_verified_at is not null as verified, access_verified_source as source
       from public.user_dealerships
       where dealership_id = $1`,
      [roofId],
    );
    const byUser = new Map(rows.rows.map((row) => [row.user_id, row]));
    assert.equal(byUser.get(DEALER)?.role, 'salesperson');
    assert.equal(byUser.get(DEALER)?.verified, true);
    assert.equal(byUser.get(DEALER)?.source, 'invite');
    assert.equal(byUser.get(SALES)?.role, 'owner');
    assert.equal(byUser.get(SALES)?.verified, false);
    assert.equal(byUser.get(SALES)?.source ?? null, null);
    await db.exec(`grant usage on schema private to authenticated`);
    assert.equal(await (async () => {
      await actAs(db, SALES, 'authenticated');
      return flag(db, `select private.user_has_rooftop_access('${roofId}'::uuid, null) as ok`);
    })(), false);
    await actAs(db, DEALER, 'authenticated');
    assert.equal(await flag(
      db,
      `select private.user_has_rooftop_access('${roofId}'::uuid, null) as ok`,
    ), true);
  } finally {
    await db.exec('reset role').catch(() => undefined);
    await db.close();
  }
});

test('the migration refuses an occupied claim when the lockout is not approved', async () => {
  const db = new PGlite();
  const roof = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9';
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema if not exists auth;
      create table auth.users (id uuid primary key);
      insert into auth.users (id) values ('${DEALER}');
      create table public.dealerships (
        id uuid primary key,
        name text not null,
        marketcheck_dealer_id text,
        marketcheck_website_url text,
        created_at timestamptz not null default timezone('utc', now())
      );
      create table public.user_dealerships (
        user_id uuid not null references auth.users(id),
        dealership_id uuid not null references public.dealerships(id),
        role text,
        primary key (user_id, dealership_id)
      );
      insert into public.dealerships (id, name, marketcheck_dealer_id)
      values ('${roof}', 'Occupied', '4242');
      insert into public.user_dealerships (user_id, dealership_id, role)
      values ('${DEALER}', '${roof}', 'owner');
    `);
    let refused = false;
    try {
      await db.exec(ROOFTOP_SQL);
    } catch (error) {
      refused = true;
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /refusing to apply 20261109170000/);
    }
    assert.equal(refused, true);
    await db.exec('rollback').catch(() => undefined);
    const column = await db.query<{ n: number }>(
      `select count(*)::int as n
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'dealerships'
         and column_name = 'onboarded_at'`,
    );
    assert.equal(Number(column.rows[0]?.n ?? 0), 0);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.user_dealerships where dealership_id = $1`,
      [roof],
    ), 1);
    assert.equal(await count(
      db,
      `select count(*)::int as n from public.dealerships where btrim(marketcheck_dealer_id) = '4242'`,
    ), 1);
  } finally {
    await db.close();
  }
});
