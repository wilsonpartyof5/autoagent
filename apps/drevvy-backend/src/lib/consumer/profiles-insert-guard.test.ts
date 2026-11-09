import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '../../../../../supabase/migrations');
const SQL = readFileSync(join(MIGRATIONS, '20261109172331_lock_profiles_client_insert.sql'), 'utf8');
const PLATFORM_ROLE_GUARD = readFileSync(join(MIGRATIONS, '20260910144654_lock_platform_role.sql'), 'utf8');
const HARDENING = readFileSync(join(MIGRATIONS, '20261109173937_profiles_update_guard_current_user.sql'), 'utf8');
const UPDATE_GUARD = readFileSync(join(MIGRATIONS, '20260911150328_lock_private_rooms.sql'), 'utf8');
const SIGNUP = readFileSync(join(MIGRATIONS, '20261001172059_consumer_profiles.sql'), 'utf8');
const GOOGLE_SIGNUP = readFileSync(join(MIGRATIONS, '20261017123700_google_shoppers.sql'), 'utf8');

const SHOPPER = '11111111-1111-4111-8111-111111111111';
const SERVICE_USER = '22222222-2222-4222-8222-222222222222';
const ADMIN_USER = '33333333-3333-4333-8333-333333333333';
const POSTGRES_USER = '44444444-4444-4444-8444-444444444444';
const EMAIL_USER = '55555555-5555-4555-8555-555555555555';
const APPLE_USER = '66666666-6666-4666-8666-666666666666';
const DEFINER_USER = '77777777-7777-4777-8777-777777777777';
const GOOGLE_USER = '88888888-8888-4888-8888-888888888888';
const EMAIL_AFTER_GOOGLE = '99999999-9999-4999-8999-999999999999';

const PRIVILEGED_COLUMNS = [
  'platform_role',
  'marketcheck_dealer_id',
  'inventory_connected',
  'billing_active',
  'dms_provider',
  'marketcheck_zip',
  'marketcheck_website_url',
  'lead_delivery_method',
  'lead_delivery_endpoint',
  'lead_delivery_email',
] as const;

type ProfileRow = {
  id: string;
  email: string | null;
  platform_role: string;
  marketcheck_dealer_id: string | null;
  marketcheck_zip: string | null;
  marketcheck_website_url: string | null;
  lead_delivery_method: string | null;
  lead_delivery_endpoint: string | null;
  lead_delivery_email: string | null;
  inventory_connected: boolean;
  billing_active: boolean;
  dms_provider: string | null;
};

const PROFILE_COLUMNS = `id, email, platform_role, marketcheck_dealer_id, marketcheck_zip,
  marketcheck_website_url, lead_delivery_method, lead_delivery_endpoint, lead_delivery_email,
  inventory_connected, billing_active, dms_provider`;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function boot(applyHardening = true): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;

    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role supabase_admin nologin bypassrls;

    grant usage on schema public to anon, authenticated, service_role, supabase_admin;
    grant usage on schema auth to anon, authenticated, service_role, supabase_admin;

    create table auth.users (
      id uuid primary key,
      email text,
      raw_app_meta_data jsonb not null default '{}'::jsonb
    );

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      email text,
      onboarding_completed boolean default false,
      inventory_connected boolean default false,
      billing_active boolean default false,
      dms_provider text,
      marketcheck_dealer_id text,
      marketcheck_zip text,
      marketcheck_website_url text,
      lead_delivery_method text,
      lead_delivery_endpoint text,
      lead_delivery_email text,
      platform_role text not null default 'dealer_user'
        check (platform_role in ('dealer_user', 'platform_admin')),
      created_at timestamptz not null default timezone('utc'::text, now()),
      updated_at timestamptz not null default timezone('utc'::text, now())
    );

    alter table public.profiles enable row level security;

    grant select, insert, update on public.profiles to anon, authenticated, service_role, supabase_admin;
    grant insert on auth.users to authenticated, service_role;

    create policy "Users can view own profile"
      on public.profiles for select to authenticated
      using (auth.uid() = id);

    create policy "Users can update own profile"
      on public.profiles for update to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);

    create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  `);
  await db.exec(SQL);
  await db.exec(PLATFORM_ROLE_GUARD);
  if (applyHardening) await db.exec(HARDENING);
  return db;
}

async function withRole(
  db: PGlite,
  role: string,
  jwtSub: string | null,
  run: (tx: PGlite) => Promise<void>,
  jwtRole: string | null = null,
): Promise<void> {
  await db.query('begin');
  try {
    await db.query(`set local role ${role}`);
    if (jwtSub) {
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [jwtSub]);
    }
    if (jwtRole) {
      await db.query(`select set_config('request.jwt.claim.role', $1, true)`, [jwtRole]);
    }
    await run(db);
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

async function addUser(db: PGlite, id: string, email: string, provider: string | null = null): Promise<void> {
  await db.query(
    `insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3::jsonb)`,
    [id, email, JSON.stringify(provider ? { provider } : {})],
  );
}

async function profile(db: PGlite, id: string): Promise<ProfileRow | null> {
  const result = await db.query<ProfileRow>(
    `select ${PROFILE_COLUMNS} from public.profiles where id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

