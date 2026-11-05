import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { unlockMarketAndSave, type MarketSaveDeps } from './market-save';
import type { MarketIntel } from './market-intel';
import type { CommitMarketUnlockInput, CommitMarketUnlockResult, StoredMarketUnlock } from './market-unlock-store';
import type { SavedCarRepository, SavedCarRow } from './saved-cars';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261105231000_shopper_market_unlocks.sql'),
  'utf8',
);

const SHOPPER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SHOPPER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LISTING = 'mc-listing-1';
const VIN = '1GNSKCKD5RR123456';

test('parallel unlocks charge one key and a second shopper cannot read the snapshot', async () => {
  const repo = memoryRepo();
  const ledger = exclusiveLedger(new Map([
    ['shopper-1', 5],
    ['shopper-2', 4],
  ]));
  const deps = depsFor(repo, ledger, usedIntel());
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    await pause();
    return usedIntel();
  };

  const results = await Promise.all(
    Array.from({ length: 8 }, () => unlockMarketAndSave('shopper-1', { listingId: LISTING, vin: VIN }, deps)),
  );
  const spent = results.filter((result) => result.spent);
  assert.equal(spent.length, 1);
  assert.equal(results.every((result) => result.unlocked && result.available), true);
  assert.equal(new Set(results.map((result) => result.market?.fairVehiclePrice)).size, 1);
  assert.equal(ledger.balance('shopper-1'), 4);
  assert.equal(repo.rows.length, 1);
  assert.equal(loads, 8);

  const repeat = await unlockMarketAndSave('shopper-1', { listingId: LISTING }, deps);
  assert.equal(repeat.spent, false);
  assert.equal(repeat.market?.fairVehiclePrice, 30100);
  assert.equal(ledger.balance('shopper-1'), 4);
  assert.equal(loads, 8);

  const other = await unlockMarketAndSave('shopper-2', { listingId: LISTING }, deps);
  assert.equal(other.spent, true);
  assert.equal(ledger.balance('shopper-2'), 3);
  assert.equal(ledger.balance('shopper-1'), 4);
  assert.equal(await ledger.read('shopper-2', 'mc-listing-2'), null);
  assert.ok(await ledger.read('shopper-1', LISTING));
  assert.equal((await ledger.read('shopper-1', LISTING))?.fairVehiclePrice, 30100);
  assert.notEqual(await ledger.read('shopper-1', LISTING), await ledger.read('shopper-2', LISTING));
});

test('a failed save after the charge retries without spending again', async () => {
  const repo = memoryRepo();
  const ledger = exclusiveLedger(new Map([['shopper-1', 2]]));
  const deps = depsFor(repo, ledger, usedIntel());
  let saves = 0;
  const original = repo.save.bind(repo);
  repo.save = async (row) => {
    saves += 1;
    if (saves === 1) throw new Error('storage down');
    return original(row);
  };

  await assert.rejects(() => unlockMarketAndSave('shopper-1', { listingId: LISTING }, deps), /storage down/);
  assert.equal(ledger.balance('shopper-1'), 1);
  assert.equal(repo.rows.length, 0);

  const retry = await unlockMarketAndSave('shopper-1', { listingId: LISTING }, deps);
  assert.equal(retry.spent, false);
  assert.equal(retry.unlocked, true);
  assert.equal(retry.market?.listedPrice, 32995);
  assert.equal(ledger.balance('shopper-1'), 1);
  assert.equal(repo.rows.length, 1);
});

test('the stored snapshot wins when a later lookup would return a different value', async () => {
  const repo = memoryRepo();
  const ledger = exclusiveLedger(new Map([['shopper-1', 3]]));
  const firstIntel = usedIntel();
  const deps = depsFor(repo, ledger, firstIntel);
  const opened = await unlockMarketAndSave('shopper-1', { listingId: LISTING }, deps);
  assert.equal(opened.spent, true);

  deps.loadMarketIntel = async () => ({ ...usedIntel(), fairVehiclePrice: 11111, listedPrice: 11111 });
  const again = await unlockMarketAndSave('shopper-1', { listingId: LISTING }, deps);
  assert.equal(again.spent, false);
  assert.equal(again.market?.fairVehiclePrice, 30100);
  assert.equal(ledger.balance('shopper-1'), 2);
});

