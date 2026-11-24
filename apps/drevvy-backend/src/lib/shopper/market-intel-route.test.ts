import assert from 'node:assert/strict';
import test from 'node:test';

import type { FairPriceComp } from '@/lib/marketcheck/price';

import { handleMarketIntelGet } from '../../app/api/consumer/listings/[id]/market-intel/route';

import { toStoredMarketIntel } from './market-intel';
import { buildMarketIntelV1, type IntelInputs, type Subject } from './market-intel-v1';

function request(authorization?: string): Request {
  return new Request('https://drevvy.test/api/consumer/listings/mc-listing-1/market-intel', {
    headers: authorization ? { authorization } : {},
  });
}

test('market intel read requires a shopper sign-in', async () => {
  const response = await handleMarketIntelGet(request(), 'mc-listing-1');
  assert.equal(response.status, 401);
  const body = await response.json() as { success: boolean; error: { code: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'unauthorized');
});

test('market intel read is unavailable when shopper auth is not configured', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    const response = await handleMarketIntelGet(request('Bearer shopper-jwt'), 'mc-listing-1');
    assert.equal(response.status, 503);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'service_unavailable');
  } finally {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test('market intel read rejects a bad listing id and a locked row', async () => {
  const auth = async () => ({ userId: 'shopper-1' });
  const bad = await handleMarketIntelGet(request(), 'no', { auth });
  assert.equal(bad.status, 400);

  const locked = await handleMarketIntelGet(request(), 'mc-listing-1', {
    auth,
    find: async () => null,
  });
  assert.equal(locked.status, 200);
  const lockedBody = await locked.json() as { data: { unlocked: boolean; market: unknown } };
  assert.equal(lockedBody.data.unlocked, false);
  assert.equal(lockedBody.data.market, null);

  const broken = await handleMarketIntelGet(request(), 'mc-listing-1', {
    auth,
    find: async () => {
      throw new Error('database down');
    },
  });
  assert.equal(broken.status, 500);
});

test('an unlocked row returns the v1 lines and does not spend a key', async () => {
  const subject: Subject = {
    id: 'mc-listing-1',
    vin: '1C4HJXDG5LW123456',
    year: 2020,
    make: 'Jeep',
    model: 'Wrangler',
    trim: 'Limited',
    condition: 'used',
    price: 26724,
    miles: 83609,
    domActive: 20,
    dosActive: 12,
    refPrice: null,
    refPriceDate: null,
    dealerName: null,
    dealerType: null,
    zip: '62701',
    latitude: null,
    longitude: null,
  };
  const prices = [22000, 23000, 24000, 25000, 25500, 26000, 26500, 27000, 28000, 29000, 30000, 31000];
  const comparables: FairPriceComp[] = prices.map((price, index) => ({
    id: `c${index}`,
    vin: null,
    price,
    daysOnMarket: 10,
    year: 2020,
    trim: 'Limited',
    miles: 80000,
    distanceMiles: 12,
    dealerName: null,
    vdpUrl: null,
  }));
  const input: IntelInputs = {
    subject,
    fairPrice: { price: 25151, msrp: 51875, comparables },
    usedComps: null,
    usedCompsRadius: null,
    newComps: null,
    newCompsRadius: null,
    cheaper: null,
    cheaperRadius: null,
    history: null,
    mds: { mds: 45, total_active_cars_for_ymmt: 20 },
    recents: {
      num_found: 8,
      stats: { price: { median: 24000, percentiles: { '25.0': 22000, '50.0': 24000, '75.0': 26000 } } },
    },
    recentsRadius: 100,
    neovin: null,
    incentives: null,
    today: new Date('2026-11-24T12:00:00Z'),
  };
  const stored = toStoredMarketIntel(buildMarketIntelV1(input));
  assert.ok(stored);
  const response = await handleMarketIntelGet(request(), 'mc-listing-1', {
    auth: async () => ({ userId: 'shopper-1' }),
    find: async () => ({
      listingId: 'mc-listing-1',
      vin: subject.vin,
      unlockedAt: '2026-11-24T12:00:00.000Z',
      market: stored!,
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    data: { unlocked: boolean; market: { v1?: { lines: { key: string; text?: string; shown: boolean }[] } } };
  };
  assert.equal(body.data.unlocked, true);
  const deal = body.data.market.v1?.lines.find((line) => line.key === 'deal_score');
  assert.equal(deal?.shown, true);
  assert.match(deal?.text ?? '', /fair price/);
  const copy = JSON.stringify(body.data.market.v1);
  assert.equal(/\bsold\b/i.test(copy), false);
  assert.equal(/days of supply/i.test(copy), false);
});
