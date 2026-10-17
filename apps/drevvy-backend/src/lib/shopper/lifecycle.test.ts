import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { LiveVehicle } from '@/lib/marketcheck/mcp-adapter';

import {
  ShopperDealConflict,
  ShopperDealError,
  type ShopperDealRepository,
  type ShopperDealRow,
} from './deals';
import type { ShopperPush } from '@/lib/push/events';
import { planShopperPush } from '@/lib/push/triggers';

import {
  addShopperCar,
  answerOutcome,
  applyAgentEvent,
  exitGeofence,
  forwardOffer,
  getShopperCar,
  listBuyOutcomes,
  listShopperCars,
  REMOVAL_REFUND_MS,
  removeShopperCar,
  runLifecycleSchedule,
  similarForDeal,
  type DealDeps,
} from './deal-actions';
import {
  BUY_PROMPT_BODY,
  BUY_PROMPT_TITLE,
  pickupFallbackDue,
  readAgentEvent,
  readCronAuth,
  readOfferBody,
  readOutcomeBody,
  runScheduledLifecycle,
} from './lifecycle';
import {
  createMemoryLifecycleRepository,
  selectLifecycleRepository,
  type LifecycleRepository,
} from './lifecycle-store';
import { NO_RESPONSE_MS } from './quota';
import { findSimilarListings, similarSearchQuery, toShopperListing } from './similar';

const HERE = dirname(fileURLToPath(import.meta.url));

function createMockSupabase(initialBalance = 999, consumeMode: 'ok' | 'no_credits' | 'error' = 'ok') {
  const credits = new Map<string, { balance: number; lifetime_purchased: number; lifetime_used: number; lifetime_refunded: number }>();
  const events = new Map<string, { id: string; user_id: string; idempotency_key: string }[]>();

  credits.set('shopper-1', { balance: initialBalance, lifetime_purchased: initialBalance, lifetime_used: 0, lifetime_refunded: 0 });

  const rowFor = (userId: string) => {
    const row = credits.get(userId) ?? { balance: 0, lifetime_purchased: 0, lifetime_used: 0, lifetime_refunded: 0 };
    credits.set(userId, row);
    return row;
  };

  const mockResult = (table: string, userId: string) => ({
    maybeSingle: async () => {
      if (table === 'shopper_credits') {
        const data = credits.get(userId);
        return { data: data ? { ...data, user_id: userId } : null, error: null };
      }
      return { data: null, error: null };
    },
    single: async () => {
      if (table === 'shopper_credits') {
        const data = credits.get(userId) ?? { balance: 0, lifetime_purchased: 0, lifetime_used: 0, lifetime_refunded: 0 };
        return { data: { ...data, user_id: userId }, error: null };
      }
      return { data: null, error: null };
    },
    eq: (_col: string, _val: string) => mockResult(table, userId),
  });

  return {
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: (_col: string, val: string) => mockResult(table, val),
      }),
      upsert: async (_data: unknown, _opts?: unknown) => ({ error: null }),
      insert: async (data: { user_id?: string; idempotency_key?: string }) => {
        if (table === 'shopper_credit_events' && data.user_id && data.idempotency_key) {
          const userEvents = events.get(data.user_id) ?? [];
          const existing = userEvents.find((e) => e.idempotency_key === data.idempotency_key);
          if (existing) return { error: { code: '23505', message: 'duplicate' } };
          userEvents.push({ id: randomUUID(), user_id: data.user_id, idempotency_key: data.idempotency_key });
          events.set(data.user_id, userEvents);
        }
        return { error: null };
      },
      update: (_data: unknown) => ({
        eq: (_col: string, _val: string) => ({ error: null }),
      }),
    }),
    rpc: async (fnName: string, params: { p_user_id?: string; p_deal_id?: string; p_idempotency_key?: string }) => {
      const userId = params.p_user_id ?? '';
      const row = rowFor(userId);
      const userEvents = events.get(userId) ?? [];
      events.set(userId, userEvents);

      if (fnName === 'consume_credit_atomic') {
        if (consumeMode === 'error') return { data: null, error: { message: 'db down' } };
        const key = `use:${params.p_deal_id ?? ''}`;
        if (userEvents.some((event) => event.idempotency_key === key)) {
          return { data: [{ consumed: true, already_consumed: true, ...row }], error: null };
        }
        if (consumeMode === 'no_credits' || row.balance <= 0) {
          return { data: [{ consumed: false, already_consumed: false, ...row }], error: null };
        }
        userEvents.push({ id: randomUUID(), user_id: userId, idempotency_key: key });
        row.balance -= 1;
        row.lifetime_used += 1;
        return { data: [{ consumed: true, already_consumed: false, ...row }], error: null };
      }

      if (fnName === 'refund_credit_atomic') {
        const dealId = params.p_deal_id ?? '';
        const idempotencyKey = params.p_idempotency_key ?? '';
        const existingRefund = userEvents.find((event) => event.idempotency_key === idempotencyKey);
        if (existingRefund) {
          return { data: [{ refunded: false, already_refunded: true, new_balance: row.balance }], error: null };
        }
        const useEvent = userEvents.find((event) => event.idempotency_key === `use:${dealId}`);
        if (!useEvent) {
          return { data: [{ refunded: false, already_refunded: false, new_balance: row.balance }], error: null };
        }
        userEvents.push({ id: randomUUID(), user_id: userId, idempotency_key: idempotencyKey });
        row.balance += 1;
        row.lifetime_refunded += 1;
        return { data: [{ refunded: true, already_refunded: false, new_balance: row.balance }], error: null };
      }
      return { data: null, error: { message: 'unknown rpc' } };
    },
  } as unknown;
}
const VEHICLE = {
  year: 2024,
  make: 'Chevrolet',
  model: 'Tahoe',
  trim: 'LT',
  price: 52900,
  latitude: 35.2271,
  longitude: -80.8431,
  city: 'Charlotte',
  state: 'NC',
};


