import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { OnboardedRooftop } from '@/lib/dealer/rooftop-match';
import { resolveRooftopMatch, type RooftopDirectory } from '@/lib/dealer/rooftop-store';
import {
  LISTING_IDENTITY_NEGATIVE_TTL_MS,
  LISTING_IDENTITY_POSITIVE_TTL_MS,
  listingIdentityCacheSnapshotForTests,
} from '@/lib/dealer/listing-rooftop-cache';
import { MemoryRateLimitStore } from '@/lib/public-discover/rate-limit';

import { startDealerConversation } from './conversation';
import type { DealDeps } from './deal-actions';
import { ShopperDealError, type ShopperDealRepository, type ShopperDealRow } from './deals';
import { createMemoryLifecycleRepository } from './lifecycle-store';
import {
  DEAL_POST_USER_PER_DAY,
  DEAL_POST_USER_PER_MINUTE,
  dealPostLimitWindows,
} from './off-network-lookup-limit';
import { suggestDealChips } from './chips';
import { SHOPPER_MESSAGE_DAY_COPY, SHOPPER_MESSAGE_MINUTE_COPY, SHOPPER_READ_PER_MINUTE } from './thread-rate-limit';

const HONDA: OnboardedRooftop = {
  id: 'roof-honda',
  name: 'Honda Cars Of Rock Hill',
  marketcheckDealerId: '1038994',
  websiteUrl: 'https://www.hondacarsofcrockhill.com',
};

const VEHICLE = { year: 2024, make: 'Honda', model: 'CR-V', price: 32900 };
const NOW = Date.parse('2026-11-22T15:00:00.000Z');
const HERE = dirname(fileURLToPath(import.meta.url));

function memoryDeals(seed: ShopperDealRow[] = []): ShopperDealRepository & { rows: ShopperDealRow[] } {
  const rows = [...seed];
  return {
    rows,
    async findOpen(consumerUserId, listingId) {
      return rows.find((row) =>
        row.consumerUserId === consumerUserId
        && row.listingId === listingId
        && (row.status === 'interested' || row.status === 'negotiating'),
      ) ?? null;
    },
    async insert(deal) {
      rows.push({
        id: 'deal-new',
        consumerUserId: deal.consumerUserId,
        listingId: deal.listingId,
        status: 'interested',
        outreachLockedUntilPaid: true,
        vehicle: deal.vehicle,
        createdAt: '2026-11-22T15:00:00.000Z',
        updatedAt: '2026-11-22T15:00:00.000Z',
      });
      return rows[rows.length - 1]!;
    },
    async list() { return rows; },
    async get(consumerUserId, dealId) {
      return rows.find((row) => row.consumerUserId === consumerUserId && row.id === dealId) ?? null;
    },
    async close() { return null; },
    async discard() { return undefined; },
  };
}

function credits(
  balance: number,
  conversation: Record<string, unknown> | null = null,
  options: {
    charge?: 'ok' | 'no_credits' | 'already_charged';
    charged?: boolean;
    conversationWrite?: 'ok' | 'fail';
  } | 'ok' | 'no_credits' = {},
) {
  const charge = typeof options === 'string' ? options : (options.charge ?? 'ok');
  const charged = typeof options === 'string' ? false : options.charged === true;
  const conversationWrite = typeof options === 'string' ? 'ok' : (options.conversationWrite ?? 'ok');
  let spends = 0;
  let newKeys = 0;
  let writes = 0;
  let refunds = 0;
  return {
    spends: () => spends,
    newKeys: () => newKeys,
    writes: () => writes,
    refunds: () => refunds,
    from(table: string) {
      if (table === 'consumer_profiles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Dana Blake' }, error: null }) }),
          }),
        };
      }
      if (table === 'shopper_dealer_conversations') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: conversation, error: null }) }),
          }),
          upsert: async () => {
            writes += 1;
            if (conversationWrite === 'fail') return { error: { message: 'connection reset' } };
            return { error: null };
          },
        };
      }
      if (table === 'shopper_credit_events') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    limit: async () => ({
                      data: charged ? [{ id: 'use-event' }] : [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'drevvy_vdp_matches') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                user_id: 'shopper-1',
                balance,
                lifetime_purchased: balance,
                lifetime_used: 0,
                lifetime_refunded: 0,
              },
              error: null,
            }),
          }),
        }),
      };
    },
    rpc: async (fnName?: string) => {
      if (fnName === 'refund_credit_atomic') {
        refunds += 1;
        return {
          data: [{ refunded: false, already_refunded: false, new_balance: balance }],
          error: null,
        };
      }
      spends += 1;
      if (charge === 'already_charged') {
        return {
          data: [{
            consumed: true,
            already_consumed: true,
            balance: 0,
            lifetime_purchased: balance,
            lifetime_used: 1,
            lifetime_refunded: 0,
          }],
          error: null,
        };
      }
      const consumed = charge === 'ok';
      if (consumed) newKeys += 1;
      return {
        data: [{
          consumed,
          already_consumed: false,
          balance: consumed ? balance : 0,
          lifetime_purchased: balance,
          lifetime_used: consumed ? 1 : 0,
          lifetime_refunded: 0,
        }],
        error: null,
      };
    },
  };
}

