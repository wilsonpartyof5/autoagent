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
import {
  addShopperCar,
  answerOutcome,
  applyAgentEvent,
  exitGeofence,
  forwardOffer,
  getShopperCar,
  listBuyOutcomes,
  removeShopperCar,
  runLifecycleSchedule,
  similarForDeal,
  type DealDeps,
} from './deal-actions';
import {
  BUY_PROMPT_BODY,
  BUY_PROMPT_TITLE,
  pickupFallbackDue,
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

function createMockSupabase() {
  const credits = new Map<string, { balance: number; lifetime_purchased: number; lifetime_used: number; lifetime_refunded: number }>();
  const events = new Map<string, { id: string; user_id: string; idempotency_key: string }[]>();

  credits.set('shopper-1', { balance: 999, lifetime_purchased: 999, lifetime_used: 0, lifetime_refunded: 0 });

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
        const data = credits.get(userId) ?? { balance: 999, lifetime_purchased: 999, lifetime_used: 0, lifetime_refunded: 0 };
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
      if (fnName === 'refund_credit_atomic') {
        const userId = params.p_user_id ?? '';
        const dealId = params.p_deal_id ?? '';
        const idempotencyKey = params.p_idempotency_key ?? '';
        const userEvents = events.get(userId) ?? [];
        const existingRefund = userEvents.find((e) => e.idempotency_key === idempotencyKey);
        if (existingRefund) {
          const c = credits.get(userId) ?? { balance: 0, lifetime_purchased: 0, lifetime_used: 0, lifetime_refunded: 0 };
          return { data: [{ refunded: false, already_refunded: true, new_balance: c.balance }], error: null };
        }
        const useKey = `use:${dealId}`;
        const useEvent = userEvents.find((e) => e.idempotency_key === useKey);
        if (!useEvent) {
          const c = credits.get(userId) ?? { balance: 0, lifetime_purchased: 0, lifetime_used: 0, lifetime_refunded: 0 };
          return { data: [{ refunded: false, already_refunded: false, new_balance: c.balance }], error: null };
        }
        userEvents.push({ id: randomUUID(), user_id: userId, idempotency_key: idempotencyKey });
        events.set(userId, userEvents);
        const c = credits.get(userId) ?? { balance: 0, lifetime_purchased: 0, lifetime_used: 0, lifetime_refunded: 0 };
        c.balance += 1;
        c.lifetime_refunded += 1;
        credits.set(userId, c);
        return { data: [{ refunded: true, already_refunded: false, new_balance: c.balance }], error: null };
      }
      return { data: null, error: null };
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
  };
}

function harness(now = '2026-10-01T16:10:00.000Z') {
  const deals = memoryDeals();
  const lifecycle = createMemoryLifecycleRepository();
  const deps: DealDeps = {
    deals,
    lifecycle,
    now: new Date(now),
    live: false,
    supabase: createMockSupabase() as DealDeps['supabase'],
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
