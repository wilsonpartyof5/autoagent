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
  join(HERE, '../../../../../supabase/migrations/20261120180000_shopper_market_unlocks.sql'),
  'utf8',
);
const GUARD_SQL = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261120201000_market_save_lookup_guards.sql'),
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
  assert.equal(loads, 1);

  const repeat = await unlockMarketAndSave('shopper-1', { listingId: LISTING }, deps);
  assert.equal(repeat.spent, false);
  assert.equal(repeat.market?.fairVehiclePrice, 30100);
  assert.equal(ledger.balance('shopper-1'), 4);
  assert.equal(loads, 1);

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
  assert.match(SQL, /set search_path = ''/);
  assert.equal(SQL.includes('set search_path = public'), false);
  assert.match(SQL, /pg_catalog\.now\(\)/);
  assert.match(SQL, /refund_unstored_market_save/);
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

    const privileges = await db.query<{
      anon_exec: boolean;
      auth_exec: boolean;
      service_exec: boolean;
      anon_refund: boolean;
      service_refund: boolean;
    }>(`
      select
        has_function_privilege('anon', 'public.unlock_market_intel_atomic(uuid, text, text, jsonb)', 'execute') as anon_exec,
        has_function_privilege('authenticated', 'public.unlock_market_intel_atomic(uuid, text, text, jsonb)', 'execute') as auth_exec,
        has_function_privilege('service_role', 'public.unlock_market_intel_atomic(uuid, text, text, jsonb)', 'execute') as service_exec,
        has_function_privilege('anon', 'public.refund_unstored_market_save(uuid, text)', 'execute') as anon_refund,
        has_function_privilege('service_role', 'public.refund_unstored_market_save(uuid, text)', 'execute') as service_refund
    `);
    assert.equal(privileges.rows[0]?.anon_exec, false);
    assert.equal(privileges.rows[0]?.auth_exec, false);
    assert.equal(privileges.rows[0]?.service_exec, true);
    assert.equal(privileges.rows[0]?.anon_refund, false);
    assert.equal(privileges.rows[0]?.service_refund, true);

    await db.query(
      `update public.shopper_credits
         set balance = 1, lifetime_used = 0
       where user_id = $1`,
      [SHOPPER_A],
    );
    await db.query(
      `insert into public.shopper_credit_events
         (user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key)
       values ($1, 'use', 1, 'mc-miss-1', 'market_save', 'market_intel', 'use:market_save:mc-miss-1')`,
      [SHOPPER_A],
    );
    await db.query(
      `update public.shopper_credits
         set balance = 0, lifetime_used = 1
       where user_id = $1`,
      [SHOPPER_A],
    );
    const refunded = await db.query<{ refunded: boolean; balance: number }>(
      'select * from public.refund_unstored_market_save($1, $2)',
      [SHOPPER_A, 'mc-miss-1'],
    );
    assert.equal(refunded.rows[0]?.refunded, true);
    assert.equal(refunded.rows[0]?.balance, 1);
    assert.equal(await eventCount(db, SHOPPER_A, 'mc-miss-1'), 0);
    const trail = await db.query<{ event_type: string; idempotency_key: string }>(
      `select event_type, idempotency_key
         from public.shopper_credit_events
        where user_id = $1 and listing_id = 'mc-miss-1'
        order by event_type`,
      [SHOPPER_A],
    );
    assert.deepEqual(trail.rows.map((row) => row.event_type), ['refund', 'use']);
    assert.match(trail.rows[0]?.idempotency_key ?? '', /^refund:market_save:mc-miss-1:/);
    assert.match(trail.rows[1]?.idempotency_key ?? '', /^use:market_save:mc-miss-1:reversed:/);

    const chargedAgain = await db.query<{ charged: boolean; unlocked: boolean; balance: number }>(
      'select * from public.unlock_market_intel_atomic($1, $2, $3, $4::jsonb)',
      [SHOPPER_A, 'mc-miss-1', VIN, JSON.stringify(usedIntel())],
    );
    assert.equal(chargedAgain.rows[0]?.unlocked, true);
    assert.equal(chargedAgain.rows[0]?.charged, true);
    assert.equal(chargedAgain.rows[0]?.balance, 0);
    const kept = await db.query<{ refunded: boolean; balance: number }>(
      'select * from public.refund_unstored_market_save($1, $2)',
      [SHOPPER_A, 'mc-miss-1'],
    );
    assert.equal(kept.rows[0]?.refunded, false);
    assert.equal(kept.rows[0]?.balance, 0);
    assert.equal(await balance(db, SHOPPER_A), 0);
  } finally {
    await db.close();
  }
});