function directory(
  onLookup: () => Promise<{ status: 'found'; identity: Record<string, unknown> } | { status: 'unavailable'; reason: 'not_found' | 'error' }>,
  rooftops: OnboardedRooftop[] = [HONDA],
): RooftopDirectory & { fetches: () => number } {
  let fetches = 0;
  return {
    fetches: () => fetches,
    listOnboardedRooftops: async () => rooftops,
    lookupListingIdentity: async () => {
      fetches += 1;
      return onLookup() as unknown as Awaited<ReturnType<NonNullable<RooftopDirectory['lookupListingIdentity']>>>;
    },
  };
}

function deps(
  rooftops: RooftopDirectory,
  store: MemoryRateLimitStore,
  balance: number,
  deals = memoryDeals(),
  conversation: Record<string, unknown> | null = null,
  nowMs = NOW,
  charge: Parameters<typeof credits>[2] = 'ok',
): DealDeps & {
  rooftops: RooftopDirectory;
  rateLimitStore: MemoryRateLimitStore;
  deals: ReturnType<typeof memoryDeals>;
  book: ReturnType<typeof credits>;
} {
  const book = credits(balance, conversation, charge);
  return {
    deals,
    lifecycle: createMemoryLifecycleRepository(),
    now: new Date(nowMs),
    live: false,
    supabase: book as unknown as SupabaseClient,
    rooftops,
    rateLimitStore: store,
    book,
  };
}

const OFF_IDENTITY = {
  listingId: 'mc-off-1',
  marketcheckDealerId: '999000',
  dealerWebsite: 'https://far-away.example',
  vin: '1HGCM82633A004352',
  price: 32000,
};

