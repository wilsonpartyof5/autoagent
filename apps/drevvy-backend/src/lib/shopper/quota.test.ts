import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MONTHLY_CAR_CAP,
  MONTHLY_PRICE_USD,
  REMOVE_REFUND_WINDOW_MS,
  billingPeriodFromRevenueCat,
  dealCountsTowardQuota,
  demoBillingPeriod,
  loadBillingPeriod,
  quotaUsage,
  type BillingPeriod,
  type QuotaDeal,
  type SubscriptionStatus,
} from './quota';

const ADDED = '2026-10-10T12:00:00.000Z';

function period(status: SubscriptionStatus = 'active', source: BillingPeriod['source'] = 'revenuecat'): BillingPeriod {
  return {
    status,
    periodStart: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-11-01T00:00:00.000Z',
    source,
  };
}

function car(overrides: Partial<QuotaDeal> = {}): QuotaDeal {
  return {
    id: 'deal-1',
    addedAt: ADDED,
    removedAt: null,
    outreachSentAt: null,
    endState: 'open',
    endedAt: null,
    ...overrides,
  };
}

function cars(count: number, overrides: Partial<QuotaDeal> = {}): QuotaDeal[] {
  return Array.from({ length: count }, (_, index) => car({ id: `deal-${index}`, ...overrides }));
}

function atOffset(iso: string, deltaMs: number): string {
  return new Date(Date.parse(iso) + deltaMs).toISOString();
}

test('ten counting cars block an eleventh and an empty month allows a car', () => {
  const full = quotaUsage(period(), cars(MONTHLY_CAR_CAP));
  assert.equal(full.used, 10);
  assert.equal(full.remaining, 0);
  assert.equal(full.canAdd, false);
  assert.equal(full.reason, 'monthly_quota');
  assert.equal(full.priceUsd, MONTHLY_PRICE_USD);
  assert.equal(full.cap, 10);
  assert.equal(MONTHLY_PRICE_USD, 97);

  const empty = quotaUsage(period(), []);
  assert.equal(empty.used, 0);
  assert.equal(empty.remaining, 10);
  assert.equal(empty.canAdd, true);
  assert.equal(empty.reason, 'ok');
});

test('exactly ten cars block the next add', () => {
  const usage = quotaUsage(period(), cars(10));
  assert.equal(usage.canAdd, false);
  assert.equal(usage.used, 10);
});

test('a removal inside 30 minutes with no outreach refunds the slot', () => {
  const removed = car({ removedAt: atOffset(ADDED, 10 * 60 * 1000), endState: 'removed' });
  assert.equal(dealCountsTowardQuota(removed, period()), false);
  const usage = quotaUsage(period(), [...cars(9), removed]);
  assert.equal(usage.used, 9);
  assert.equal(usage.remaining, 1);
  assert.equal(usage.canAdd, true);
});

test('a removal at exactly 30 minutes still refunds', () => {
  const removed = car({
    removedAt: atOffset(ADDED, REMOVE_REFUND_WINDOW_MS),
    endState: 'removed',
  });
  assert.equal(dealCountsTowardQuota(removed, period()), false);
});

test('a removal after 30 minutes still counts', () => {
  const removed = car({
    removedAt: atOffset(ADDED, REMOVE_REFUND_WINDOW_MS + 1),
    endState: 'removed',
  });
  assert.equal(dealCountsTowardQuota(removed, period()), true);
  assert.equal(quotaUsage(period(), [removed]).used, 1);
});

test('outreach before a quick removal keeps the slot used', () => {
  for (const sentAt of [atOffset(ADDED, 5 * 60 * 1000), atOffset(ADDED, 10 * 60 * 1000)]) {
    const removed = car({
      removedAt: atOffset(ADDED, 10 * 60 * 1000),
      outreachSentAt: sentAt,
      endState: 'removed',
    });
    assert.equal(dealCountsTowardQuota(removed, period()), true);
  }
});

test('outreach that starts after the removal does not block the refund', () => {
  const removed = car({
    removedAt: atOffset(ADDED, 10 * 60 * 1000),
    outreachSentAt: atOffset(ADDED, 20 * 60 * 1000),
    endState: 'removed',
  });
  assert.equal(dealCountsTowardQuota(removed, period()), false);
});

test('sold and no-response give the slot back after outreach', () => {
  const sold = car({
    endState: 'sold',
    endedAt: '2026-10-12T12:00:00.000Z',
    outreachSentAt: atOffset(ADDED, 60 * 60 * 1000),
  });
  const quiet = car({
    id: 'quiet',
    endState: 'ended_no_response',
    endedAt: '2026-10-15T12:00:00.000Z',
    outreachSentAt: atOffset(ADDED, 60 * 60 * 1000),
  });
  assert.equal(dealCountsTowardQuota(sold, period()), false);
  assert.equal(dealCountsTowardQuota(quiet, period()), false);
  const usage = quotaUsage(period(), [...cars(9), sold, quiet]);
  assert.equal(usage.used, 9);
  assert.equal(usage.canAdd, true);
});