test('a refund keeps the spend row, and the lookup guard caps paid retries', async () => {
  assert.ok('20261120201000_market_save_lookup_guards.sql' > '20261120180000_shopper_market_unlocks.sql');
  assert.match(GUARD_SQL, /set search_path = ''/);
  assert.equal(GUARD_SQL.includes('delete from public.shopper_credit_events'), false);
  assert.match(GUARD_SQL, /refund:market_save:/);
  assert.match(GUARD_SQL, /claim_market_save_lookup/);
  assert.equal(GUARD_SQL.includes('set search_path = public'), false);

  const db = await boot();
  const ip = 'ab'.repeat(32);
  try {
    await seed(db, SHOPPER_A, 1);
    await db.query(
      `insert into public.shopper_credit_events
         (user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key)
       values ($1, 'use', 1, 'mc-hold-1', 'market_save', 'market_intel', 'use:market_save:mc-hold-1')`,
      [SHOPPER_A],
    );
    const held = await db.query<{ action: string; hold: boolean }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [SHOPPER_A, ip, 'mc-hold-1'],
    );
    assert.equal(held.rows[0]?.action, 'proceed');
    assert.equal(held.rows[0]?.hold, true);

    await db.query('select public.remember_market_listing_miss($1)', ['mc-miss-cache']);
    const missed = await db.query<{ action: string; hold: boolean }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [SHOPPER_A, 'cd'.repeat(32), 'mc-miss-cache'],
    );
    assert.equal(missed.rows[0]?.action, 'cached_miss');
    assert.equal(missed.rows[0]?.hold, false);

    for (let index = 0; index < 5; index += 1) {
      await db.query(
        `insert into public.shopper_credit_events
           (user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key)
         values ($1, 'refund', 1, $2, 'market_save', 'market_intel', $3)`,
        [SHOPPER_B, `mc-refund-${index}`, `refund:market_save:mc-refund-${index}:n${index}`],
      );
    }
    await seed(db, SHOPPER_B, 1);
    const capped = await db.query<{ action: string; hold: boolean }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [SHOPPER_B, 'ef'.repeat(32), 'mc-fresh-1'],
    );
    assert.equal(capped.rows[0]?.action, 'refund_cap');
    assert.equal(capped.rows[0]?.hold, false);

    const slotUser = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await seed(db, slotUser, 1);
    for (let index = 0; index < 5; index += 1) {
      const opened = await db.query<{ action: string }>(
        'select * from public.claim_market_save_lookup($1, $2, $3)',
        [slotUser, '22'.repeat(32), `mc-slot-${index}`],
      );
      assert.equal(opened.rows[0]?.action, 'proceed');
    }
    const reserved = await db.query<{ count: string }>(
      'select count(*)::text as count from public.shopper_market_refund_slots where user_id = $1',
      [slotUser],
    );
    assert.equal(reserved.rows[0]?.count, '5');
    const sixth = await db.query<{ action: string; hold: boolean }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [slotUser, '22'.repeat(32), 'mc-slot-next'],
    );
    assert.equal(sixth.rows[0]?.action, 'refund_cap');
    assert.equal(sixth.rows[0]?.hold, false);
    const stillFive = await db.query<{ count: string }>(
      'select count(*)::text as count from public.shopper_market_refund_slots where user_id = $1',
      [slotUser],
    );
    assert.equal(stillFive.rows[0]?.count, '5');
    const duplicate = await db.query<{ action: string }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [slotUser, '33'.repeat(32), 'mc-slot-0'],
    );
    assert.equal(duplicate.rows[0]?.action, 'rate_limited');

    await db.query(
      `insert into public.shopper_credit_events
         (user_id, event_type, amount, listing_id, spend_kind, key_kind, idempotency_key)
       values ($1, 'use', 1, 'mc-capped-hold', 'market_save', 'market_intel', 'use:market_save:mc-capped-hold')`,
      [SHOPPER_B],
    );
    const cappedHold = await db.query<{ action: string; hold: boolean }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [SHOPPER_B, '44'.repeat(32), 'mc-capped-hold'],
    );
    assert.equal(cappedHold.rows[0]?.action, 'refund_cap');
    assert.equal(cappedHold.rows[0]?.hold, true);
    const noSlot = await db.query<{ count: string }>(
      `select count(*)::text as count from public.shopper_market_refund_slots
       where user_id = $1 and listing_id = 'mc-capped-hold'`,
      [SHOPPER_B],
    );
    assert.equal(noSlot.rows[0]?.count, '0');

    await db.query('select public.remember_market_upstream_attempt($1, $2)', [SHOPPER_A, 'mc-burst']);
    const burst = await db.query<{ action: string; scope: string | null }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [SHOPPER_A, '55'.repeat(32), 'mc-burst'],
    );
    assert.equal(burst.rows[0]?.action, 'rate_limited');
    assert.equal(burst.rows[0]?.scope, 'user');
    const sharedMiss = await db.query<{ count: string }>(
      `select count(*)::text as count from public.market_intel_listing_misses where listing_id = 'mc-burst'`,
    );
    assert.equal(sharedMiss.rows[0]?.count, '0');
    const otherShopper = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await seed(db, otherShopper, 1);
    const notShared = await db.query<{ action: string }>(
      'select * from public.claim_market_save_lookup($1, $2, $3)',
      [otherShopper, '66'.repeat(32), 'mc-burst'],
    );
    assert.equal(notShared.rows[0]?.action, 'proceed');

    const rateUser = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await seed(db, rateUser, 1);
    const rateIp = '11'.repeat(32);
    let blocked = '';
    for (let index = 0; index < 12; index += 1) {
      const claim = await db.query<{ action: string; scope: string | null }>(
        'select * from public.claim_market_save_lookup($1, $2, $3)',
        [rateUser, rateIp, `mc-rate-${index}`],
      );
      blocked = claim.rows[0]?.action ?? '';
      if (blocked === 'proceed') {
        await db.query('select public.release_market_save_refund_slot($1, $2)', [rateUser, `mc-rate-${index}`]);
      }
      if (blocked === 'rate_limited') {
        assert.equal(claim.rows[0]?.scope, 'user');
        assert.equal(index, 10);
        break;
      }
    }
    assert.equal(blocked, 'rate_limited');

    const privileges = await db.query<{
      anon_claim: boolean;
      service_claim: boolean;
      anon_attempt: boolean;
      service_release: boolean;
    }>(`
      select
        has_function_privilege('anon', 'public.claim_market_save_lookup(uuid, text, text)', 'execute') as anon_claim,
        has_function_privilege('service_role', 'public.claim_market_save_lookup(uuid, text, text)', 'execute') as service_claim,
        has_function_privilege('anon', 'public.remember_market_upstream_attempt(uuid, text)', 'execute') as anon_attempt,
        has_function_privilege('service_role', 'public.release_market_save_refund_slot(uuid, text)', 'execute') as service_release
    `);
    assert.equal(privileges.rows[0]?.anon_claim, false);
    assert.equal(privileges.rows[0]?.service_claim, true);
    assert.equal(privileges.rows[0]?.anon_attempt, false);
    assert.equal(privileges.rows[0]?.service_release, true);
  } finally {
    await db.close();
  }
});