test('the deal route pays for an uncached listing lookup, not getVehicleDetailMcp or search', () => {
  const store = readFileSync(join(HERE, '../dealer/rooftop-store.ts'), 'utf8');
  const route = readFileSync(join(HERE, '../../app/api/consumer/deals/route.ts'), 'utf8');
  const listing = readFileSync(join(HERE, '../marketcheck/listing-car.ts'), 'utf8');
  const conversation = readFileSync(join(HERE, 'conversation.ts'), 'utf8');
  assert.equal(route.includes('getVehicleDetailMcp'), false);
  assert.equal(store.includes('getVehicleDetailMcp'), false);
  assert.equal(conversation.includes('getVehicleDetailMcp'), false);
  assert.equal(conversation.includes('openDealMatch'), false);
  assert.match(store, /lookupListingIdentity: \(listingId\) => lookupListingDealerIdentity\(listingId\)/);
  assert.match(store, /fetchMarketCheckListing\(listingId\)/);
  assert.match(listing, /\/v2\/listing\/car\//);
  assert.match(listing, /cache: 'no-store'/);
  assert.match(listing, /The response is not cached/);
  assert.equal(DEAL_POST_USER_PER_MINUTE, 10);
  assert.equal(DEAL_POST_USER_PER_DAY, 60);
  assert.equal(LISTING_IDENTITY_POSITIVE_TTL_MS, 15 * 60 * 1000);
  assert.equal(LISTING_IDENTITY_NEGATIVE_TTL_MS, 6 * 60 * 60 * 1000);
  for (const window of dealPostLimitWindows('shopper-a')) {
    assert.equal(window.bucket.length >= 8 && window.bucket.length <= 180, true);
  }
});

test('a zero-key shopper and an open deal do not fetch a listing', async () => {
  const store = new MemoryRateLimitStore();
  const lookups = directory(async () => {
    throw new Error('MarketCheck should not be called');
  });
  const broke = deps(lookups, store, 0);
  await assert.rejects(
    () => startDealerConversation('shopper-zero', {
      listingId: 'mc-zero-key',
      vehicle: VEHICLE,
    }, { ...broke, now: new Date(NOW) }),
    (error: unknown) => error instanceof ShopperDealError && error.status === 402 && error.code === 'no_credits',
  );
  assert.equal(lookups.fetches(), 0);
  assert.equal(broke.deals.rows.length, 0);

  const openId = '66666666-6666-4666-8666-666666666666';
  const openDeals = memoryDeals([{
    id: openId,
    consumerUserId: 'shopper-open',
    listingId: 'mc-already-open',
    status: 'interested',
    outreachLockedUntilPaid: true,
    vehicle: VEHICLE,
    createdAt: '2026-11-22T15:00:00.000Z',
    updatedAt: '2026-11-22T15:00:00.000Z',
  }]);
  const again = deps(lookups, store, 0, openDeals, {
    rooftop_id: HONDA.id,
    match_method: 'marketcheck_dealer_id',
    opener: 'Dana wants your best itemized out-the-door',
  });
  const reused = await startDealerConversation('shopper-open', {
    listingId: 'mc-already-open',
    vehicle: VEHICLE,
  }, again);
  assert.equal(lookups.fetches(), 0);
  assert.equal(reused.deal.id, openId);
  assert.equal(reused.match.network, 'in_network');
  assert.equal(reused.match.rooftop.id, HONDA.id);
  assert.equal(reused.match.method, 'marketcheck_dealer_id');
  assert.equal(again.book.spends(), 1);
  assert.equal(openDeals.rows.length, 1);

  const reuseStore = new MemoryRateLimitStore();
  const reuseLookups = directory(async () => {
    throw new Error('MarketCheck should not be called');
  });
  const reuseDeals = memoryDeals([{
    id: openId,
    consumerUserId: 'shopper-reuse-cap',
    listingId: 'mc-reuse-cap',
    status: 'interested',
    outreachLockedUntilPaid: true,
    vehicle: VEHICLE,
    createdAt: '2026-11-22T15:00:00.000Z',
    updatedAt: '2026-11-22T15:00:00.000Z',
  }]);
  const reuseBox = deps(reuseLookups, reuseStore, 0, reuseDeals, {
    rooftop_id: HONDA.id,
    match_method: 'marketcheck_dealer_id',
    opener: 'Dana wants your best itemized out-the-door',
  });
  for (let i = 0; i < DEAL_POST_USER_PER_MINUTE; i += 1) {
    const againOpen = await startDealerConversation('shopper-reuse-cap', {
      listingId: 'mc-reuse-cap',
      vehicle: VEHICLE,
    }, { ...reuseBox, now: new Date(NOW) });
    assert.equal(againOpen.deal.id, openId);
  }
  await assert.rejects(
    () => startDealerConversation('shopper-reuse-cap', {
      listingId: 'mc-reuse-cap',
      vehicle: VEHICLE,
    }, { ...reuseBox, now: new Date(NOW) }),
    (error: unknown) => error instanceof ShopperDealError && error.status === 429,
  );
  assert.equal(reuseLookups.fetches(), 0);
  assert.equal(reuseBox.book.spends(), DEAL_POST_USER_PER_MINUTE);
});

test('an open deal with no conversation row does not spend a key when the listing is off network', async () => {
  const store = new MemoryRateLimitStore();
  const lookups = directory(async () => ({
    status: 'found',
    identity: { listingId: 'mc-open-no-row', marketcheckDealerId: '999000', dealerWebsite: 'https://far-away.example' },
  }));
  const openId = '77777777-7777-4777-8777-777777777777';
  const deals = memoryDeals([{
    id: openId,
    consumerUserId: 'shopper-no-row',
    listingId: 'mc-open-no-row',
    status: 'interested',
    outreachLockedUntilPaid: true,
    vehicle: VEHICLE,
    createdAt: '2026-11-22T15:00:00.000Z',
    updatedAt: '2026-11-22T15:00:00.000Z',
  }]);
  const box = deps(lookups, store, 2, deals, null);
  await assert.rejects(
    () => startDealerConversation('shopper-no-row', {
      listingId: 'mc-open-no-row',
      vehicle: VEHICLE,
    }, box),
    (error: unknown) => error instanceof ShopperDealError && error.status === 409 && error.code === 'off_network',
  );
  assert.equal(lookups.fetches(), 1);
  assert.equal(box.book.spends(), 0);
  assert.equal(deals.rows.length, 1);
  assert.equal(deals.rows[0]?.id, openId);
});

test('a failed charge does not leave a conversation row on an open deal', async () => {
  const store = new MemoryRateLimitStore();
  const lookups = directory(async () => ({
    status: 'found',
    identity: { listingId: 'mc-charge-fail', marketcheckDealerId: HONDA.marketcheckDealerId },
  }));
  const openId = '88888888-8888-4888-8888-888888888888';
  const deals = memoryDeals([{
    id: openId,
    consumerUserId: 'shopper-charge-fail',
    listingId: 'mc-charge-fail',
    status: 'interested',
    outreachLockedUntilPaid: true,
    vehicle: VEHICLE,
    createdAt: '2026-11-22T15:00:00.000Z',
    updatedAt: '2026-11-22T15:00:00.000Z',
  }]);
  const box = deps(lookups, store, 1, deals, null, NOW, 'no_credits');
  await assert.rejects(
    () => startDealerConversation('shopper-charge-fail', {
      listingId: 'mc-charge-fail',
      vehicle: VEHICLE,
    }, box),
    (error: unknown) => error instanceof ShopperDealError && error.status === 402 && error.code === 'no_credits',
  );
  assert.equal(box.book.writes(), 0);
  assert.equal(box.book.spends(), 1);
  assert.equal(deals.rows.length, 1);
});

test('a conversation write that fails after the charge is not a successful start', async () => {
  const store = new MemoryRateLimitStore();
  const identity = {
    status: 'found' as const,
    identity: { listingId: 'mc-write-fail', marketcheckDealerId: HONDA.marketcheckDealerId },
  };
  const openId = '99999999-9999-4999-8999-999999999999';
  const reusedDeals = memoryDeals([{
    id: openId,
    consumerUserId: 'shopper-write-fail',
    listingId: 'mc-write-fail',
    status: 'interested',
    outreachLockedUntilPaid: true,
    vehicle: VEHICLE,
    createdAt: '2026-11-22T15:00:00.000Z',
    updatedAt: '2026-11-22T15:00:00.000Z',
  }]);
  const reused = deps(
    directory(async () => identity),
    store,
    1,
    reusedDeals,
    null,
    NOW,
    { conversationWrite: 'fail' },
  );
  await assert.rejects(
    () => startDealerConversation('shopper-write-fail', {
      listingId: 'mc-write-fail',
      vehicle: VEHICLE,
    }, reused),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 500
      && error.code === 'conversation_unrecorded',
  );
  assert.equal(reused.book.writes(), 2);
  assert.equal(reused.book.newKeys(), 1);
  assert.equal(reused.book.refunds(), 0);

  const created = deps(
    directory(async () => ({
      status: 'found',
      identity: { listingId: 'mc-write-fail-new', marketcheckDealerId: HONDA.marketcheckDealerId },
    })),
    new MemoryRateLimitStore(),
    1,
    memoryDeals(),
    null,
    NOW,
    { conversationWrite: 'fail' },
  );
  await assert.rejects(
    () => startDealerConversation('shopper-write-fail-new', {
      listingId: 'mc-write-fail-new',
      vehicle: VEHICLE,
    }, created),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 500
      && error.code === 'conversation_unrecorded',
  );
  assert.equal(created.book.writes(), 2);
  assert.equal(created.book.newKeys(), 1);
  assert.equal(created.book.refunds(), 0);
  assert.equal(created.deals.rows.length, 1);
});

test('a zero-key shopper retries a charged deal without spending a second key', async () => {
  const store = new MemoryRateLimitStore();
  const lookups = directory(async () => ({
    status: 'found',
    identity: { listingId: 'mc-retry', marketcheckDealerId: HONDA.marketcheckDealerId },
  }));
  const openId = '12121212-1212-4212-8212-121212121212';
  const deals = memoryDeals([{
    id: openId,
    consumerUserId: 'shopper-retry',
    listingId: 'mc-retry',
    status: 'interested',
    outreachLockedUntilPaid: true,
    vehicle: VEHICLE,
    createdAt: '2026-11-22T15:00:00.000Z',
    updatedAt: '2026-11-22T15:00:00.000Z',
  }]);
  const box = deps(lookups, store, 0, deals, null, NOW, {
    charge: 'already_charged',
    charged: true,
  });
  const started = await startDealerConversation('shopper-retry', {
    listingId: 'mc-retry',
    vehicle: VEHICLE,
  }, box);
  assert.equal(started.deal.id, openId);
  assert.equal(started.match.network, 'in_network');
  assert.equal(box.book.spends(), 1);
  assert.equal(box.book.newKeys(), 0);
  assert.equal(box.book.writes(), 1);
  assert.equal(box.book.refunds(), 0);
});

test('repeated off-network deal posts fetch the listing once, then use the cache', async () => {
  const store = new MemoryRateLimitStore();
  const lookups = directory(async () => ({ status: 'found', identity: { ...OFF_IDENTITY, listingId: 'mc-off-repeat' } }));
  const box = deps(lookups, store, 3);
  for (let i = 0; i < 4; i += 1) {
    await assert.rejects(
      () => startDealerConversation('shopper-off', {
        listingId: 'mc-off-repeat',
        vehicle: VEHICLE,
      }, { ...box, now: new Date(NOW) }),
      (error: unknown) => error instanceof ShopperDealError && error.status === 409 && error.code === 'off_network',
    );
  }
  assert.equal(lookups.fetches(), 1);
  assert.equal(box.deals.rows.length, 0);
  const dumped = JSON.stringify(listingIdentityCacheSnapshotForTests());
  assert.equal(dumped.includes('1HGCM82633A004352'), false);
  assert.equal(dumped.includes('32000'), false);
  assert.equal(dumped.includes('far-away.example'), true);
});

test('a deal post over the per-user limit does not fetch', async () => {
  const store = new MemoryRateLimitStore();
  const lookups = directory(async () => ({ status: 'found', identity: OFF_IDENTITY }));
  const box = deps(lookups, store, 5);
  for (let i = 0; i < DEAL_POST_USER_PER_MINUTE; i += 1) {
    await assert.rejects(
      () => startDealerConversation('shopper-cap', {
        listingId: `mc-cap-${i}`,
        vehicle: VEHICLE,
      }, { ...box, now: new Date(NOW) }),
      (error: unknown) => error instanceof ShopperDealError && error.code === 'off_network',
    );
  }
  assert.equal(lookups.fetches(), DEAL_POST_USER_PER_MINUTE);
  await assert.rejects(
    () => startDealerConversation('shopper-cap', {
      listingId: 'mc-cap-blocked',
      vehicle: VEHICLE,
    }, { ...box, now: new Date(NOW) }),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 429
      && error.code === 'rate_limited'
      && error.message === SHOPPER_MESSAGE_MINUTE_COPY,
  );
  assert.equal(lookups.fetches(), DEAL_POST_USER_PER_MINUTE);

  const nextDay = new MemoryRateLimitStore();
  const dayLookups = directory(async () => ({ status: 'found', identity: OFF_IDENTITY }));
  for (let i = 0; i < DEAL_POST_USER_PER_DAY; i += 1) {
    const minute = Math.floor(i / DEAL_POST_USER_PER_MINUTE);
    await assert.rejects(
      () => startDealerConversation('shopper-day', {
        listingId: `mc-day-${i}`,
        vehicle: VEHICLE,
      }, deps(dayLookups, nextDay, 5, memoryDeals(), null, NOW + minute * 60_000)),
      (error: unknown) => error instanceof ShopperDealError && error.code === 'off_network',
    );
  }
  const before = dayLookups.fetches();
  await assert.rejects(
    () => startDealerConversation('shopper-day', {
      listingId: 'mc-day-blocked',
      vehicle: VEHICLE,
    }, deps(dayLookups, nextDay, 5, memoryDeals(), null, NOW + 6 * 60_000)),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 429
      && error.message === SHOPPER_MESSAGE_DAY_COPY,
  );
  assert.equal(dayLookups.fetches(), before);
});

test('listing identity stays cached 15 minutes when in network and 6 hours when off network', async () => {
  const t0 = 1_700_000_000_000;
  let positiveFetches = 0;
  const positive: RooftopDirectory = {
    listOnboardedRooftops: async () => [HONDA],
    lookupListingIdentity: async () => {
      positiveFetches += 1;
      return { status: 'found', identity: { marketcheckDealerId: '1038994', listingId: 'mc-positive' } };
    },
  };
  const first = await resolveRooftopMatch({ listingId: 'mc-positive' }, positive, { nowMs: t0 });
  assert.equal(first.matched, true);
  await resolveRooftopMatch({ listingId: 'mc-positive' }, positive, { nowMs: t0 + LISTING_IDENTITY_POSITIVE_TTL_MS - 1 });
  assert.equal(positiveFetches, 1);
  await resolveRooftopMatch({ listingId: 'mc-positive' }, positive, { nowMs: t0 + LISTING_IDENTITY_POSITIVE_TTL_MS });
  assert.equal(positiveFetches, 2);

  let negativeFetches = 0;
  const negative: RooftopDirectory = {
    listOnboardedRooftops: async () => [HONDA],
    lookupListingIdentity: async () => {
      negativeFetches += 1;
      return { status: 'found', identity: { marketcheckDealerId: '999000', listingId: 'mc-negative' } };
    },
  };
  await assert.rejects(
    () => requireOff(negative, t0),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'off_network',
  );
  await assert.rejects(
    () => requireOff(negative, t0 + LISTING_IDENTITY_NEGATIVE_TTL_MS - 1),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'off_network',
  );
  assert.equal(negativeFetches, 1);
  await assert.rejects(
    () => requireOff(negative, t0 + LISTING_IDENTITY_NEGATIVE_TTL_MS),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'off_network',
  );
  assert.equal(negativeFetches, 2);

  let misses = 0;
  const missing: RooftopDirectory = {
    listOnboardedRooftops: async () => [HONDA],
    lookupListingIdentity: async () => {
      misses += 1;
      return { status: 'unavailable', reason: 'not_found' };
    },
  };
  await resolveRooftopMatch({ listingId: 'mc-missing' }, missing, { nowMs: t0 });
  await resolveRooftopMatch({ listingId: 'mc-missing' }, missing, { nowMs: t0 + 60_000 });
  assert.equal(misses, 1);

  let errors = 0;
  const broken: RooftopDirectory = {
    listOnboardedRooftops: async () => [HONDA],
    lookupListingIdentity: async () => {
      errors += 1;
      return { status: 'unavailable', reason: 'error' };
    },
  };
  await resolveRooftopMatch({ listingId: 'mc-error' }, broken, { nowMs: t0 });
  await resolveRooftopMatch({ listingId: 'mc-error' }, broken, { nowMs: t0 + 1_000 });
  assert.equal(errors, 2);
});

async function requireOff(rooftops: RooftopDirectory, nowMs: number) {
  const { requireInNetworkMatch } = await import('./conversation');
  return requireInNetworkMatch({ listingId: 'mc-negative' }, rooftops, { nowMs });
}

test('chip reads allow sixty a minute and then say to wait', async () => {
  const store = new MemoryRateLimitStore();
  const deals: Pick<ShopperDealRepository, 'get'> = {
    async get(userId, dealId) {
      return {
        id: dealId,
        consumerUserId: userId,
        listingId: 'mc-listing-1',
        status: 'interested',
        outreachLockedUntilPaid: true,
        vehicle: VEHICLE,
        createdAt: '2026-11-22T15:00:00.000Z',
        updatedAt: '2026-11-22T15:00:00.000Z',
      };
    },
  };
  let loads = 0;
  const supabase = {
    from(table: string) {
      loads += 1;
      if (table === 'shopper_dealer_messages') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: [], error: null }) }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { deal_id: 'deal-1', opener: 'Dana wants your best itemized out-the-door' },
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  };
  for (let i = 0; i < SHOPPER_READ_PER_MINUTE; i += 1) {
    const set = await suggestDealChips('chip-shopper', 'deal-1', {}, {
      deals,
      supabase: supabase as unknown as SupabaseClient,
    }, { store, nowMs: NOW });
    assert.equal(set.chips.length > 0, true);
  }
  const before = loads;
  await assert.rejects(
    () => suggestDealChips('chip-shopper', 'deal-1', {}, {
      deals,
      supabase: supabase as unknown as SupabaseClient,
    }, { store, nowMs: NOW }),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 429
      && error.message === SHOPPER_MESSAGE_MINUTE_COPY,
  );
  assert.equal(loads, before);
  const other = await suggestDealChips('chip-shopper-b', 'deal-1', {}, {
    deals,
    supabase: supabase as unknown as SupabaseClient,
  }, { store, nowMs: NOW });
  assert.equal(other.chips.length > 0, true);
});
