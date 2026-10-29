import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { ensureConsumerProfile } from '../consumer/auth';
import {
  KEY_PACKS,
  STARTER_FREE_KEYS,
  STARTER_GRANT_EVENT_TYPE,
  STARTER_GRANT_IDEMPOTENCY_KEY,
} from './credits';
import { unlockMarketAndSave } from './market-save';
import type { SavedCarRepository, SavedCarRow } from './saved-cars';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261029170000_starter_free_keys.sql'),
  'utf8',
);
const KEYS = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261026120000_key_spend_and_refunds.sql'),
  'utf8',
);
const STAMPS = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261027233000_stamp_credit_event_key_fields.sql'),
  'utf8',
);

const NEW_USER = '11111111-1111-4111-8111-111111111111';
const DIRECT_USER = '22222222-2222-4222-8222-222222222222';
const DISABLED_USER = '44444444-4444-4444-8444-444444444444';
const LISTING_ID = 'mc-listing-1';

function shopper(id: string): User {
  return { id } as User;
}

function memoryRepo(): SavedCarRepository {
  const rows: SavedCarRow[] = [];
  return {
    async list(userId) {
      return rows.filter((row) => row.userId === userId);
    },
    async find(userId, listingId) {
      return rows.find((row) => row.userId === userId && row.listingId === listingId) ?? null;
    },
    async save(row) {
      const index = rows.findIndex((item) => item.userId === row.userId && item.listingId === row.listingId);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      return row;
    },
    async remove(userId, listingId) {
      const index = rows.findIndex((item) => item.userId === userId && item.listingId === listingId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}

function rpcClient(db: PGlite): SupabaseClient {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      try {
        if (fn === 'ensure_consumer_profile') {
          const result = await db.query(
            'select status, starter_granted, balance from public.ensure_consumer_profile($1)',
            [params.p_user_id],
          );
          return { data: result.rows, error: null };
        }
        if (fn === 'consume_market_save_atomic') {
          const result = await db.query(
            'select * from public.consume_market_save_atomic($1, $2)',
            [params.p_user_id, params.p_listing_id],
          );
          return { data: result.rows, error: null };
        }
        return { data: null, error: { message: `unknown rpc ${fn}` } };
      } catch (error) {
        return {
          data: null,
          error: { message: error instanceof Error ? error.message : 'rpc failed' },
        };
      }
    },
  } as unknown as SupabaseClient;
}

async function boot(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create table public.shopper_credits (
      user_id uuid primary key,
      balance integer not null default 0 check (balance >= 0),
      lifetime_purchased integer not null default 0,
      lifetime_used integer not null default 0,
      lifetime_refunded integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table public.shopper_credit_events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      event_type text not null check (event_type in ('purchase', 'use', 'refund')),
      amount integer not null check (amount > 0),
      deal_id uuid,
      pack_size integer,
      pack_price_usd integer,
      idempotency_key text not null,
      created_at timestamptz not null default now(),
      unique (user_id, idempotency_key)
    );

    create table public.consumer_profiles (
      user_id uuid primary key,
      status text not null check (status in ('active', 'disabled')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table public.consumer_profile_status_events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      status text not null check (status in ('active', 'disabled')),
      occurred_at timestamptz not null default now()
    );
  `);
  await db.exec(KEYS);
  await db.exec(STAMPS);
  await db.exec(SQL);
  return db;
}

async function balanceOf(db: PGlite, userId: string): Promise<number | null> {
  const result = await db.query<{ balance: number }>(
    'select balance from public.shopper_credits where user_id = $1',
    [userId],
  );
  return result.rows[0]?.balance ?? null;
}

test('starter grant is exactly 3 keys and is recorded apart from a purchase', () => {
  assert.equal(STARTER_FREE_KEYS, 3);
  assert.equal(STARTER_GRANT_EVENT_TYPE, 'starter_grant');
  assert.equal(STARTER_GRANT_IDEMPOTENCY_KEY, 'starter_grant');
  assert.match(SQL, new RegExp(`v_amount integer := ${STARTER_FREE_KEYS};`));
  assert.match(SQL, new RegExp(`'${STARTER_GRANT_EVENT_TYPE}'`));
  assert.match(SQL, new RegExp(`'${STARTER_GRANT_IDEMPOTENCY_KEY}'`));
  assert.match(SQL, /insert into public\.consumer_profiles/);
  assert.match(SQL, /lifetime_purchased is left unchanged/);
  assert.equal(SQL.includes('lifetime_purchased = shopper_credits.lifetime_purchased +'), false);
  assert.deepEqual(KEY_PACKS.map((pack) => [pack.size, pack.priceUsd]), [
    [1, 4.99],
    [5, 19.99],
    [10, 34.99],
    [25, 74.99],
  ]);

  for (const route of ['apple', 'google', 'refresh']) {
    const source = readFileSync(join(HERE, `../../app/api/consumer/auth/${route}/route.ts`), 'utf8');
    assert.match(source, /ensureConsumerProfile/);
  }
});

test('a new shopper gets 3 keys once, and that balance unlocks market details', async () => {
  const db = await boot();
  try {
    const admin = rpcClient(db);
    const repo = memoryRepo();
    const deps = {
      repo,
      ownsDeal: async () => false,
      lookup: async () => null,
      now: new Date('2026-10-29T16:00:00.000Z'),
      supabase: admin,
    };

    const first = await ensureConsumerProfile(shopper(NEW_USER), admin);
    assert.equal(first, 'active');
    assert.equal(await balanceOf(db, NEW_USER), STARTER_FREE_KEYS);

    const granted = await db.query<{
      event_type: string;
      amount: number;
      idempotency_key: string;
      pack_size: number | null;
    }>(
      `select event_type, amount, idempotency_key, pack_size
         from public.shopper_credit_events
        where user_id = $1`,
      [NEW_USER],
    );
    assert.deepEqual(granted.rows, [{
      event_type: STARTER_GRANT_EVENT_TYPE,
      amount: STARTER_FREE_KEYS,
      idempotency_key: STARTER_GRANT_IDEMPOTENCY_KEY,
      pack_size: null,
    }]);

    const ledger = await db.query<{ lifetime_purchased: number; lifetime_used: number }>(
      'select lifetime_purchased, lifetime_used from public.shopper_credits where user_id = $1',
      [NEW_USER],
    );
    assert.equal(ledger.rows[0]?.lifetime_purchased, 0);
    assert.equal(ledger.rows[0]?.lifetime_used, 0);

    const again = await ensureConsumerProfile(shopper(NEW_USER), admin);
    assert.equal(again, 'active');
    assert.equal(await balanceOf(db, NEW_USER), STARTER_FREE_KEYS);
    const eventsAfterLogin = await db.query<{ count: number }>(
      `select count(*)::int as count
         from public.shopper_credit_events
        where user_id = $1 and event_type = $2`,
      [NEW_USER, STARTER_GRANT_EVENT_TYPE],
    );
    assert.equal(eventsAfterLogin.rows[0]?.count, 1);
    const profileEvents = await db.query<{ count: number }>(
      'select count(*)::int as count from public.consumer_profile_status_events where user_id = $1',
      [NEW_USER],
    );
    assert.equal(profileEvents.rows[0]?.count, 1);

    const unlocked = await unlockMarketAndSave(NEW_USER, { listingId: LISTING_ID }, deps);
    assert.equal(unlocked.spent, true);
    assert.equal(unlocked.credits.balance, STARTER_FREE_KEYS - 1);
    assert.equal(unlocked.credits.canAdd, true);
    assert.equal(await balanceOf(db, NEW_USER), STARTER_FREE_KEYS - 1);

    const unlockedAgain = await unlockMarketAndSave(NEW_USER, { listingId: LISTING_ID }, deps);
    assert.equal(unlockedAgain.spent, false);
    assert.equal(unlockedAgain.credits.balance, STARTER_FREE_KEYS - 1);

    const relogin = await ensureConsumerProfile(shopper(NEW_USER), admin);
    assert.equal(relogin, 'active');
    assert.equal(await balanceOf(db, NEW_USER), STARTER_FREE_KEYS - 1);

    const purchased = await db.query<{ granted: boolean; balance: number; lifetime_purchased: number }>(
      'select * from public.purchase_credits_atomic($1, $2, $3, $4, $5)',
      [NEW_USER, 1, 499, 'purchase:txn_one', 'purchase_reversal:txn_one'],
    );
    assert.equal(purchased.rows[0]?.granted, true);
    assert.equal(purchased.rows[0]?.balance, STARTER_FREE_KEYS);
    assert.equal(purchased.rows[0]?.lifetime_purchased, 1);

    const kinds = await db.query<{ event_type: string; amount: number }>(
      `select event_type, amount
         from public.shopper_credit_events
        where user_id = $1
        order by event_type`,
      [NEW_USER],
    );
    assert.deepEqual(kinds.rows, [
      { event_type: 'purchase', amount: 1 },
      { event_type: STARTER_GRANT_EVENT_TYPE, amount: STARTER_FREE_KEYS },
      { event_type: 'use', amount: 1 },
    ]);

    const direct = await db.query<{ granted: boolean; already_granted: boolean; balance: number; lifetime_purchased: number }>(
      'select * from public.grant_starter_keys_atomic($1)',
      [DIRECT_USER],
    );
    assert.equal(direct.rows[0]?.granted, true);
    assert.equal(direct.rows[0]?.already_granted, false);
    assert.equal(direct.rows[0]?.balance, STARTER_FREE_KEYS);
    assert.equal(direct.rows[0]?.lifetime_purchased, 0);
    const directAgain = await db.query<{ granted: boolean; already_granted: boolean; balance: number }>(
      'select * from public.grant_starter_keys_atomic($1)',
      [DIRECT_USER],
    );
    assert.equal(directAgain.rows[0]?.granted, false);
    assert.equal(directAgain.rows[0]?.already_granted, true);
    assert.equal(directAgain.rows[0]?.balance, STARTER_FREE_KEYS);

    await db.exec(`
      insert into public.consumer_profiles (user_id, status)
      values ('${DISABLED_USER}', 'disabled')
    `);
    const disabled = await ensureConsumerProfile(shopper(DISABLED_USER), admin);
    assert.equal(disabled, 'disabled');
    assert.equal(await balanceOf(db, DISABLED_USER), null);
    const disabledEvents = await db.query<{ count: number }>(
      'select count(*)::int as count from public.shopper_credit_events where user_id = $1',
      [DISABLED_USER],
    );
    assert.equal(disabledEvents.rows[0]?.count, 0);
    const blocked = await db.query<{ consumed: boolean; balance: number }>(
      'select * from public.consume_market_save_atomic($1, $2)',
      [DISABLED_USER, 'mc-listing-2'],
    );
    assert.equal(blocked.rows[0]?.consumed, false);
    assert.equal(blocked.rows[0]?.balance, 0);

    const privileges = await db.query<{
      anon_grant: boolean;
      anon_ensure: boolean;
      auth_ensure: boolean;
      service_ensure: boolean;
      service_grant: boolean;
    }>(`
      select
        has_function_privilege('anon', 'public.grant_starter_keys_atomic(uuid)', 'execute') as anon_grant,
        has_function_privilege('anon', 'public.ensure_consumer_profile(uuid)', 'execute') as anon_ensure,
        has_function_privilege('authenticated', 'public.ensure_consumer_profile(uuid)', 'execute') as auth_ensure,
        has_function_privilege('service_role', 'public.ensure_consumer_profile(uuid)', 'execute') as service_ensure,
        has_function_privilege('service_role', 'public.grant_starter_keys_atomic(uuid)', 'execute') as service_grant
    `);
    assert.equal(privileges.rows[0]?.anon_grant, false);
    assert.equal(privileges.rows[0]?.anon_ensure, false);
    assert.equal(privileges.rows[0]?.auth_ensure, false);
    assert.equal(privileges.rows[0]?.service_ensure, true);
    assert.equal(privileges.rows[0]?.service_grant, true);
  } finally {
    await db.close();
  }
});

test('ensureConsumerProfile reports a failed profile open', async () => {
  const admin = {
    rpc: async () => ({ data: null, error: { message: 'db down' } }),
  } as unknown as SupabaseClient;
  await assert.rejects(
    () => ensureConsumerProfile(shopper(NEW_USER), admin),
    /db down/,
  );
});