function memoryDeals(): ShopperDealRepository & { rows: ShopperDealRow[] } {
  const rows: ShopperDealRow[] = [];
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
      const open = rows.find((row) =>
        row.consumerUserId === deal.consumerUserId
        && row.listingId === deal.listingId
        && (row.status === 'interested' || row.status === 'negotiating'),
      );
      if (open) throw new ShopperDealConflict();
      const now = '2026-10-01T16:00:00.000Z';
      const row: ShopperDealRow = {
        id: randomUUID(),
        consumerUserId: deal.consumerUserId,
        listingId: deal.listingId,
        status: 'interested',
        outreachLockedUntilPaid: true,
        vehicle: deal.vehicle,
        createdAt: now,
        updatedAt: now,
      };
      rows.push(row);
      return row;
    },
    async list(consumerUserId) {
      return rows.filter((row) => row.consumerUserId === consumerUserId);
    },
    async get(consumerUserId, dealId) {
      return rows.find((row) => row.consumerUserId === consumerUserId && row.id === dealId) ?? null;
    },
    async close(consumerUserId, dealId) {
      const row = rows.find((item) => item.consumerUserId === consumerUserId && item.id === dealId);
      if (!row) return null;
      if (row.status !== 'closed') row.status = 'closed';
      return row;
    },
    async discard(consumerUserId, dealId) {
      const index = rows.findIndex((item) => item.consumerUserId === consumerUserId && item.id === dealId);
      if (index >= 0) rows.splice(index, 1);
    },
  };
}

function harness(
  now = '2026-10-01T16:10:00.000Z',
  balance = 999,
  consumeMode: 'ok' | 'no_credits' | 'error' = 'ok',
) {
  const deals = memoryDeals();
  const lifecycle = createMemoryLifecycleRepository();
  const deps: DealDeps = {
    deals,
    lifecycle,
    now: new Date(now),
    live: false,
    supabase: createMockSupabase(balance, consumeMode) as DealDeps['supabase'],
  };
  return { deals, lifecycle, deps };
}

async function addCar(box: ReturnType<typeof harness>, listingId: string) {
  return addShopperCar('shopper-1', { listingId, vehicle: VEHICLE }, box.deps);
}

test('a removed deal can be added again with a new id', async () => {
  const box = harness('2026-10-01T16:40:00.000Z');
  const created = await addCar(box, 'mc-car-10');
  await removeShopperCar('shopper-1', created.deal.id, box.deps);
  const second = await addCar(box, 'mc-car-10');
  assert.notEqual(second.deal.id, created.deal.id);
});

