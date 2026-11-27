import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ShopperDealError } from './deals';
import { refundCredit, spendMarketSaveKey } from './credits';
import type { MarketIntel } from './market-intel';
import { MarketCheckUpstreamError } from '@/lib/marketcheck/mcp-client';
import { createMemoryMarketLookupGuard } from './market-lookup-guard';
import { fairPriceSpendEnabled } from '@/lib/marketcheck/price';
import { unlockMarketAndSave, type MarketSaveDeps } from './market-save';
import type { CommitMarketUnlockInput, StoredMarketUnlock } from './market-unlock-store';
import type { SavedCarRepository, SavedCarRow } from './saved-cars';

const HERE = dirname(fileURLToPath(import.meta.url));
const previousSpend = process.env.FAIR_PRICE_SPEND_ENABLED;

before(() => {
  process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
});

after(() => {
  if (previousSpend === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
  else process.env.FAIR_PRICE_SPEND_ENABLED = previousSpend;
});

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
  const openSpends = new Map<string, string>();
  const client = {
    rpc: async (fnName: string, params: { p_listing_id?: string; p_deal_id?: string; p_idempotency_key?: string }) => {
      if (fnName === 'consume_market_save_atomic') {
        const listingId = params.p_listing_id ?? '';
        if (openSpends.has(listingId)) {
          return { data: [{ consumed: true, already_consumed: true, balance: row.balance }], error: null };
        }
        if (row.balance <= 0) {
          return { data: [{ consumed: false, already_consumed: false, balance: row.balance }], error: null };
        }
        const base = `use:market_save:${listingId}`;
        const spendKey = keys.has(base) ? `${base}:after:${keys.size}` : base;
        keys.add(spendKey);
        openSpends.set(listingId, spendKey);
        row.balance -= 1;
        row.lifetime_used += 1;
        return { data: [{ consumed: true, already_consumed: false, balance: row.balance }], error: null };
      }
      if (fnName === 'refund_unstored_market_save') {
        const listingId = params.p_listing_id ?? '';
        const spendKey = openSpends.get(listingId);
        const refundKey = spendKey ? `refund:${spendKey}` : '';
        if (!spendKey || keys.has(refundKey)) {
          return { data: [{ refunded: false, balance: row.balance }], error: null };
        }
        keys.add(refundKey);
        openSpends.delete(listingId);
        row.balance += 1;
        row.lifetime_used = Math.max(0, row.lifetime_used - 1);
        row.lifetime_refunded += 1;
        return { data: [{ refunded: true, balance: row.balance }], error: null };
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

test('a shopper with no keys does not call MarketCheck', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(0);
  const deps = scriptedUnlock(supabase, repo);
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return usedIntel();
  };

  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'no_credits',
  );
  assert.equal(loads, 0);
  assert.equal(repo.rows.length, 0);
});

test('a missing fair price is not cached, so the refunded key can retry', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const deps = scriptedUnlock(supabase, repo);
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return {
      intel: null,
      listingFound: true,
      returnedListingId: 'mc-listing-1',
      cacheableMiss: false,
    };
  };

  const first = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  const second = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(first.unlocked, false);
  assert.equal(first.spent, false);
  assert.equal(first.credits.balance, 1);
  assert.equal(second.unlocked, false);
  assert.equal(second.credits.balance, 1);
  assert.equal(loads, 2);
  assert.equal(repo.rows.length, 0);
});

test('a failed lookup returns the key and the retry spends it', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const deps = scriptedUnlock(supabase, repo);
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    throw new Error('marketcheck upstream failed');
  };

  const failed = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(loads, 1);
  assert.equal(failed.spent, false);
  assert.equal(failed.unlocked, false);
  assert.equal(failed.available, false);
  assert.equal(failed.credits.balance, 1);
  assert.equal(failed.car, null);
  assert.equal(repo.rows.length, 0);

  deps.loadMarketIntel = async () => {
    loads += 1;
    return usedIntel();
  };
  const retry = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(retry.spent, true);
  assert.equal(retry.unlocked, true);
  assert.equal(retry.credits.balance, 0);
  assert.equal(retry.market?.fairVehiclePrice, 30100);
  assert.equal(loads, 2);
  assert.equal(repo.rows.length, 1);
});