test('the migration revokes client insert and keeps the update column list', () => {
  assert.match(SQL, /revoke insert on table public\.profiles from public, anon, authenticated;/);
  assert.match(SQL, /drop policy if exists "Users can insert own profile" on public\.profiles;/);
  assert.match(SQL, /security invoker/);
  assert.match(SQL, /security definer/);
  assert.match(SQL, /request\.jwt\.claim\.role/);
  assert.equal(SQL.includes('prevent_platform_role_client_change'), false);
  assert.equal((HARDENING.match(/security invoker/g) ?? []).length, 2);
  const hardeningBodies = [...HARDENING.matchAll(/as \$\$([\s\S]*?)\$\$;/g)].map((match) => match[1]);
  assert.equal(hardeningBodies.length, 2);
  for (const body of hardeningBodies) {
    assert.equal(body.includes('request.jwt'), false);
    assert.equal(body.includes('current_setting'), false);
    assert.match(body, /current_user::text/);
    assert.match(body, /actor in \('postgres', 'supabase_admin', 'service_role'\)/);
  }
  assert.match(SQL, /before insert on public\.profiles/);
  assert.match(SQL, /new\.platform_role := 'dealer_user'/);
  for (const column of [
    'marketcheck_dealer_id',
    'marketcheck_zip',
    'marketcheck_website_url',
    'lead_delivery_method',
    'lead_delivery_endpoint',
    'lead_delivery_email',
    'dms_provider',
  ]) {
    assert.match(SQL, new RegExp(`new\\.${column} := null`));
  }
  assert.match(SQL, /new\.inventory_connected := false/);
  assert.match(SQL, /new\.billing_active := false/);
  assert.match(SQL, /actor in \('postgres', 'supabase_admin', 'service_role'\)/);
  assert.equal(SQL.includes('create or replace function public.handle_new_user'), false);
  assert.match(SIGNUP, /security definer/);
  assert.match(SIGNUP, /insert into public\.profiles \(id, email\)/);
  assert.match(GOOGLE_SIGNUP, /security definer/);

  const guardStart = UPDATE_GUARD.indexOf('if new.platform_role is distinct from old.platform_role');
  const guardEnd = UPDATE_GUARD.indexOf('then', guardStart);
  const oldChecks = UPDATE_GUARD.slice(guardStart, guardEnd);
  for (const column of PRIVILEGED_COLUMNS) {
    assert.match(oldChecks, new RegExp(`new\\.${column} is distinct from old\\.${column}`));
    assert.match(SQL, new RegExp(`new\\.${column} is distinct from old\\.${column}`));
  }
});