test('adding a deal consumes one car and repeating that listing does not', async () => {
  const box = harness('2026-10-01T16:10:00.000Z', 2);
  const first = await addCar(box, 'mc-car-consume');
  assert.equal(first.credits.balance, 1);
  const again = await addCar(box, 'mc-car-consume');
  assert.equal(again.deal.id, first.deal.id);
  assert.equal(again.credits.balance, 1);
  const second = await addCar(box, 'mc-car-consume-2');
  assert.equal(second.credits.balance, 0);
  assert.equal(box.deals.rows.length, 2);
});

test('fair price loads on unlock with agent and when a deal is opened', async () => {
  const calls: string[] = [];
  const box = harness();
  box.deps.loadFairPrice = async (trigger, vehicle) => {
    calls.push(`${trigger}:${vehicle.condition ?? ''}:${vehicle.vin ?? ''}:${vehicle.zip ?? ''}`);
    return { price: 30100, fromCache: calls.length > 1 };
  };
  const vin = '1HGCM82633A004352';
  const vehicle = { ...VEHICLE, vin, miles: 41000, condition: 'used' as const, zip: 'should-not-stick' };
  const created = await addShopperCar('shopper-1', { listingId: 'mc-fair-1', vehicle, zip: '29730' }, box.deps);
  assert.equal(created.deal.fairPrice?.price, 30100);
  assert.equal(created.deal.fairPrice?.fromCache, false);
  assert.deepEqual(calls, [`unlock_with_agent:used:${vin}:29730`]);
  const stored = box.deals.rows[0]?.vehicle as { zip?: string; fairPrice?: unknown; vin?: string };
  assert.equal(stored.zip, undefined);
  assert.equal(stored.fairPrice, undefined);
  assert.equal(stored.vin, vin);

  const opened = await getShopperCar('shopper-1', created.deal.id, box.deps, { zip: '29730' });
  assert.equal(opened.fairPrice?.fromCache, true);
  assert.deepEqual(calls, [`unlock_with_agent:used:${vin}:29730`, `open_deal:used:${vin}:29730`]);

  const listed = await listShopperCars('shopper-1', box.deps);
  assert.equal(listed.deals[0]?.fairPrice, undefined);
  assert.equal(calls.length, 2);

  const fresh = harness();
  fresh.deps.loadFairPrice = async (trigger) => {
    calls.push(trigger);
    return { price: 1, fromCache: false };
  };
  await addShopperCar('shopper-1', {
    listingId: 'mc-fair-new',
    vehicle: { ...vehicle, condition: 'new' },
    zip: '29730',
  }, fresh.deps);
  assert.equal(calls.at(-1), 'unlock_with_agent');

  const empty = harness('2026-10-01T16:10:00.000Z', 0);
  empty.deps.loadFairPrice = async () => {
    calls.push('blocked');
    return null;
  };
  await assert.rejects(
    () => addShopperCar('shopper-1', { listingId: 'mc-fair-empty', vehicle, zip: '29730' }, empty.deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'no_credits',
  );
  assert.equal(calls.includes('blocked'), false);
});

test('adding a deal with an empty balance does not create a deal', async () => {
  const box = harness('2026-10-01T16:10:00.000Z', 0);
  await assert.rejects(
    () => addCar(box, 'mc-car-empty'),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'no_credits',
  );
  assert.equal(box.deals.rows.length, 0);
});

test('a failed charge discards the new deal and a credit error keeps it', async () => {
  const uncharged = harness('2026-10-01T16:10:00.000Z', 1, 'no_credits');
  await assert.rejects(
    () => addCar(uncharged, 'mc-car-uncharged'),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'no_credits',
  );
  assert.equal(uncharged.deals.rows.length, 0);

  const failed = harness('2026-10-01T16:10:00.000Z', 1, 'error');
  await assert.rejects(
    () => addCar(failed, 'mc-car-credit-error'),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'credit_failed',
  );
  assert.equal(failed.deals.rows.length, 1);
  assert.equal(failed.deals.rows[0]?.status, 'interested');
});

test('removing a deal within 30 minutes and before outreach returns the car once', async () => {
  const box = harness('2026-10-01T16:00:00.000Z', 1);
  const created = await addCar(box, 'mc-car-refund-window');
  assert.equal(created.credits.balance, 0);
  const added = Date.parse(created.deal.createdAt);
  box.deps.now = new Date(added + REMOVAL_REFUND_MS);
  const result = await removeShopperCar('shopper-1', created.deal.id, box.deps);
  assert.equal(result.refunded, true);
  assert.equal(result.credits.balance, 1);

  const again = await removeShopperCar('shopper-1', created.deal.id, box.deps);
  assert.equal(again.refunded, false);
  assert.equal(again.credits.balance, 1);
});

test('removing a deal after 30 minutes does not return the car', async () => {
  const box = harness('2026-10-01T16:00:00.000Z', 1);
  const created = await addCar(box, 'mc-car-refund-late');
  const added = Date.parse(created.deal.createdAt);
  box.deps.now = new Date(added + REMOVAL_REFUND_MS + 1);
  const result = await removeShopperCar('shopper-1', created.deal.id, box.deps);
  assert.equal(result.refunded, false);
  assert.equal(result.credits.balance, 0);
});

test('removing a deal after outreach does not return the car', async () => {
  const box = harness('2026-10-01T16:00:00.000Z', 1);
  const created = await addCar(box, 'mc-car-refund-outreach');
  const added = Date.parse(created.deal.createdAt);
  await applyAgentEvent({
    type: 'outreach',
    dealId: created.deal.id,
    consumerUserId: 'shopper-1',
    channel: 'email',
    sentAt: new Date(added + 60_000).toISOString(),
  }, box.deps);
  box.deps.now = new Date(added + 5 * 60_000);
  const result = await removeShopperCar('shopper-1', created.deal.id, box.deps);
  assert.equal(result.refunded, false);
  assert.equal(result.credits.balance, 0);
});

test('saving an open listing returns the same deal', async () => {
  const box = harness();
  const first = await addCar(box, 'mc-car-10');
  const again = await addCar(box, 'mc-car-10');
  assert.equal(again.deal.id, first.deal.id);
  assert.equal(box.deals.rows.length, 1);
});

test('sold and no-response expose similar cars without dealer identity', async () => {
  const box = harness();
  const created = await addCar(box, 'mc-listing-1');
  await assert.rejects(
    () => similarForDeal('shopper-1', created.deal.id, box.deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'similar_unavailable',
  );

  await applyAgentEvent({
    type: 'end',
    dealId: created.deal.id,
    consumerUserId: 'shopper-1',
    endState: 'sold',
    sentAt: '2026-10-03T12:00:00.000Z',
  }, box.deps);
  const similar = await similarForDeal('shopper-1', created.deal.id, box.deps);
  assert.equal(similar.source, 'mock');
  assert.equal(similar.search.make, 'Chevrolet');
  assert.equal(similar.search.model, 'Tahoe');
  assert.equal(similar.search.trim, 'LT');
  assert.equal(similar.search.radiusMiles, 50);
  assert.equal(similar.listings.length, 3);
  for (const listing of similar.listings) {
    assert.equal(listing.year, 2024);
    assert.equal(listing.listingId === 'mc-listing-1', false);
    assert.equal(listing.price >= similar.search.minPrice && listing.price <= similar.search.maxPrice, true);
    assert.equal(listing.distanceMiles <= similar.search.radiusMiles, true);
  }
  const serialized = JSON.stringify(similar);
  assert.equal(serialized.includes('dealerName'), false);
  assert.equal(serialized.includes('phone'), false);
  assert.equal(serialized.includes('email'), false);
  assert.equal(serialized.includes('website'), false);
  assert.equal(serialized.includes('street'), false);
  assert.equal(serialized.includes('address'), false);
  const listed = await getShopperCar('shopper-1', created.deal.id, box.deps);
  assert.equal(listed.findSimilar, true);
  assert.equal(listed.endState, 'sold');
  assert.equal((await box.lifecycle.get('shopper-1', created.deal.id))?.endState, 'sold');
  assert.equal((await box.deps.deals.get('shopper-1', created.deal.id))?.status, 'closed');
});

test('live similar results drop the dealer name and a failed search uses the mock', async () => {
  const query = similarSearchQuery(VEHICLE, 'mc-listing-1');
  const live = toShopperListing({
    id: 'mc-other',
    listingId: 'mc-other',
    year: 2024,
    make: 'Chevrolet',
    model: 'Tahoe',
    trim: 'LT',
    condition: 'used',
    price: 51000,
    miles: 14000,
    thumbnailUrl: 'https://images.example.com/tahoe.jpg',
    location: {
      latitude: 35.3,
      longitude: -80.9,
      dealerName: 'Secret Motors',
      dealerCity: 'Gastonia',
      dealerState: 'NC',
    },
  } satisfies LiveVehicle, query);
  assert.ok(live);
  assert.equal(live.city, 'Gastonia');
  assert.equal(JSON.stringify(live).includes('Secret Motors'), false);
  assert.equal(JSON.stringify(live).includes('dealerName'), false);
  assert.equal(toShopperListing({ ...liveVehicle('mc-listing-1'), listingId: 'mc-listing-1' }, query), null);

  const found = await findSimilarListings(query, {
    live: true,
    search: async () => ({
      vehicles: [liveVehicle('mc-other')],
      numFound: 1,
      returned: 1,
      start: 0,
      rows: 8,
      fromCache: false,
      latencyMs: 1,
    }),
  });
  assert.equal(found.source, 'live');
  assert.equal(found.listings[0]?.listingId, 'mc-other');
  assert.equal(JSON.stringify(found).includes('Secret Motors'), false);

  const fallback = await findSimilarListings(query, {
    live: true,
    search: async () => {
      throw new Error('marketcheck down');
    },
  });
  assert.equal(fallback.source, 'mock');
  assert.equal(fallback.listings.length, 3);
});

test('the dealer pin is hidden until the offer is forwarded', async () => {
  const box = harness();
  const created = await addCar(box, 'mc-listing-1');
  const hidden = await getShopperCar('shopper-1', created.deal.id, box.deps);
  assert.equal('visit' in hidden, false);

  const offer = readOfferBody({
    latitude: 35.19,
    longitude: -80.91,
    expectedPickupDate: '2026-10-12',
    street: '100 Dealer Way',
    dealerName: 'Secret Motors',
  });
  assert.equal(JSON.stringify(offer).includes('Dealer Way'), false);
  assert.equal(JSON.stringify(offer).includes('Secret Motors'), false);
  assert.equal(offer.radiusMeters, 150);

  const revealed = await forwardOffer('shopper-1', created.deal.id, offer, box.deps);
  assert.deepEqual(revealed.visit, {
    latitude: 35.19,
    longitude: -80.91,
    radiusMeters: 150,
    expectedPickupDate: '2026-10-12',
  });
  assert.equal(JSON.stringify(revealed).includes('Dealer Way'), false);
  assert.equal(JSON.stringify(revealed.vehicle).includes('dealer'), false);
});

test('geofence exit asks once, and the pickup fallback asks the next day', async () => {
  const box = harness('2026-10-12T18:00:00.000Z');
  const created = await addCar(box, 'mc-listing-1');
  await assert.rejects(
    () => exitGeofence('shopper-1', created.deal.id, box.deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'visit_unavailable',
  );
  await forwardOffer('shopper-1', created.deal.id, {
    latitude: 35.19,
    longitude: -80.91,
    radiusMeters: 150,
    expectedPickupDate: '2026-10-12',
    locationGranted: true,
  }, box.deps);

  const first = await exitGeofence('shopper-1', created.deal.id, box.deps);
  const second = await exitGeofence('shopper-1', created.deal.id, { ...box.deps, now: new Date('2026-10-12T19:00:00.000Z') });
  assert.equal(first.alreadySent, false);
  assert.equal(first.prompt.title, BUY_PROMPT_TITLE);
  assert.equal(first.prompt.body, BUY_PROMPT_BODY);
  assert.equal(first.prompt.delivery, 'recorded');
  assert.equal(first.prompt.source, 'geofence_exit');
  assert.equal(BUY_PROMPT_BODY.toLowerCase().includes('automated assistant'), false);
  assert.equal(second.alreadySent, true);
  assert.equal(second.prompt.sentAt, first.prompt.sentAt);
  assert.equal(second.prompt.source, 'geofence_exit');

  const record = await box.lifecycle.get('shopper-1', created.deal.id);
  assert.ok(record);
  assert.equal(pickupFallbackDue(record, '2026-10-13T00:00:00.000Z'), false);
});

test('the day after pickup sends the same prompt when nobody left the geofence', async () => {
  const box = harness('2026-10-12T15:00:00.000Z');
  const created = await addCar(box, 'mc-listing-1');
  await forwardOffer('shopper-1', created.deal.id, {
    latitude: 35.19,
    longitude: -80.91,
    radiusMeters: 200,
    expectedPickupDate: '2026-10-12',
    locationGranted: true,
  }, box.deps);
  const record = await box.lifecycle.get('shopper-1', created.deal.id);
  assert.ok(record);
  assert.equal(pickupFallbackDue(record, '2026-10-12T23:00:00.000Z'), false);
  assert.equal(pickupFallbackDue({ ...record, locationGranted: false }, '2026-10-13T00:00:00.000Z'), true);
  assert.equal(pickupFallbackDue(record, '2026-10-13T00:00:00.000Z'), true);

  box.deps.now = new Date('2026-10-13T15:00:00.000Z');
  const first = await runLifecycleSchedule(box.deps);
  const second = await runLifecycleSchedule(box.deps);
  assert.equal(first.buyPrompts, 1);
  assert.equal(second.buyPrompts, 0);
  const prompted = await box.lifecycle.get('shopper-1', created.deal.id);
  assert.equal(prompted?.buyPromptSource, 'pickup_fallback');
  assert.equal(prompted?.buyPromptSentAt, '2026-10-13T15:00:00.000Z');
});

test('no reply for five days returns the slot and a reply keeps the deal open', async () => {
  const box = harness();
  const quiet = await addCar(box, 'mc-quiet-01');
  const answered = await addCar(box, 'mc-reply-01');
  const started = '2026-10-01T16:00:00.000Z';
  await applyAgentEvent({
    type: 'outreach',
    dealId: quiet.deal.id,
    consumerUserId: 'shopper-1',
    channel: 'email',
    sentAt: started,
  }, box.deps);
  await applyAgentEvent({
    type: 'outreach',
    dealId: answered.deal.id,
    consumerUserId: 'shopper-1',
    channel: 'text',
    sentAt: started,
  }, box.deps);
  await applyAgentEvent({
    type: 'reply',
    dealId: answered.deal.id,
    consumerUserId: 'shopper-1',
    sentAt: '2026-10-02T12:00:00.000Z',
  }, box.deps);

  const tooSoon = new Date(Date.parse(started) + NO_RESPONSE_MS - 1).toISOString();
  const due = new Date(Date.parse(started) + NO_RESPONSE_MS).toISOString();
  const early = runScheduledLifecycle(await box.lifecycle.listAll(), tooSoon);
  assert.deepEqual(early.endedNoResponse, []);
  const ended = runScheduledLifecycle(await box.lifecycle.listAll(), due);
  assert.deepEqual(ended.endedNoResponse, [quiet.deal.id]);
  const again = runScheduledLifecycle(ended.records, due);
  assert.deepEqual(again.endedNoResponse, []);
  const quietRecord = ended.records.find((record) => record.dealId === quiet.deal.id);
  const replyRecord = ended.records.find((record) => record.dealId === answered.deal.id);
  assert.equal(quietRecord?.endState, 'ended_no_response');
  assert.equal(replyRecord?.endState, 'open');
});

test('the shopper answer stores bought and final price for the admin console', async () => {
  const box = harness();
  const created = await addCar(box, 'mc-listing-1');
  assert.throws(
    () => readOutcomeBody({ bought: true }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'invalid_outcome',
  );
  const saved = await answerOutcome('shopper-1', created.deal.id, readOutcomeBody({ bought: true, finalPrice: 48750 }), box.deps);
  assert.equal(saved.outcome.bought, true);
  assert.equal(saved.outcome.finalPrice, 48750);
  assert.equal(saved.deal.endState, 'sold');
  assert.equal(saved.deal.findSimilar, true);
  await assert.rejects(
    () => answerOutcome('shopper-1', created.deal.id, { bought: false, finalPrice: null }, box.deps),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'outcome_exists',
  );
  const outcomes = await listBuyOutcomes(box.lifecycle);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0]?.finalPrice, 48750);

  const declined = harness();
  const other = await addCar(declined, 'mc-listing-2');
  const no = await answerOutcome('shopper-1', other.deal.id, { bought: false, finalPrice: null }, declined.deps);
  assert.equal(no.outcome.bought, false);
  assert.equal(no.deal.endState, 'open');
});

test('cron auth stays closed until the secret is set and lifecycle storage is opt-in', () => {
  assert.equal(readCronAuth(null, undefined), 'unconfigured');
  assert.equal(readCronAuth('Bearer secret', 'secret'), 'ok');
  assert.equal(readCronAuth('Bearer wrong', 'secret'), 'rejected');

  const memory = createMemoryLifecycleRepository();
  let opened = false;
  const selected = selectLifecycleRepository({}, memory, () => {
    opened = true;
    return memory;
  });
  assert.equal(selected, memory);
  assert.equal(opened, false);
  const supabase = { source: 'supabase' } as LifecycleRepository;
  assert.equal(selectLifecycleRepository({ DEAL_LIFECYCLE_STORE: 'supabase' }, memory, () => supabase), supabase);

  const dealStore = readFileSync(join(HERE, 'deal-store.ts'), 'utf8');
  assert.match(dealStore, /const COLUMNS = 'id, consumer_user_id, listing_id, status, outreach_locked_until_paid, vehicle_snapshot, created_at, updated_at'/);
  assert.equal(dealStore.includes('dealer_latitude'), false);
  assert.equal(dealStore.includes('end_state'), false);

  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261012183301_deal_lifecycle.sql'), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /shopper_deal_lifecycle/);
  assert.match(sql, /dealer_latitude/);
  assert.match(sql, /dealer_longitude/);
  assert.match(sql, /visit_radius_meters/);
  assert.match(sql, /end_state/);
  assert.match(sql, /bought/);
  assert.match(sql, /final_price/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /grant select, insert, update, delete on public.shopper_deal_lifecycle to service_role/);
  assert.equal(sql.includes('public.leads'), false);
  assert.equal(sql.includes('dealerships'), false);
  assert.equal(sql.includes('add column'), false);

  const cron = readFileSync(join(HERE, '../../app/api/cron/deal-lifecycle/route.ts'), 'utf8');
  assert.match(cron, /DREVVY_CRON_SECRET/);
  assert.match(cron, /status: 404/);
  assert.equal(cron.includes('requireShopperAuth'), false);
  const admin = readFileSync(join(HERE, '../../app/api/admin/outcomes/route.ts'), 'utf8');
  assert.match(admin, /requireAdminApi/);
});

test('official offer, a sold car, and the day after pickup send push events once', async () => {
  const box = harness('2026-10-12T15:00:00.000Z');
  const pushes: ShopperPush[] = [];
  box.deps.notify = async (push) => {
    pushes.push(push);
  };
  const visited = await addCar(box, 'mc-listing-1');
  const offer = {
    latitude: 35.19,
    longitude: -80.91,
    radiusMeters: 150,
    expectedPickupDate: '2026-10-12',
    locationGranted: true,
  };
  await forwardOffer('shopper-1', visited.deal.id, offer, box.deps);
  await forwardOffer('shopper-1', visited.deal.id, offer, box.deps);
  await exitGeofence('shopper-1', visited.deal.id, box.deps);

  const waiting = await addCar(box, 'mc-listing-2');
  await forwardOffer('shopper-1', waiting.deal.id, { ...offer, locationGranted: false }, box.deps);

  box.deps.now = new Date('2026-10-13T15:00:00.000Z');
  await runLifecycleSchedule(box.deps);
  await runLifecycleSchedule(box.deps);
  await applyAgentEvent({
    type: 'end',
    dealId: waiting.deal.id,
    consumerUserId: 'shopper-1',
    endState: 'sold',
    sentAt: '2026-10-13T16:00:00.000Z',
  }, box.deps);
  await applyAgentEvent({
    type: 'end',
    dealId: waiting.deal.id,
    consumerUserId: 'shopper-1',
    endState: 'sold',
    sentAt: '2026-10-13T17:00:00.000Z',
  }, box.deps);

  assert.deepEqual(pushes.map((push) => push.event), ['official_offer', 'official_offer', 'did_you_buy', 'car_sold']);
  assert.equal(pushes.every((push) => push.userId === 'shopper-1'), true);
  assert.equal(/negotiat/i.test(JSON.stringify(pushes)), false);
  const sold = pushes.find((push) => push.event === 'car_sold');
  assert.match(sold?.title ?? '', /Your Tahoe is no longer listed/);
  assert.match(sold?.body ?? '', /add another/);
  assert.equal(/just sold/i.test(`${sold?.title} ${sold?.body}`), false);
  const buy = pushes.find((push) => push.event === 'did_you_buy');
  assert.equal(buy?.title, 'Did you buy it?');
  assert.match(buy?.body ?? '', /Tahoe/);
  assert.equal(/secret motors|lakeside|@/i.test(pushes.map((push) => `${push.title} ${push.body}`).join(' ')), false);
});

test('price drop and offer ready pushes omit dealer identity, and price drops stay on', async () => {
  const box = harness();
  const pushes: ShopperPush[] = [];
  box.deps.notify = async (push) => {
    pushes.push(push);
  };
  const created = await addCar(box, 'mc-listing-9');
  const identity = {
    dealerName: 'Lakeside Toyota',
    dealerEmail: 'sales@lakeside.example',
    phone: '704-555-0199',
    website: 'https://lakeside.example',
    street: '100 Dealer Way',
  };
  const dropped = readAgentEvent({
    type: 'price_drop',
    dealId: created.deal.id,
    consumerUserId: 'shopper-1',
    price: 50000,
    dealerAlias: 'Dealer A',
    ...identity,
  }, box.deps.now.toISOString());
  assert.equal(dropped.type === 'price_drop' && dropped.priceDrops, true);
  await applyAgentEvent(dropped, box.deps);
  await applyAgentEvent(readAgentEvent({
    type: 'price_drop',
    dealId: created.deal.id,
    consumerUserId: 'shopper-1',
    previousPrice: 50000,
    price: 51000,
    dealerAlias: 'Lakeside Toyota',
    ...identity,
  }, box.deps.now.toISOString()), box.deps);
  await applyAgentEvent(readAgentEvent({
    type: 'price_drop',
    dealId: created.deal.id,
    consumerUserId: 'shopper-1',
    previousPrice: 50000,
    price: 49000,
    priceDrops: false,
    ...identity,
  }, box.deps.now.toISOString()), box.deps);
  await applyAgentEvent(readAgentEvent({
    type: 'offer_ready',
    dealId: created.deal.id,
    consumerUserId: 'shopper-1',
    otd: 53450,
    dealerAlias: 'Dealer A',
    ...identity,
  }, box.deps.now.toISOString()), box.deps);

  assert.deepEqual(pushes.map((push) => push.event), ['price_drop', 'offer_ready']);
  assert.equal(pushes[0]?.title, 'Dealer A dropped $2,900 on your Tahoe');
  assert.equal(pushes[0]?.body, 'Vehicle price now $50,000. Tap to review.');
  assert.equal(pushes[1]?.title, 'Offer ready');
  assert.match(pushes[1]?.body ?? '', /\$53,450 out the door/);
  const text = pushes.map((push) => `${push.title} ${push.body}`).join(' ');
  assert.equal(/lakeside|sales@|704-555-0199|dealer way|https?:/i.test(text), false);
  assert.equal(/negotiat/i.test(text), false);
  assert.equal((await box.lifecycle.get('shopper-1', created.deal.id))?.endState, 'open');
});

test('the official offer push names the dealer and the deal payload does not', async () => {
  const box = harness();
  const pushes: ShopperPush[] = [];
  box.deps.notify = async (push) => {
    pushes.push(push);
  };
  const created = await addCar(box, 'mc-listing-8');
  const offer = readOfferBody({
    latitude: 35.19,
    longitude: -80.91,
    dealerName: 'Lakeside Toyota',
    street: '100 Dealer Way',
    dealerEmail: 'sales@lakeside.example',
  });
  assert.equal(JSON.stringify(offer).includes('Lakeside'), false);
  const revealed = await forwardOffer('shopper-1', created.deal.id, offer, box.deps, 'Lakeside Toyota');
  assert.equal(JSON.stringify(revealed).includes('Lakeside'), false);
  assert.equal(JSON.stringify(revealed).includes('Dealer Way'), false);
  assert.equal(pushes[0]?.body, 'Official offer from Lakeside Toyota is in your inbox.');
  await forwardOffer('shopper-1', created.deal.id, offer, box.deps, 'Lakeside Toyota');
  assert.equal(pushes.length, 1);

  const early = planShopperPush({
    kind: 'official_offer',
    userId: 'shopper-1',
    dealId: created.deal.id,
    offerForwarded: false,
    identity: { dealerName: 'Lakeside Toyota', dealerEmail: 'sales@lakeside.example' },
    vehicle: { model: 'Tahoe' },
  });
  assert.equal(/lakeside|sales@/i.test(`${early?.title} ${early?.body}`), false);
});

function liveVehicle(listingId: string): LiveVehicle {
  return {
    id: listingId,
    listingId,
    year: 2024,
    make: 'Chevrolet',
    model: 'Tahoe',
    trim: 'LT',
    condition: 'used',
    price: 51000,
    location: {
      latitude: 35.3,
      longitude: -80.9,
      dealerName: 'Secret Motors',
      dealerCity: 'Gastonia',
      dealerState: 'NC',
    },
  };
}