test('a failed unlock write returns the key so the retry can spend it', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const deps = scriptedUnlock(supabase, repo);
  deps.commitUnlock = async () => {
    throw new Error('unlock write failed');
  };

  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps),
    (error: unknown) => error instanceof Error && error.message === 'unlock write failed',
  );
  assert.equal(repo.rows.length, 0);

  deps.commitUnlock = scriptedUnlock(supabase, repo).commitUnlock;
  const retry = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(retry.spent, true);
  assert.equal(retry.unlocked, true);
  assert.equal(retry.credits.balance, 0);
  assert.equal(repo.rows.length, 1);
});

test('market save still saves the car when the unlock schema is missing', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(2);
  const deps = scriptedUnlock(supabase, repo);
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return usedIntel();
  };
  deps.findUnlock = async () => {
    throw Object.assign(
      new Error("Could not find the table 'public.shopper_market_unlocks' in the schema cache"),
      { code: 'PGRST205' },
    );
  };

  const saved = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1', vin: '1GNSKCKD5RR123456' }, deps);
  assert.equal(loads, 0);
  assert.equal(saved.spent, false);
  assert.equal(saved.unlocked, false);
  assert.equal(saved.available, false);
  assert.equal(saved.reason, 'market_unavailable');
  assert.equal(saved.market, null);
  assert.equal(saved.car?.listingId, 'mc-listing-1');
  assert.equal(saved.credits.balance, 2);
  assert.equal(repo.rows.length, 1);
});

test('five refunded lookups block the next paid call and a miss is not fetched again', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const deps = scriptedUnlock(supabase, repo);
  const guard = createMemoryMarketLookupGuard();
  deps.lookupGuard = guard;
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return null;
  };

  for (let index = 0; index < 5; index += 1) {
    const missed = await unlockMarketAndSave('shopper-1', { listingId: `mc-miss-${index}` }, deps);
    assert.equal(missed.spent, false);
    assert.equal(missed.credits.balance, 1);
    assert.equal(missed.car, null);
  }
  assert.equal(loads, 5);
  assert.equal(repo.rows.length, 0);

  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-miss-5' }, deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'market_lookup_limited',
  );
  assert.equal(loads, 5);

  const cached = createMemoryMarketLookupGuard();
  const cachedDeps = scriptedUnlock(memoryKeys(1), repo);
  cachedDeps.lookupGuard = cached;
  let cachedLoads = 0;
  cachedDeps.loadMarketIntel = async () => {
    cachedLoads += 1;
    return { intel: null, listingFound: true, returnedListingId: 'mc-listing-9' };
  };
  await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-9' }, cachedDeps);
  await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-9' }, cachedDeps);
  assert.equal(cachedLoads, 1);
});

test('a closed limiter and a per-user rate limit do not call MarketCheck', async () => {
  const repo = memoryRepo();
  const blocked = scriptedUnlock(memoryKeys(1), repo);
  blocked.failClosed = true;
  delete blocked.lookupGuard;
  let loads = 0;
  blocked.loadMarketIntel = async () => {
    loads += 1;
    return usedIntel();
  };
  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, blocked),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'service_unavailable',
  );
  assert.equal(loads, 0);
  assert.equal(repo.rows.length, 0);

  const limited = scriptedUnlock(memoryKeys(1), repo);
  limited.lookupGuard = {
    claim: async () => ({ action: 'rate_limited', scope: 'user', hold: false }),
    rememberMiss: async () => undefined,
    rememberUpstreamAttempt: async () => undefined,
    releaseRefundSlot: async () => undefined,
    noteRefund: async () => undefined,
  };
  limited.loadMarketIntel = async () => {
    loads += 1;
    return usedIntel();
  };
  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, limited),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'rate_limited',
  );
  assert.equal(loads, 0);
});

