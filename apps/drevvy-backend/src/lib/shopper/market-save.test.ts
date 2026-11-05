import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ShopperDealError } from './deals';
import { refundCredit, spendMarketSaveKey } from './credits';
import type { MarketIntel } from './market-intel';
import { unlockMarketAndSave, type MarketSaveDeps } from './market-save';
import type { CommitMarketUnlockInput, StoredMarketUnlock } from './market-unlock-store';
import type { SavedCarRepository, SavedCarRow } from './saved-cars';

const HERE = dirname(fileURLToPath(import.meta.url));

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

function memoryKeys(balance: number): SupabaseClient {
  const row = { balance, lifetime_purchased: balance, lifetime_used: 0, lifetime_refunded: 0 };
  const keys = new Set<string>();
  const client = {
    rpc: async (fnName: string, params: { p_listing_id?: string; p_deal_id?: string; p_idempotency_key?: string }) => {
      if (fnName === 'consume_market_save_atomic') {
        const key = `use:market_save:${params.p_listing_id ?? ''}`;
        if (keys.has(key)) {
          return { data: [{ consumed: true, already_consumed: true, balance: row.balance }], error: null };
        }
        if (row.balance <= 0) {
          return { data: [{ consumed: false, already_consumed: false, balance: row.balance }], error: null };
        }
        keys.add(key);
        row.balance -= 1;
        row.lifetime_used += 1;
        return { data: [{ consumed: true, already_consumed: false, balance: row.balance }], error: null };
      }
      if (fnName === 'refund_credit_atomic') {
        const refundKey = params.p_idempotency_key ?? '';
        if (keys.has(refundKey)) {
          return { data: [{ refunded: false, already_refunded: true, new_balance: row.balance }], error: null };
        }
        const dealer = `use:dealer_conversation:${params.p_deal_id ?? ''}`;
        if (!keys.has(dealer)) {
          return { data: [{ refunded: false, already_refunded: false, new_balance: row.balance }], error: null };
        }
        keys.add(refundKey);
        row.balance += 1;
        row.lifetime_refunded += 1;
        return { data: [{ refunded: true, already_refunded: false, new_balance: row.balance }], error: null };
      }
      return { data: null, error: { message: 'unknown rpc' } };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { ...row, user_id: 'shopper-1' }, error: null }),
        }),
      }),
    }),
  };
  return client as unknown as SupabaseClient;
}

test('unlocking market details and saving spends one key and does not refund it', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const deps = scriptedUnlock(supabase, repo);
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return usedIntel();
  };

  const first = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1', vin: '1GNSKCKD5RR123456' }, deps);
  assert.equal(first.spent, true);
  assert.equal(first.available, true);
  assert.equal(first.unlocked, true);
  assert.equal(first.market?.fairVehiclePrice, 30100);
  assert.equal(first.credits.balance, 0);
  assert.equal(repo.rows.length, 1);

  const again = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(again.spent, false);
  assert.equal(again.unlocked, true);
  assert.equal(again.market?.fairVehiclePrice, 30100);
  assert.equal(again.credits.balance, 0);
  assert.equal(repo.rows.length, 1);
  assert.equal(loads, 1);

  const refund = await refundCredit(supabase, 'shopper-1', '22222222-2222-4222-8222-222222222222', 'sold');
  assert.equal(refund.refunded, false);
  assert.equal(refund.newBalance, 0);

  const empty = memoryRepo();
  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-2' }, { ...deps, repo: empty, supabase }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'no_credits',
  );
  assert.equal(empty.rows.length, 0);
});

test('a market save does not spend a key when the deal belongs to someone else', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const dealId = '11111111-1111-4111-8111-111111111111';
  const deps = scriptedUnlock(supabase, repo);
  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1', movedToDealId: dealId }, deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'not_found',
  );
  assert.equal(repo.rows.length, 0);

  const saved = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(saved.spent, true);
  assert.equal(saved.credits.balance, 0);
});

test('an empty market lookup does not spend a key or save the car', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(2);
  const deps = scriptedUnlock(supabase, repo);
  let commits = 0;
  deps.loadMarketIntel = async () => null;
  const original = deps.commitUnlock;
  deps.commitUnlock = async (input) => {
    commits += 1;
    return original(input);
  };

  const missed = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(missed.available, false);
  assert.equal(missed.unlocked, false);
  assert.equal(missed.spent, false);
  assert.equal(missed.reason, 'market_unavailable');
  assert.equal(missed.market, null);
  assert.equal(missed.car, null);
  assert.equal(missed.credits.balance, 2);
  assert.equal(commits, 0);
  assert.equal(repo.rows.length, 0);

  deps.loadMarketIntel = async () => {
    throw new Error('marketcheck upstream failed');
  };
  const failed = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(failed.available, false);
  assert.equal(failed.spent, false);
  assert.equal(failed.credits.balance, 2);
  assert.equal(commits, 0);
  assert.equal(repo.rows.length, 0);
});

test('the market-save route spends a key and a heart save does not', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/keys/market-save/route.ts'), 'utf8');
  const heart = readFileSync(join(HERE, '../../app/api/consumer/saved-cars/route.ts'), 'utf8');
  assert.match(route, /requireShopperAuth/);
  assert.match(route, /unlockMarketAndSave/);
  assert.equal(route.includes('consumeCredit'), false);
  assert.equal(/negotiat/i.test(route), false);
  assert.equal(heart.includes('unlockMarketAndSave'), false);
  assert.equal(heart.includes('spendMarketSaveKey'), false);
  assert.equal(heart.includes('shopper_market_unlocks'), false);
  assert.match(route, /available/);
  assert.match(route, /market/);
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

function scriptedUnlock(
  supabase: SupabaseClient,
  repo: SavedCarRepository,
): MarketSaveDeps & {
  loadMarketIntel: NonNullable<MarketSaveDeps['loadMarketIntel']>;
  commitUnlock: NonNullable<MarketSaveDeps['commitUnlock']>;
} {
  const rows = new Map<string, StoredMarketUnlock>();
  return {
    repo,
    ownsDeal: async () => false,
    lookup: async () => null,
    now: new Date('2026-10-26T12:00:00.000Z'),
    supabase,
    profileZip: async () => null,
    loadMarketIntel: async () => usedIntel(),
    findUnlock: async (userId, listingId) => rows.get(`${userId}:${listingId}`) ?? null,
    commitUnlock: async (input: CommitMarketUnlockInput) => {
      const key = `${input.userId}:${input.listingId}`;
      const existing = rows.get(key);
      if (existing) {
        return {
          unlocked: true,
          alreadyUnlocked: true,
          charged: false,
          balance: 0,
          market: existing.market,
        };
      }
      const spent = await spendMarketSaveKey(supabase, input.userId, input.listingId);
      if (!spent.success) {
        return {
          unlocked: false,
          alreadyUnlocked: false,
          charged: false,
          balance: spent.newBalance,
          market: null,
          error: spent.error ?? 'no_credits',
        };
      }
      rows.set(key, {
        listingId: input.listingId,
        vin: input.vin,
        unlockedAt: '2026-10-26T12:00:00.000Z',
        market: input.market,
      });
      return {
        unlocked: true,
        alreadyUnlocked: spent.alreadyConsumed,
        charged: !spent.alreadyConsumed,
        balance: spent.newBalance,
        market: input.market,
      };
    },
  };
}