test('open cars count, including ones that already have outreach', () => {
  const contacted = car({ outreachSentAt: atOffset(ADDED, 60 * 1000) });
  assert.equal(dealCountsTowardQuota(contacted, period()), true);
});

test('cars from another billing period do not count', () => {
  const previous = cars(10, { addedAt: '2026-09-15T12:00:00.000Z' });
  const usage = quotaUsage(period(), previous);
  assert.equal(usage.used, 0);
  assert.equal(usage.canAdd, true);

  const started = car({ addedAt: period().periodStart });
  const nextPeriod = car({ id: 'next', addedAt: period().periodEnd });
  assert.equal(dealCountsTowardQuota(started, period()), true);
  assert.equal(dealCountsTowardQuota(nextPeriod, period()), false);
});

test('a canceled, expired, or missing subscription blocks new cars and leaves started deals alone', () => {
  for (const status of ['canceled', 'expired', 'none'] as const) {
    const deals = cars(2);
    const before = deals.map((deal) => deal.endState);
    const usage = quotaUsage(period(status), deals);
    assert.equal(usage.canAdd, false);
    assert.equal(usage.reason, 'subscription_inactive');
    assert.equal(usage.used, 2);
    assert.equal(usage.remaining, 8);
    assert.deepEqual(deals.map((deal) => deal.endState), before);
  }
});

test('a demo period is the current UTC month and is labeled demo', async () => {
  const now = new Date('2026-10-15T18:00:00.000Z');
  const demo = demoBillingPeriod(now);
  assert.equal(demo.status, 'active');
  assert.equal(demo.source, 'demo');
  assert.equal(demo.periodStart, '2026-10-01T00:00:00.000Z');
  assert.equal(demo.periodEnd, '2026-11-01T00:00:00.000Z');
  assert.equal(dealCountsTowardQuota(car({ addedAt: '2026-09-30T23:00:00.000Z' }), demo), false);
  assert.equal(dealCountsTowardQuota(car({ addedAt: '2026-10-02T00:00:00.000Z' }), demo), true);

  let called = false;
  const loaded = await loadBillingPeriod('shopper-1', {}, async () => {
    called = true;
    return { ok: true, json: async () => ({}) };
  }, now);
  assert.equal(called, false);
  assert.deepEqual(loaded, demo);
});

test('RevenueCat anchors the period and cancel blocks adds before the period ends', () => {
  const body = {
    subscriber: {
      subscriptions: {
        drevvy_monthly: {
          purchase_date: '2026-10-10T00:00:00.000Z',
          expires_date: '2026-11-10T00:00:00.000Z',
          unsubscribe_detected_at: null,
        },
        older: {
          purchase_date: '2026-08-10T00:00:00.000Z',
          expires_date: '2026-09-10T00:00:00.000Z',
          unsubscribe_detected_at: '2026-09-01T00:00:00.000Z',
        },
      },
    },
  };
  const active = billingPeriodFromRevenueCat(body, new Date('2026-10-20T00:00:00.000Z'));
  assert.equal(active.status, 'active');
  assert.equal(active.source, 'revenuecat');
  assert.equal(active.periodStart, '2026-10-10T00:00:00.000Z');
  assert.equal(active.periodEnd, '2026-11-10T00:00:00.000Z');
  assert.equal(quotaUsage(active, [car({ addedAt: '2026-10-09T00:00:00.000Z' })]).used, 0);
  assert.equal(quotaUsage(active, [car({ addedAt: '2026-10-10T00:00:00.000Z' })]).used, 1);

  const canceled = billingPeriodFromRevenueCat({
    subscriber: {
      subscriptions: {
        drevvy_monthly: {
          purchase_date: '2026-10-10T00:00:00.000Z',
          expires_date: '2026-11-10T00:00:00.000Z',
          unsubscribe_detected_at: '2026-10-12T00:00:00.000Z',
        },
      },
    },
  }, new Date('2026-10-20T00:00:00.000Z'));
  assert.equal(canceled.status, 'canceled');
  assert.equal(quotaUsage(canceled, []).canAdd, false);

  const expired = billingPeriodFromRevenueCat(body, new Date('2026-12-01T00:00:00.000Z'));
  assert.equal(expired.status, 'expired');
  assert.equal(billingPeriodFromRevenueCat({ subscriber: { subscriptions: {} } }, new Date()).status, 'none');
});

test('a RevenueCat failure does not grant a demo period', async () => {
  const failed = await loadBillingPeriod('shopper-1', { REVENUECAT_SECRET_API_KEY: 'secret' }, async () => {
    return { ok: false, json: async () => ({}) };
  }, new Date('2026-10-15T00:00:00.000Z'));
  assert.equal(failed.status, 'none');
  assert.equal(failed.source, 'revenuecat');
  assert.equal(quotaUsage(failed, []).canAdd, false);

  const thrown = await loadBillingPeriod('shopper-1', { REVENUECAT_SECRET_API_KEY: 'secret' }, async () => {
    throw new Error('network');
  }, new Date('2026-10-15T00:00:00.000Z'));
  assert.equal(thrown.status, 'none');
  assert.equal(thrown.source, 'revenuecat');
});