test('a failed refund is finished by the next commit without a second charge', async () => {
  const repo = memoryRepo();
  const supabase = memoryKeys(1);
  const deps = scriptedUnlock(supabase, repo);
  deps.unlockWaitAttempts = 1;
  deps.unlockWaitMs = 0;
  deps.lookupGuard = {
    claim: async () => ({ action: 'proceed', scope: null, hold: true }),
    rememberMiss: async () => undefined,
    rememberUpstreamAttempt: async () => undefined,
    releaseRefundSlot: async () => undefined,
    noteRefund: async () => undefined,
  };
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    if (loads === 1) throw new Error('marketcheck upstream failed');
    return usedIntel();
  };
  deps.refundKey = async () => ({ refunded: false, balance: 0 });

  const failed = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(failed.unlocked, false);
  assert.equal(failed.spent, false);
  assert.equal(failed.car, null);
  assert.equal(failed.message, "We couldn't load this yet. We're fixing it.");
  assert.equal(failed.held, false);
  assert.equal(failed.refunded, false);
  assert.equal(loads, 1);
  assert.equal(repo.rows.length, 0);

  const recovered = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(recovered.unlocked, true);
  assert.equal(recovered.spent, false);
  assert.equal(recovered.credits.balance, 0);
  assert.equal(recovered.market?.fairVehiclePrice, 30100);
  assert.equal(loads, 2);
  assert.equal(repo.rows.length, 1);
});

test('a MarketCheck timeout does not create a shared miss', async () => {
  const repo = memoryRepo();
  const guard = createMemoryMarketLookupGuard();
  const deps = scriptedUnlock(memoryKeys(1), repo);
  deps.lookupGuard = guard;
  let loads = 0;
  let misses = 0;
  const originalRemember = guard.rememberMiss.bind(guard);
  guard.rememberMiss = async (listingId, now) => {
    misses += 1;
    await originalRemember(listingId, now);
  };
  deps.loadMarketIntel = async () => {
    loads += 1;
    throw new MarketCheckUpstreamError('MarketCheck listing lookup timed out');
  };

  const failed = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(failed.spent, false);
  assert.equal(failed.credits.balance, 1);
  assert.equal(misses, 0);
  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'rate_limited',
  );
  assert.equal(loads, 1);

  const other = scriptedUnlock(memoryKeys(1), memoryRepo());
  other.lookupGuard = guard;
  let otherLoads = 0;
  other.loadMarketIntel = async () => {
    otherLoads += 1;
    return { intel: null, listingFound: true, returnedListingId: 'mc-listing-1' };
  };
  const shared = await unlockMarketAndSave('shopper-2', { listingId: 'mc-listing-1' }, other);
  assert.equal(shared.reason, 'market_unavailable');
  assert.equal(otherLoads, 1);
  assert.equal(misses, 1);
});

test('a client VIN cannot cache a miss for the listing', async () => {
  const repo = memoryRepo();
  const guard = createMemoryMarketLookupGuard();
  const deps = scriptedUnlock(memoryKeys(2), repo);
  deps.lookupGuard = guard;
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return { intel: null, listingFound: true, returnedListingId: 'mc-listing-1' };
  };

  const poisoned = await unlockMarketAndSave('shopper-1', {
    listingId: 'mc-listing-1',
    vin: '1GNSKCKD5RR123456',
  }, deps);
  assert.equal(poisoned.spent, false);
  assert.equal(poisoned.credits.balance, 2);
  const again = await unlockMarketAndSave('shopper-2', { listingId: 'mc-listing-1' }, deps);
  assert.equal(again.spent, false);
  assert.equal(loads, 2);
});