test('unlock_market_intel_atomic charges once, isolates shoppers, and refuses an empty market', async () => {
  assert.match(SQL, /for update/);
  assert.match(SQL, /market intelligence has no value/);
  assert.match(SQL, /use:market_save:/);
  const raiseAt = SQL.indexOf('market intelligence has no value');
  const chargeAt = SQL.indexOf('insert into public.shopper_credit_events');
  assert.ok(raiseAt > 0 && raiseAt < chargeAt);

  const db = await boot();
  try {
    await seed(db, SHOPPER_A, 3);
    await seed(db, SHOPPER_B, 3);

    const [first, second] = await Promise.all([
      unlock(db, SHOPPER_A),
      unlock(db, SHOPPER_A),
    ]);
    const charged = [first, second].filter((row) => row.charged);
    assert.equal(charged.length, 1);
    assert.equal(first.unlocked && second.unlocked, true);
    assert.equal(await balance(db, SHOPPER_A), 2);
    assert.equal(await eventCount(db, SHOPPER_A, LISTING), 1);

    const repeat = await unlock(db, SHOPPER_A);
    assert.equal(repeat.charged, false);
    assert.equal(repeat.already_unlocked, true);
    assert.equal(repeat.market.fairVehiclePrice, 30100);
    assert.equal(await balance(db, SHOPPER_A), 2);

    const other = await unlock(db, SHOPPER_B);
    assert.equal(other.charged, true);
    assert.equal(await balance(db, SHOPPER_B), 2);
    const rows = await db.query<{ user_id: string }>(
      'select user_id from public.shopper_market_unlocks where listing_id = $1 order by user_id',
      [LISTING],
    );
    assert.deepEqual(rows.rows.map((row) => row.user_id), [SHOPPER_A, SHOPPER_B]);

    await assert.rejects(
      () => db.query(
        'select * from public.unlock_market_intel_atomic($1, $2, $3, $4::jsonb)',
        [SHOPPER_A, LISTING, VIN, JSON.stringify({})],
      ),
      /no value/,
    );
    assert.equal(await balance(db, SHOPPER_A), 2);
    assert.equal(await eventCount(db, SHOPPER_A, LISTING), 1);

    await seed(db, SHOPPER_A, 0);
    const broke = await db.query<{ unlocked: boolean; charged: boolean }>(
      'select * from public.unlock_market_intel_atomic($1, $2, $3, $4::jsonb)',
      [SHOPPER_A, 'mc-listing-9', VIN, JSON.stringify(usedIntel())],
    );
    assert.equal(broke.rows[0]?.unlocked, false);
    assert.equal(broke.rows[0]?.charged, false);
    const missed = await db.query<{ count: number }>(
      'select count(*)::int as count from public.shopper_market_unlocks where listing_id = $1',
      ['mc-listing-9'],
    );
    assert.equal(missed.rows[0]?.count, 0);

    await db.exec(`
      insert into public.shopper_credits (user_id, balance)
      values ('${SHOPPER_B}', 1)
      on conflict (user_id) do update set balance = 1
    `);
    await db.query(
      `insert into public.shopper_credit_events
         (user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key)
       values ($1, 'use', 1, 'mc-paid-1', 'market_save', 'market_intel', 'use:market_save:mc-paid-1')`,
      [SHOPPER_B],
    );
    const before = await balance(db, SHOPPER_B);
    const repaired = await db.query<{ charged: boolean; unlocked: boolean }>(
      'select * from public.unlock_market_intel_atomic($1, $2, $3, $4::jsonb)',
      [SHOPPER_B, 'mc-paid-1', null, JSON.stringify(usedIntel())],
    );
    assert.equal(repaired.rows[0]?.unlocked, true);
    assert.equal(repaired.rows[0]?.charged, false);
    assert.equal(await balance(db, SHOPPER_B), before);

    await db.query(
      `insert into public.consumer_profiles (user_id, status, zip) values ($1, 'active', '62701')`,
      [SHOPPER_A],
    );
    await assert.rejects(
      () => db.query(
        `update public.consumer_profiles set zip = '12' where user_id = $1`,
        [SHOPPER_A],
      ),
      /consumer_profiles_zip_check|check constraint/,
    );

    const privileges = await db.query<{ anon_exec: boolean; auth_exec: boolean; service_exec: boolean }>(`
      select
        has_function_privilege('anon', 'public.unlock_market_intel_atomic(uuid, text, text, jsonb)', 'execute') as anon_exec,
        has_function_privilege('authenticated', 'public.unlock_market_intel_atomic(uuid, text, text, jsonb)', 'execute') as auth_exec,
        has_function_privilege('service_role', 'public.unlock_market_intel_atomic(uuid, text, text, jsonb)', 'execute') as service_exec
    `);
    assert.equal(privileges.rows[0]?.anon_exec, false);
    assert.equal(privileges.rows[0]?.auth_exec, false);
    assert.equal(privileges.rows[0]?.service_exec, true);
  } finally {
    await db.close();
  }
});

test('the unlock read is owner scoped and is not the heart save', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/listings/[id]/market-intel/route.ts'), 'utf8');
  const store = readFileSync(join(HERE, 'market-unlock-store.ts'), 'utf8');
  const heart = readFileSync(join(HERE, '../../app/api/consumer/saved-cars/route.ts'), 'utf8');
  assert.match(route, /requireShopperAuth/);
  assert.match(route, /findMarketUnlock/);
  assert.match(store, /shopper_market_unlocks/);
  assert.match(store, /\.eq\('user_id', userId\)/);
  assert.equal(route.includes('/api/public'), false);
  assert.equal(heart.includes('shopper_market_unlocks'), false);
  assert.equal(heart.includes('unlock_market_intel_atomic'), false);
});