test('authenticated and anon cannot insert a platform_admin profile', async () => {
  const db = await boot();
  try {
    const who = await db.query<{ current_user: string }>(
      `select current_user`,
    );
    assert.equal(who.rows[0]?.current_user, 'postgres');

    const privileges = await db.query<{
      authenticated_insert: boolean;
      anon_insert: boolean;
      service_insert: boolean;
      admin_insert: boolean;
    }>(`
      select
        has_table_privilege('authenticated', 'public.profiles', 'INSERT') as authenticated_insert,
        has_table_privilege('anon', 'public.profiles', 'INSERT') as anon_insert,
        has_table_privilege('service_role', 'public.profiles', 'INSERT') as service_insert,
        has_table_privilege('supabase_admin', 'public.profiles', 'INSERT') as admin_insert
    `);
    assert.equal(privileges.rows[0]?.authenticated_insert, false);
    assert.equal(privileges.rows[0]?.anon_insert, false);
    assert.equal(privileges.rows[0]?.service_insert, true);
    assert.equal(privileges.rows[0]?.admin_insert, true);

    const policy = await db.query<{ n: number }>(`
      select count(*)::int as n
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      where c.relname = 'profiles'
        and p.polname = 'Users can insert own profile'
    `);
    assert.equal(Number(policy.rows[0]?.n), 0);

    const fn = await db.query<{ prosecdef: boolean; proconfig: string[] | null }>(`
      select p.prosecdef, p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
        and p.proname = 'coerce_client_profile_insert'
    `);
    assert.equal(fn.rows[0]?.prosecdef, false);
    assert.equal((fn.rows[0]?.proconfig ?? []).some((item) => item.replace(/"/g, '') === 'search_path='), true);

    await addUser(db, SHOPPER, 'shopper@example.com', 'apple');
    const insertSql = `
      insert into public.profiles (
        id, email, platform_role, marketcheck_dealer_id, lead_delivery_email, inventory_connected
      ) values (
        '${SHOPPER}', 'shopper@example.com', 'platform_admin', '1038994', 'leads@evil.test', true
      )
    `;

    await assert.rejects(
      () => withRole(db, 'authenticated', SHOPPER, async (tx) => {
        await tx.exec(insertSql);
      }),
      (error: unknown) => /permission denied for table profiles/i.test(messageOf(error)),
    );
    await assert.rejects(
      () => withRole(db, 'anon', SHOPPER, async (tx) => {
        await tx.exec(insertSql);
      }),
      (error: unknown) => /permission denied for table profiles/i.test(messageOf(error)),
    );
    assert.equal(await profile(db, SHOPPER), null);
  } finally {
    await db.close();
  }
});

test('a re-granted authenticated insert is coerced and cannot spoof service_role', async () => {
  const db = await boot();
  try {
    await addUser(db, SHOPPER, 'shopper@example.com', 'apple');
    await db.exec(`
      grant insert on public.profiles to authenticated;
      create policy "Users can insert own profile"
        on public.profiles for insert
        with check (auth.uid() = id);
    `);

    await withRole(db, 'authenticated', SHOPPER, async (tx) => {
      await tx.query(
        `insert into public.profiles (
           id, email, platform_role, marketcheck_dealer_id, marketcheck_zip,
           marketcheck_website_url, lead_delivery_method, lead_delivery_endpoint,
           lead_delivery_email, inventory_connected, billing_active, dms_provider
         ) values (
           $1, 'shopper@example.com', 'platform_admin', '1038994', '29730',
           'https://evil.example', 'email', 'https://evil.example/leads',
           'leads@evil.test', true, true, 'cdk'
         )`,
        [SHOPPER],
      );
    }, 'service_role');

    const row = await profile(db, SHOPPER);
    assert.ok(row);
    assert.equal(row.email, 'shopper@example.com');
    assert.equal(row.platform_role, 'dealer_user');
    assert.equal(row.marketcheck_dealer_id, null);
    assert.equal(row.marketcheck_zip, null);
    assert.equal(row.marketcheck_website_url, null);
    assert.equal(row.lead_delivery_method, null);
    assert.equal(row.lead_delivery_endpoint, null);
    assert.equal(row.lead_delivery_email, null);
    assert.equal(row.inventory_connected, false);
    assert.equal(row.billing_active, false);
    assert.equal(row.dms_provider, null);

    // Session user here is the superuser, and Postgres allows a superuser session
    // to SET ROLE any role. Become the authenticated session user first, which
    // is the privilege a shopper connection actually has.
    await db.query('set session authorization authenticated');
    await assert.rejects(
      () => db.query('set role service_role'),
      (error: unknown) => /permission denied to set role "service_role"/i.test(messageOf(error)),
    );
  } finally {
    await db.close();
  }
});

test('service_role, supabase_admin, and postgres inserts keep platform_admin', async () => {
  const db = await boot();
  try {
    await addUser(db, SERVICE_USER, 'service@example.com', 'email');
    await addUser(db, ADMIN_USER, 'admin@example.com', 'email');
    await addUser(db, POSTGRES_USER, 'postgres@example.com', 'email');

    const insertPrivileged = async (role: string | null, id: string, email: string) => {
      const statement = `
        insert into public.profiles (
          id, email, platform_role, marketcheck_dealer_id, marketcheck_zip,
          marketcheck_website_url, lead_delivery_method, lead_delivery_endpoint,
          lead_delivery_email, inventory_connected, billing_active, dms_provider
        ) values (
          $1, $2, 'platform_admin', '1038994', '29730',
          'https://dealer.example', 'http', 'https://dealer.example/leads',
          'leads@dealer.example', true, true, 'cdk'
        )
      `;
      if (role) {
        await withRole(db, role, null, async (tx) => {
          await tx.query(statement, [id, email]);
        });
      } else {
        await db.query(statement, [id, email]);
      }
    };

    await insertPrivileged('service_role', SERVICE_USER, 'service@example.com');
    await insertPrivileged('supabase_admin', ADMIN_USER, 'admin@example.com');
    await insertPrivileged(null, POSTGRES_USER, 'postgres@example.com');

    for (const id of [SERVICE_USER, ADMIN_USER, POSTGRES_USER]) {
      const row = await profile(db, id);
      assert.ok(row);
      assert.equal(row.platform_role, 'platform_admin');
      assert.equal(row.marketcheck_dealer_id, '1038994');
      assert.equal(row.marketcheck_zip, '29730');
      assert.equal(row.marketcheck_website_url, 'https://dealer.example');
      assert.equal(row.lead_delivery_method, 'http');
      assert.equal(row.lead_delivery_endpoint, 'https://dealer.example/leads');
      assert.equal(row.lead_delivery_email, 'leads@dealer.example');
      assert.equal(row.inventory_connected, true);
      assert.equal(row.billing_active, true);
      assert.equal(row.dms_provider, 'cdk');
    }
  } finally {
    await db.close();
  }
});

test('handle_new_user still inserts as security definer after the revoke', async () => {
  const db = await boot();
  try {
    const bodyStart = SIGNUP.indexOf('create or replace function public.handle_new_user()');
    const bodyEnd = SIGNUP.indexOf('revoke execute on function public.handle_new_user()');
    assert.ok(bodyStart >= 0 && bodyEnd > bodyStart);
    await db.exec(SIGNUP.slice(bodyStart, bodyEnd));
    await db.exec(`
      revoke execute on function public.handle_new_user() from public, anon, authenticated;
      create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_user();
    `);

    const definer = await db.query<{ prosecdef: boolean }>(`
      select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'handle_new_user'
    `);
    assert.equal(definer.rows[0]?.prosecdef, true);

    await withRole(db, 'authenticated', null, async (tx) => {
      await tx.query(
        `insert into auth.users (id, email, raw_app_meta_data) values ($1, 'email@example.com', '{"provider":"email"}'::jsonb)`,
        [EMAIL_USER],
      );
      await tx.query(
        `insert into auth.users (id, email, raw_app_meta_data) values ($1, 'apple@example.com', '{"provider":"apple"}'::jsonb)`,
        [APPLE_USER],
      );
    });

    const emailProfile = await profile(db, EMAIL_USER);
    assert.ok(emailProfile);
    assert.equal(emailProfile.email, 'email@example.com');
    assert.equal(emailProfile.platform_role, 'dealer_user');
    assert.equal(emailProfile.marketcheck_dealer_id, null);
    assert.equal(emailProfile.lead_delivery_email, null);
    assert.equal(await profile(db, APPLE_USER), null);

    const googleStart = GOOGLE_SIGNUP.indexOf('create or replace function public.handle_new_user()');
    const googleEnd = GOOGLE_SIGNUP.indexOf('revoke execute on function public.handle_new_user()');
    assert.ok(googleStart >= 0 && googleEnd > googleStart);
    await db.exec(GOOGLE_SIGNUP.slice(googleStart, googleEnd));
    await db.exec(`revoke execute on function public.handle_new_user() from public, anon, authenticated;`);
    await withRole(db, 'authenticated', null, async (tx) => {
      await tx.query(
        `insert into auth.users (id, email, raw_app_meta_data) values ($1, 'google@example.com', '{"provider":"google"}'::jsonb)`,
        [GOOGLE_USER],
      );
      await tx.query(
        `insert into auth.users (id, email, raw_app_meta_data) values ($1, 'email-after-google@example.com', '{"provider":"email"}'::jsonb)`,
        [EMAIL_AFTER_GOOGLE],
      );
    });
    assert.equal(await profile(db, GOOGLE_USER), null);
    const emailAfterGoogle = await profile(db, EMAIL_AFTER_GOOGLE);
    assert.ok(emailAfterGoogle);
    assert.equal(emailAfterGoogle.platform_role, 'dealer_user');

    await db.exec(`
      create or replace function public.insert_profile_as_definer(p_id uuid, p_email text)
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        insert into public.profiles (
          id, email, platform_role, marketcheck_dealer_id, lead_delivery_email, inventory_connected
        ) values (
          p_id, p_email, 'platform_admin', '1038994', 'leads@dealer.example', true
        );
      end;
      $$;
    `);
    // Apple sign-in creates no profile. The definer insert below is the trusted
    // path that must still be able to write platform_admin for that user.
    await addUser(db, DEFINER_USER, 'definer@example.com', 'apple');
    await withRole(db, 'authenticated', DEFINER_USER, async (tx) => {
      await tx.query(`select public.insert_profile_as_definer($1, 'definer@example.com')`, [DEFINER_USER]);
    });
    const trusted = await profile(db, DEFINER_USER);
    assert.ok(trusted);
    assert.equal(trusted.platform_role, 'platform_admin');
    assert.equal(trusted.marketcheck_dealer_id, '1038994');
    assert.equal(trusted.lead_delivery_email, 'leads@dealer.example');
    assert.equal(trusted.inventory_connected, true);
  } finally {
    await db.close();
  }
});

test('the update guard still rejects every privileged column from authenticated', async () => {
  const db = await boot();
  try {
    await addUser(db, SHOPPER, 'shopper@example.com', 'email');
    await db.query(
      `insert into public.profiles (id, email) values ($1, 'shopper@example.com')`,
      [SHOPPER],
    );

    const attempts: Array<[string, string]> = [
      ['platform_role', `'platform_admin'`],
      ['marketcheck_dealer_id', `'1038994'`],
      ['inventory_connected', 'true'],
      ['billing_active', 'true'],
      ['dms_provider', `'cdk'`],
      ['marketcheck_zip', `'29730'`],
      ['marketcheck_website_url', `'https://evil.example'`],
      ['lead_delivery_method', `'email'`],
      ['lead_delivery_endpoint', `'https://evil.example/leads'`],
      ['lead_delivery_email', `'leads@evil.test'`],
    ];
    assert.deepEqual(attempts.map(([column]) => column), [...PRIVILEGED_COLUMNS]);

    for (const [column, value] of attempts) {
      const expected = column === 'platform_role'
        ? /platform_role cannot be changed from the client/i
        : /privileged profile fields cannot be changed from the client/i;
      await assert.rejects(
        () => withRole(db, 'authenticated', SHOPPER, async (tx) => {
          await tx.query(`update public.profiles set ${column} = ${value} where id = $1`, [SHOPPER]);
        }),
        (error: unknown) => expected.test(messageOf(error)),
        column,
      );
    }

    await withRole(db, 'authenticated', SHOPPER, async (tx) => {
      await tx.query(`update public.profiles set email = 'renamed@example.com' where id = $1`, [SHOPPER]);
    });
    assert.equal((await profile(db, SHOPPER))?.email, 'renamed@example.com');
    assert.equal((await profile(db, SHOPPER))?.platform_role, 'dealer_user');

    await withRole(db, 'service_role', null, async (tx) => {
      await tx.query(
        `update public.profiles
            set platform_role = 'platform_admin',
                marketcheck_dealer_id = '1038994',
                lead_delivery_email = 'leads@dealer.example'
          where id = $1`,
        [SHOPPER],
      );
    });
    const promoted = await profile(db, SHOPPER);
    assert.equal(promoted?.platform_role, 'platform_admin');
    assert.equal(promoted?.marketcheck_dealer_id, '1038994');
    assert.equal(promoted?.lead_delivery_email, 'leads@dealer.example');
  } finally {
    await db.close();
  }
});

async function guardDefinerFlags(db: PGlite): Promise<Record<string, boolean>> {
  const result = await db.query<{ proname: string; prosecdef: boolean }>(`
    select p.proname, p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'prevent_platform_role_client_change',
        'prevent_privileged_profile_client_change'
      )
  `);
  return Object.fromEntries(result.rows.map((row) => [row.proname, row.prosecdef]));
}

test('a direct SQL set_config bypass of the UPDATE guards is closed; it is not a REST call', async () => {
  // PGlite runs the SQL in-process. Nothing here sends HTTP, uses the anon
  // key, or calls an RPC. The bypass is a local session setting a GUC.
  const db = await boot(false);
  try {
    assert.deepEqual(await guardDefinerFlags(db), {
      prevent_platform_role_client_change: true,
      prevent_privileged_profile_client_change: true,
    });

    await addUser(db, SHOPPER, 'shopper@example.com', 'email');
    await db.query(
      `insert into public.profiles (id, email) values ($1, 'shopper@example.com')`,
      [SHOPPER],
    );

    await db.query('begin');
    await db.query('set local role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [SHOPPER]);
    await db.query(`select set_config('request.jwt.claim.role', 'service_role', true)`);
    await db.query(
      `update public.profiles
          set platform_role = 'platform_admin',
              marketcheck_dealer_id = '1038994'
        where id = $1`,
      [SHOPPER],
    );
    await db.query('commit');

    const bypassed = await profile(db, SHOPPER);
    assert.equal(bypassed?.platform_role, 'platform_admin');
    assert.equal(bypassed?.marketcheck_dealer_id, '1038994');

    // The DEFINER guard trusts current_setting('role'), which stays 'none'
    // for a normal postgres session. SET ROLE postgres is what that guard allows.
    await db.query('begin');
    await db.query('set local role postgres');
    await db.query(
      `update public.profiles
          set platform_role = 'dealer_user',
              marketcheck_dealer_id = null
        where id = $1`,
      [SHOPPER],
    );
    await db.query('commit');
    await db.exec(HARDENING);
    assert.deepEqual(await guardDefinerFlags(db), {
      prevent_platform_role_client_change: false,
      prevent_privileged_profile_client_change: false,
    });

    await assert.rejects(
      () => withRole(db, 'authenticated', SHOPPER, async (tx) => {
        await tx.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
        await tx.query(
          `update public.profiles set platform_role = 'platform_admin' where id = $1`,
          [SHOPPER],
        );
      }, 'service_role'),
      (error: unknown) => /platform_role cannot be changed from the client/i.test(messageOf(error)),
    );
    await assert.rejects(
      () => withRole(db, 'authenticated', SHOPPER, async (tx) => {
        await tx.query(
          `update public.profiles set lead_delivery_email = 'leads@evil.test' where id = $1`,
          [SHOPPER],
        );
      }, 'service_role'),
      (error: unknown) => /privileged profile fields cannot be changed from the client/i.test(messageOf(error)),
    );
    const blocked = await profile(db, SHOPPER);
    assert.equal(blocked?.platform_role, 'dealer_user');
    assert.equal(blocked?.marketcheck_dealer_id, null);
    assert.equal(blocked?.lead_delivery_email, null);

    await withRole(db, 'authenticated', SHOPPER, async (tx) => {
      await tx.query(`update public.profiles set email = 'still-editable@example.com' where id = $1`, [SHOPPER]);
    }, 'service_role');
    assert.equal((await profile(db, SHOPPER))?.email, 'still-editable@example.com');

    await withRole(db, 'service_role', null, async (tx) => {
      await tx.query(
        `update public.profiles
            set platform_role = 'platform_admin',
                lead_delivery_email = 'leads@dealer.example'
          where id = $1`,
        [SHOPPER],
      );
    }, 'authenticated');
    assert.equal((await profile(db, SHOPPER))?.platform_role, 'platform_admin');
    assert.equal((await profile(db, SHOPPER))?.lead_delivery_email, 'leads@dealer.example');

    await db.query(
      `update public.profiles
          set platform_role = 'dealer_user',
              lead_delivery_email = null,
              dms_provider = null
        where id = $1`,
      [SHOPPER],
    );
    await withRole(db, 'supabase_admin', null, async (tx) => {
      await tx.query(
        `update public.profiles set inventory_connected = true where id = $1`,
        [SHOPPER],
      );
    }, 'authenticated');
    assert.equal((await profile(db, SHOPPER))?.inventory_connected, true);

    await db.exec(`
      create or replace function public.promote_profile_as_definer(p_id uuid)
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        update public.profiles
           set platform_role = 'platform_admin',
               dms_provider = 'cdk'
         where id = p_id;
      end;
      $$;
    `);
    await withRole(db, 'authenticated', SHOPPER, async (tx) => {
      await tx.query(`select public.promote_profile_as_definer($1)`, [SHOPPER]);
    }, 'authenticated');
    const trusted = await profile(db, SHOPPER);
    assert.equal(trusted?.platform_role, 'platform_admin');
    assert.equal(trusted?.dms_provider, 'cdk');

    await db.query('begin');
    try {
      await db.query('set session authorization authenticated');
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [SHOPPER]);
      let roleGucError: string | null = null;
      try {
        await db.query(`select set_config('role', 'service_role', true)`);
      } catch (error) {
        roleGucError = messageOf(error);
      }
      if (roleGucError) {
        assert.match(roleGucError, /permission denied/i);
      } else {
        await assert.rejects(
          () => db.query(`update public.profiles set billing_active = true where id = $1`, [SHOPPER]),
          (error: unknown) => /cannot be changed from the client/i.test(messageOf(error)),
        );
      }
    } finally {
      await db.query('rollback');
    }
  } finally {
    await db.close();
  }
});