test('the unlock read is owner scoped and is not the heart save', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/listings/[id]/market-intel/route.ts'), 'utf8');
  const read = readFileSync(join(HERE, 'market-intel-read.ts'), 'utf8');
  const store = readFileSync(join(HERE, 'market-unlock-store.ts'), 'utf8');
  const heart = readFileSync(join(HERE, '../../app/api/consumer/saved-cars/route.ts'), 'utf8');
  assert.match(route, /handleMarketIntelGet/);
  assert.match(read, /requireShopperAuth/);
  assert.match(read, /findMarketUnlock/);
  assert.match(read, /isMissingMarketSchema/);
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
  reserve: (userId: string, listingId: string) => Promise<{ data: Array<Record<string, unknown>>; error: null }>;
  refund: (userId: string, listingId: string) => Promise<{ data: Array<Record<string, unknown>>; error: null }>;
  commitUnlock: (input: CommitMarketUnlockInput) => Promise<CommitMarketUnlockResult>;
};

function exclusiveLedger(opening: Map<string, number>): Ledger {
  const balances = new Map(opening);
  const rows = new Map<string, MarketIntel>();
  const events = new Set<string>();
  let chain = Promise.resolve();
  const serialized = <T>(work: () => Promise<T>): Promise<T> => {
    const run = chain.then(work);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
  return {
    balance: (userId) => balances.get(userId) ?? 0,
    read: async (userId, listingId) => rows.get(`${userId}:${listingId}`) ?? null,
    reserve: (userId, listingId) => serialized(async () => {
      const key = `${userId}:${listingId}`;
      const balance = balances.get(userId) ?? 0;
      if (events.has(key)) {
        return { data: [{ consumed: true, already_consumed: true, balance }], error: null };
      }
      if (balance < 1) {
        return { data: [{ consumed: false, already_consumed: false, balance }], error: null };
      }
      balances.set(userId, balance - 1);
      events.add(key);
      return { data: [{ consumed: true, already_consumed: false, balance: balance - 1 }], error: null };
    }),
    refund: (userId, listingId) => serialized(async () => {
      const key = `${userId}:${listingId}`;
      const balance = balances.get(userId) ?? 0;
      if (rows.has(key) || !events.has(key)) {
        return { data: [{ refunded: false, balance }], error: null };
      }
      events.delete(key);
      balances.set(userId, balance + 1);
      return { data: [{ refunded: true, balance: balance + 1 }], error: null };
    }),
    commitUnlock: (input) => serialized(async () => {
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
      const held = events.has(key);
      if (!held) {
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
        events.add(key);
      }
      rows.set(key, input.market);
      return {
        unlocked: true,
        alreadyUnlocked: held,
        charged: !held,
        balance: balances.get(input.userId) ?? 0,
        market: input.market,
      };
    }),
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
    rpc: async (fnName: string, params: { p_user_id?: string; p_listing_id?: string }) => {
      const userId = params.p_user_id ?? '';
      const listingId = params.p_listing_id ?? '';
      if (fnName === 'consume_market_save_atomic') return ledger.reserve(userId, listingId);
      if (fnName === 'refund_unstored_market_save') return ledger.refund(userId, listingId);
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
    lookupGuard: {
      claim: async () => ({ action: 'proceed' as const, scope: null, hold: false }),
      rememberMiss: async () => undefined,
      rememberUpstreamAttempt: async () => undefined,
      releaseRefundSlot: async () => undefined,
      noteRefund: async () => undefined,
    },
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
  await db.exec(GUARD_SQL);
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