function usedIntel(): MarketIntel {
  return {
    fairVehiclePrice: 30100,
    lowPrice: 28000,
    medianPrice: 30500,
    highPrice: 33000,
    comparablesCount: 8,
    daysListedMedian: 21,
    priceDrops: 1,
    isNewCar: false,
    msrp: null,
    msrpDiscount: null,
    listedPrice: 32995,
    source: 'marketcheck',
  };
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

type Ledger = {
  balance: (userId: string) => number;
  read: (userId: string, listingId: string) => Promise<MarketIntel | null>;
  commitUnlock: (input: CommitMarketUnlockInput) => Promise<CommitMarketUnlockResult>;
};

function exclusiveLedger(opening: Map<string, number>): Ledger {
  const balances = new Map(opening);
  const rows = new Map<string, MarketIntel>();
  let chain = Promise.resolve();
  return {
    balance: (userId) => balances.get(userId) ?? 0,
    read: async (userId, listingId) => rows.get(`${userId}:${listingId}`) ?? null,
    commitUnlock: (input) => {
      const run = chain.then(async () => {
        await pause();
        const key = `${input.userId}:${input.listingId}`;
        const balance = balances.get(input.userId) ?? 0;
        const existing = rows.get(key);
        if (existing) {
          return {
            unlocked: true,
            alreadyUnlocked: true,
            charged: false,
            balance,
            market: existing,
          };
        }
        if (balance < 1) {
          return {
            unlocked: false,
            alreadyUnlocked: false,
            charged: false,
            balance,
            market: null,
            error: 'no_credits' as const,
          };
        }
        balances.set(input.userId, balance - 1);
        rows.set(key, input.market);
        return {
          unlocked: true,
          alreadyUnlocked: false,
          charged: true,
          balance: balance - 1,
          market: input.market,
        };
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

function depsFor(repo: SavedCarRepository, ledger: Ledger, intel: MarketIntel): MarketSaveDeps {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: (_column: string, userId: string) => ({
          maybeSingle: async () => ({
            data: {
              user_id: userId,
              balance: ledger.balance(userId),
              lifetime_purchased: 0,
              lifetime_used: 0,
              lifetime_refunded: 0,
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async () => {
      throw new Error('production rpc is not used by this fixture');
    },
  } as unknown as SupabaseClient;
  return {
    repo,
    ownsDeal: async () => false,
    lookup: async () => null,
    now: new Date('2026-11-05T00:00:00.000Z'),
    supabase,
    profileZip: async () => null,
    loadMarketIntel: async () => intel,
    findUnlock: async (userId, listingId) => {
      const market = await ledger.read(userId, listingId);
      if (!market) return null;
      const stored: StoredMarketUnlock = {
        listingId,
        vin: VIN,
        unlockedAt: '2026-11-05T00:00:00.000Z',
        market,
      };
      return stored;
    },
    commitUnlock: (input) => ledger.commitUnlock(input),
  };
}

function memoryRepo(): SavedCarRepository & { rows: SavedCarRow[] } {
  const rows: SavedCarRow[] = [];
  return {
    rows,
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

async function boot(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

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
      event_type text not null check (event_type in ('purchase', 'use', 'refund', 'starter_grant')),
      amount integer not null check (amount > 0),
      deal_id uuid,
      listing_id text,
      spend_kind text,
      key_kind text,
      idempotency_key text not null,
      created_at timestamptz not null default now(),
      unique (user_id, idempotency_key)
    );

    create table public.consumer_profiles (
      user_id uuid primary key,
      status text not null check (status in ('active', 'disabled')),
      first_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await db.exec(SQL);
  return db;
}

async function seed(db: PGlite, userId: string, opening: number): Promise<void> {
  await db.query('insert into auth.users (id) values ($1) on conflict (id) do nothing', [userId]);
  await db.query(
    `insert into public.shopper_credits (user_id, balance)
     values ($1, $2)
     on conflict (user_id) do update set balance = excluded.balance`,
    [userId, opening],
  );
}

async function unlock(db: PGlite, userId: string): Promise<{
  unlocked: boolean;
  already_unlocked: boolean;
  charged: boolean;
  balance: number;
  market: MarketIntel;
}> {
  const result = await db.query<{
    unlocked: boolean;
    already_unlocked: boolean;
    charged: boolean;
    balance: number;
    market: MarketIntel;
  }>(
    'select * from public.unlock_market_intel_atomic($1, $2, $3, $4::jsonb)',
    [userId, LISTING, VIN, JSON.stringify(usedIntel())],
  );
  return result.rows[0];
}

async function balance(db: PGlite, userId: string): Promise<number> {
  const result = await db.query<{ balance: number }>(
    'select balance from public.shopper_credits where user_id = $1',
    [userId],
  );
  return result.rows[0]?.balance ?? -1;
}

async function eventCount(db: PGlite, userId: string, listingId: string): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.shopper_credit_events
      where user_id = $1 and idempotency_key = $2`,
    [userId, `use:market_save:${listingId}`],
  );
  return result.rows[0]?.count ?? 0;
}