test('a refund cap with a held key does not call MarketCheck', async () => {
  const repo = memoryRepo();
  const deps = scriptedUnlock(memoryKeys(1), repo);
  let loads = 0;
  let refunds = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return usedIntel();
  };
  deps.lookupGuard = {
    claim: async () => ({ action: 'refund_cap', scope: null, hold: true }),
    rememberMiss: async () => undefined,
    rememberUpstreamAttempt: async () => undefined,
    releaseRefundSlot: async () => undefined,
    noteRefund: async () => undefined,
  };
  deps.refundKey = async () => {
    refunds += 1;
    return { refunded: true, balance: 1 };
  };

  await assert.rejects(
    () => unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'market_lookup_limited',
  );
  assert.equal(loads, 0);
  assert.equal(refunds, 1);
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
  assert.match(route, /failClosed/);
  assert.match(route, /ipHash/);
  assert.match(route, /refunded/);
  assert.match(route, /unlockState/);
});

test('spend stays off before a key is held', async () => {
  delete process.env.FAIR_PRICE_SPEND_ENABLED;
  try {
    let reserves = 0;
    const deps = scriptedUnlock(memoryKeys(2), memoryRepo());
    deps.reserveKey = async () => {
      reserves += 1;
      return { ok: true, already: false, failed: false, balance: 2 };
    };
    const saved = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
    assert.equal(reserves, 0);
    assert.equal(saved.refunded, false);
    assert.equal(saved.unlockState, 'unavailable');
    assert.equal(saved.message, 'This is off right now.');
    assert.equal(fairPriceSpendEnabled(), false);
  } finally {
    process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
  }
});

test('the stored VIN is the card VIN, not the one the shopper sent', async () => {
  const deps = scriptedUnlock(memoryKeys(1), memoryRepo());
  let stored: string | null = 'unset';
  const commit = deps.commitUnlock!;
  deps.commitUnlock = async (input) => {
    stored = input.vin;
    return commit(input);
  };
  deps.loadMarketIntel = async () => ({
    ...usedIntel(),
    v1: {
      version: 'v1',
      listingId: 'mc-listing-1',
      condition: 'used',
      vin: '1c4hjxdg5lw123456',
      lines: [],
    } as unknown as MarketIntel['v1'],
  });
  await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1', vin: '1GNSKCKD5RR123456' }, deps);
  assert.equal(stored, '1C4HJXDG5LW123456');
});

test('a rate limit with a held key finishes the refund instead of returning 429', async () => {
  const deps = scriptedUnlock(memoryKeys(1), memoryRepo());
  let refunds = 0;
  deps.lookupGuard = {
    claim: async () => ({ action: 'rate_limited', scope: 'user', hold: true }),
    rememberMiss: async () => undefined,
    rememberUpstreamAttempt: async () => undefined,
    releaseRefundSlot: async () => undefined,
    noteRefund: async () => undefined,
  };
  deps.refundKey = async () => {
    refunds += 1;
    return { refunded: true, balance: 1 };
  };
  const saved = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(refunds, 1);
  assert.equal(saved.refunded, true);
  assert.equal(saved.held, false);
  assert.equal(saved.message, "We couldn't load this. Your key is back.");
});

test('a definitive empty quote is remembered for this shopper only', async () => {
  const deps = scriptedUnlock(memoryKeys(2), memoryRepo());
  deps.lookupGuard = createMemoryMarketLookupGuard();
  let loads = 0;
  deps.loadMarketIntel = async () => {
    loads += 1;
    return {
      intel: null,
      listingFound: true,
      returnedListingId: 'mc-listing-1',
      cacheableMiss: true,
      shopperMiss: true,
    };
  };
  const first = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(first.refunded, true);
  const second = await unlockMarketAndSave('shopper-1', { listingId: 'mc-listing-1' }, deps);
  assert.equal(loads, 1);
  assert.equal(second.refunded, false);
  assert.equal(second.message, 'This is off right now.');
  const other = await unlockMarketAndSave('shopper-2', { listingId: 'mc-listing-1' }, deps);
  assert.equal(loads, 2);
  assert.equal(other.refunded, true);
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
    lookupGuard: createMemoryMarketLookupGuard(),
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
