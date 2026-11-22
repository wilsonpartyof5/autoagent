import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../../../');
const MIGRATIONS = join(ROOT, 'supabase/migrations');
const HELD = readFileSync(
  join(ROOT, 'supabase/held/20261122210000_store_transaction_unique_grants.sql'),
  'utf8',
);

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const HIST_TX = 'hist_dup';

const TABLE_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] as const;
const TABLES = ['public.store_transactions', 'public.store_transaction_aliases'] as const;

type GrantRow = {
  granted: boolean;
  already_granted: boolean;
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  lifetime_refunded: number;
  already_granted_elsewhere: boolean;
};

type ReverseRow = {
  reversed: boolean;
  already_reversed: boolean;
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  lifetime_refunded: number;
};

type Boot = {
  db: PGlite;
  notices: string[];
  publications: boolean;
  publicationError: string;
  probeAnonSelect: boolean;
  probeClickpipesSelect: boolean;
};

let state: Boot;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function prepare(db: PGlite): Promise<void> {
  await db.exec(`
    create schema if not exists auth;
    create schema if not exists storage;

    create role anon nologin nosuperuser;
    create role authenticated nologin nosuperuser;
    create role service_role nologin nosuperuser bypassrls;
    create role drevvy_clickpipes nologin nosuperuser;

    grant usage on schema public to anon, authenticated, service_role, drevvy_clickpipes;
    grant usage on schema auth to anon, authenticated, service_role;

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

    create table storage.buckets (
      id text primary key,
      name text,
      public boolean,
      file_size_limit bigint,
      allowed_mime_types text[]
    );

    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant select on tables to drevvy_clickpipes;

    create schema if not exists private;
    create function private.drevvy_uuidv7()
    returns uuid
    language sql
    volatile
    as $$ select gen_random_uuid() $$;

    create table public.drevvy_dealers (
      id uuid primary key
    );
  `);
}

async function applyMigrations(db: PGlite): Promise<void> {
  const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
    } catch (error) {
      throw new Error(`${file}: ${messageOf(error)}`);
    }
  }
}

async function privilege(db: PGlite, role: string, table: string, priv: string): Promise<boolean> {
  const result = await db.query<{ ok: boolean }>(
    `select has_table_privilege($1, $2, $3) as ok`,
    [role, table, priv],
  );
  return result.rows[0]?.ok === true;
}

async function balanceOf(db: PGlite, userId: string): Promise<number> {
  const result = await db.query<{ balance: number }>(
    `select balance from public.shopper_credits where user_id = $1`,
    [userId],
  );
  return Number(result.rows[0]?.balance ?? 0);
}

async function grant(
  db: PGlite,
  userId: string,
  packSize: number,
  priceCents: number,
  transactionId: string,
  aliases: string[],
): Promise<GrantRow> {
  const result = await db.query<GrantRow>(
    `select * from public.purchase_credits_atomic($1, $2, $3, $4, $5, $6, $7::text[])`,
    [
      userId,
      packSize,
      priceCents,
      `purchase:${transactionId}`,
      `purchase_reversal:${transactionId}`,
      'drevvy_keys_5',
      aliases,
    ],
  );
  const row = result.rows[0];
  assert.ok(row);
  return row;
}

async function reverse(
  db: PGlite,
  userId: string,
  amount: number,
  transactionId: string,
): Promise<ReverseRow> {
  const result = await db.query<ReverseRow>(
    `select * from public.reverse_purchase_atomic($1, $2, $3, $4)`,
    [userId, amount, `purchase:${transactionId}`, `purchase_reversal:${transactionId}`],
  );
  const row = result.rows[0];
  assert.ok(row);
  return row;
}

describe('held store transaction grants', { concurrency: 1, timeout: 180_000 }, () => {
  before(async () => {
    const db = new PGlite();
    const notices: string[] = [];
    await prepare(db);
    await applyMigrations(db);
    await db.exec(`
      insert into auth.users (id, email) values
        ('${USER_A}', 'a@example.com'),
        ('${USER_B}', 'b@example.com');

      insert into public.shopper_credit_events (
        user_id, event_type, amount, pack_size, idempotency_key, created_at
      ) values
        ('${USER_B}', 'purchase', 5, 5, 'purchase:${HIST_TX}', '2026-01-01T00:00:00Z'),
        ('${USER_A}', 'purchase', 10, 10, 'purchase:${HIST_TX}', '2026-01-02T00:00:00Z');
    `);

    await db.exec(`create table public.default_privilege_probe (id integer);`);
    const probeAnonSelect = await privilege(db, 'anon', 'public.default_privilege_probe', 'SELECT');
    const probeClickpipesSelect = await privilege(db, 'drevvy_clickpipes', 'public.default_privilege_probe', 'SELECT');
    await db.exec(`drop table public.default_privilege_probe;`);

    let publications = false;
    let publicationError = '';
    try {
      await db.exec(`
        create publication supabase_realtime;
        create publication drevvy_clickhouse;
        create publication drevvy_clickpipes;
      `);
      publications = true;
    } catch (error) {
      publicationError = messageOf(error);
    }

    await db.exec(HELD, {
      onNotice: (notice) => {
        if (notice.message) notices.push(notice.message);
      },
    });
    state = { db, notices, publications, publicationError, probeAnonSelect, probeClickpipesSelect };
  });

  test('default privileges are revoked and the tables are not published', async () => {
    assert.equal(state.probeAnonSelect, true);
    assert.equal(state.probeClickpipesSelect, true);
    const { db } = state;
    for (const table of TABLES) {
      for (const role of ['anon', 'authenticated', 'drevvy_clickpipes'] as const) {
        for (const priv of TABLE_PRIVILEGES) {
          assert.equal(await privilege(db, role, table, priv), false, `${role} ${priv} on ${table}`);
        }
      }
      assert.equal(await privilege(db, 'service_role', table, 'SELECT'), true, table);
    }

    const rls = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('store_transactions', 'store_transaction_aliases')
      order by c.relname
    `);
    assert.equal(rls.rows.length, 2);
    for (const row of rls.rows) {
      assert.equal(row.relrowsecurity, true, row.relname);
      assert.equal(row.relforcerowsecurity, true, row.relname);
    }

    const purchaseExecute = await db.query<{ ok: boolean }>(`
      select has_function_privilege(
        'drevvy_clickpipes',
        'public.purchase_credits_atomic(uuid,integer,integer,text,text,text,text[])',
        'execute'
      ) as ok
    `);
    const reverseExecute = await db.query<{ ok: boolean }>(`
      select has_function_privilege(
        'drevvy_clickpipes',
        'public.reverse_purchase_atomic(uuid,integer,text,text)',
        'execute'
      ) as ok
    `);
    assert.equal(purchaseExecute.rows[0]?.ok, false);
    assert.equal(reverseExecute.rows[0]?.ok, false);

    const txCreate = HELD.indexOf('create table if not exists public.store_transactions');
    const txRevoke = HELD.indexOf('revoke all on table public.store_transactions from drevvy_clickpipes');
    const aliasCreate = HELD.indexOf('create table if not exists public.store_transaction_aliases');
    const aliasRevoke = HELD.indexOf('revoke all on table public.store_transaction_aliases from drevvy_clickpipes');
    assert.ok(txCreate >= 0 && txCreate < txRevoke && txRevoke < aliasCreate && aliasCreate < aliasRevoke);
    assert.equal(/alter publication/i.test(HELD), false);
    assert.equal(/create publication/i.test(HELD), false);
    assert.match(HELD, /supabase_realtime/);
    assert.match(HELD, /drevvy_clickhouse/);
    assert.match(HELD, /drevvy_clickpipes are explicit lists/);

    assert.equal(state.publications, true, state.publicationError);
    if (state.publications) {
      const published = await db.query<{ name: string }>(`
        select c.relname as name
        from pg_publication_rel pr
        join pg_class c on c.oid = pr.prrelid
        where c.relname in ('store_transactions', 'store_transaction_aliases')
      `);
      assert.equal(published.rows.length, 0);
      const flags = await db.query<{ pubname: string; puballtables: boolean }>(`
        select pubname, puballtables
        from pg_publication
        where pubname in ('supabase_realtime', 'drevvy_clickhouse', 'drevvy_clickpipes')
      `);
      assert.equal(flags.rows.length, 3);
      for (const row of flags.rows) assert.equal(row.puballtables, false, row.pubname);
    }
  });

  test('a cross-user grant of the same txid is refused and does not change the balance', async () => {
    const { db } = state;
    const first = await grant(db, USER_A, 5, 1999, 'cross_tx', ['cross_tx']);
    assert.equal(first.granted, true);
    assert.equal(first.already_granted_elsewhere, false);
    assert.equal(await balanceOf(db, USER_A), 5);

    const second = await grant(db, USER_B, 5, 1999, 'cross_tx', ['cross_tx']);
    assert.equal(second.granted, false);
    assert.equal(second.already_granted, false);
    assert.equal(second.already_granted_elsewhere, true);
    assert.equal(Number(second.balance), 0);
    assert.equal(await balanceOf(db, USER_B), 0);
    assert.equal(await balanceOf(db, USER_A), 5);
  });

  test('a refund recorded first by alias blocks a later grant, and a refund by alias reverses the granted user', async () => {
    const { db } = state;
    const tombstone = await reverse(db, USER_B, 25, 'tomb_alias');
    assert.equal(tombstone.reversed, false);
    assert.equal(await balanceOf(db, USER_A), 5);
    assert.equal(await balanceOf(db, USER_B), 0);

    const blocked = await grant(db, USER_A, 10, 3499, 'tomb_canonical', ['tomb_canonical', 'tomb_alias']);
    assert.equal(blocked.granted, false);
    assert.equal(blocked.already_granted, false);
    assert.equal(blocked.already_granted_elsewhere, false);
    assert.equal(await balanceOf(db, USER_A), 5);

    const granted = await grant(db, USER_A, 5, 1999, 'alias_tx', ['alias_tx', 'alias_rc']);
    assert.equal(granted.granted, true);
    assert.equal(await balanceOf(db, USER_A), 10);

    const sameUser = await grant(db, USER_A, 5, 1999, 'alias_rc', ['alias_rc', 'alias_tx']);
    assert.equal(sameUser.granted, false);
    assert.equal(sameUser.already_granted, true);
    assert.equal(sameUser.already_granted_elsewhere, false);
    assert.equal(await balanceOf(db, USER_A), 10);

    const refunded = await reverse(db, USER_B, 25, 'alias_rc');
    assert.equal(refunded.reversed, true);
    assert.equal(Number(refunded.balance), 5);
    assert.equal(Number(refunded.lifetime_refunded), 5);
    assert.equal(await balanceOf(db, USER_A), 5);
    assert.equal(await balanceOf(db, USER_B), 0);
  });

  test('a refund debits the pack size stored on the purchase row', async () => {
    const { db } = state;
    const granted = await grant(db, USER_B, 10, 3499, 'stored_pack', ['stored_pack']);
    assert.equal(granted.granted, true);
    assert.equal(await balanceOf(db, USER_B), 10);

    const refunded = await reverse(db, USER_B, 25, 'stored_pack');
    assert.equal(refunded.reversed, true);
    assert.equal(Number(refunded.balance), 0);
    assert.equal(Number(refunded.lifetime_refunded), 10);
    assert.equal(await balanceOf(db, USER_B), 0);
    const stored = await db.query<{ pack_size: number }>(
      `select pack_size from public.store_transactions where transaction_id = 'stored_pack'`,
    );
    assert.equal(Number(stored.rows[0]?.pack_size), 10);
  });

  test('two claims of one txid grant once; PGlite is single-connection so they run one after another', async () => {
    const { db } = state;
    const [first, second] = await Promise.all([
      grant(db, USER_A, 5, 1999, 'race_tx', ['race_tx']),
      grant(db, USER_B, 5, 1999, 'race_tx', ['race_tx']),
    ]);
    const grants = [first, second].filter((row) => row.granted === true);
    assert.equal(grants.length, 1);
    const elsewhere = [first, second].filter((row) => row.already_granted_elsewhere === true);
    assert.equal(elsewhere.length, 1);
    assert.equal((await balanceOf(db, USER_A)) + (await balanceOf(db, USER_B)), 5 + 5);
    const rows = await db.query<{ user_id: string }>(
      `select user_id from public.store_transactions where transaction_id = 'race_tx'`,
    );
    assert.equal(rows.rows.length, 1);
  });

  test('backfill keeps one deterministic owner and the pre-check reports duplicate users', async () => {
    const { db, notices } = state;
    const owner = await db.query<{ user_id: string; pack_size: number }>(
      `select user_id, pack_size from public.store_transactions where transaction_id = $1`,
      [HIST_TX],
    );
    assert.equal(owner.rows.length, 1);
    assert.equal(owner.rows[0]?.user_id, USER_B);
    assert.equal(Number(owner.rows[0]?.pack_size), 5);

    const events = await db.query<{ user_id: string }>(
      `select user_id from public.shopper_credit_events where idempotency_key = $1 order by created_at`,
      [`purchase:${HIST_TX}`],
    );
    assert.deepEqual(events.rows.map((row) => row.user_id), [USER_B, USER_A]);

    const report = await db.query<{ transaction_id: string; user_count: number; user_ids: string[] | string }>(`
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
    `);
    const row = report.rows.find((item) => item.transaction_id === HIST_TX);
    assert.ok(row);
    assert.equal(Number(row.user_count), 2);
    const reportedIds = Array.isArray(row.user_ids) ? row.user_ids.join(',') : String(row.user_ids);
    assert.match(reportedIds, new RegExp(USER_A));
    assert.match(reportedIds, new RegExp(USER_B));

    const warning = notices.find((notice) => notice.includes(HIST_TX));
    assert.ok(warning);
    assert.match(warning, /2 users/);
    assert.match(warning, new RegExp(USER_A));
    assert.match(warning, new RegExp(USER_B));
  });
});
