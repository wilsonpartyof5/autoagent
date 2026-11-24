import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { unlockMarketAndSave } from '@/lib/shopper/market-save';
import { loadMarketIntelFromMarketCheck } from '@/lib/shopper/market-intel';
import { createMemoryMarketLookupGuard } from '@/lib/shopper/market-lookup-guard';
import type { SavedCarRepository, SavedCarRow } from '@/lib/shopper/saved-cars';

import { marketCheckStoredKeyCount, resetMarketCheckCacheForTests } from './cache-policy';
import { MarketCheckUpstreamError } from './mcp-client';
import {
  FAIR_PRICE_DAILY_CAP,
  FAIR_PRICE_NEGATIVE_TTL_MS,
  FAIR_PRICE_SOURCE,
  FAIR_PRICE_UPSTREAM_TTL_MS,
  PREMIUM_PRICE_TOOL,
  REST_BASE_PRICE_ENDPOINT,
  type FairPriceLoadOptions,
  FairPriceCappedError,
  fairPriceSpendEnabled,
  getMarketCheckPrice,
  loadFairPriceIfAllowed,
  readPremiumPrice,
  resetFairPriceGuardsForTests,
} from './price';
import { containsSecret } from './secrets';
import { resetMarketCheckUsageForTests } from './usage';

const HERE = dirname(fileURLToPath(import.meta.url));
const SECRET = 'test-marketcheck-key-do-not-ship';
const VIN = '1HGCM82633A004352';
const ZIP = '29720';
const PRICE_USER = 'shopper-price-test';
const ACTIVE_VIN = '1FTEW1EP5MFA00001';
const SECOND_VIN = '1FTEW1EP5MFA00002';
const RECENT_VIN = '1FTEW1EP5MFA00003';

function priceOptions(extra: FairPriceLoadOptions = {}): FairPriceLoadOptions {
  return { userId: PRICE_USER, ...extra };
}
const FIXTURE = JSON.parse(readFileSync(
  join(HERE, 'fixtures/predict-price-with-comparables.json'),
  'utf8',
)) as {
  success: boolean;
  data: {
    marketcheck_price: number;
    comparables: { listings: Array<Record<string, unknown>> };
    recent_comparables: { listings: Array<{ vin?: string }> };
  };
};

type FetchCall = { url: string; body: string };

test('the fair-price source is the premium tool, switched in code', () => {
  const source = readFileSync(join(HERE, 'price.ts'), 'utf8');
  assert.equal(FAIR_PRICE_SOURCE, 'mcp_premium_with_comparables');
  assert.match(source, /FAIR_PRICE_SOURCE: FairPriceSource = 'mcp_premium_with_comparables'/);
  assert.equal(source.includes('process.env.FAIR_PRICE_SOURCE'), false);
  assert.equal(/callMcpTool(?:<[^>]+>)?\(\s*'get_marketcheck_price'/.test(source), false);
  assert.match(source, /\$0\.09/);
  assert.match(source, /\$0\.07/);
});

test('the captured premium response maps the fair price and active comps only', () => {
  const parsed = readPremiumPrice(FIXTURE);
  assert.ok(parsed);
  assert.equal(parsed.price, 54926);
  assert.equal(parsed.comparables.length, 2);
  assert.equal(parsed.comparables[0]?.id, `${ACTIVE_VIN}-aaaabbbb-1111`);
  assert.equal(parsed.comparables[0]?.vin, ACTIVE_VIN);
  assert.equal(parsed.comparables[0]?.daysOnMarket, 239);
  assert.equal(parsed.comparables[1]?.id, `${SECOND_VIN}-ccccdddd-2222`);
  assert.equal(parsed.comparables[1]?.daysOnMarket, 29);
  assert.equal(parsed.comparables[1]?.price, 43776);
  const fixtureText = readFileSync(join(HERE, 'fixtures/predict-price-with-comparables.json'), 'utf8');
  assert.match(fixtureText, /example\.com/);
  assert.equal(fixtureText.includes('1GNSKSKD'), false);
  assert.equal(fixtureText.includes('lancastermotor'), false);
  assert.equal(fixtureText.includes('hendrick'), false);
  const recentOnly = FIXTURE.data.recent_comparables.listings.find((listing) => listing.vin === RECENT_VIN);
  assert.ok(recentOnly);
  assert.equal(parsed.comparables.some((comp) => comp.vin === RECENT_VIN), false);

  const days = readPremiumPrice({
    success: true,
    data: {
      marketcheck_price: 22000,
      comparables: {
        listings: [
          { id: 'dos-only', vin: '1hgcm82633a004352', price: 21000, dos_active: 7, dom: 40 },
          { id: 'dom-only', price: 23000, dom: 5 },
          { id: 'negative', price: -1, dom_active: 3 },
          { price: 24000, dom_active: 2 },
        ],
      },
    },
  });
  assert.deepEqual(days?.comparables, [
    { id: 'dos-only', vin: VIN, price: 21000, daysOnMarket: 7 },
    { id: 'dom-only', vin: null, price: 23000, daysOnMarket: 5 },
  ]);
  assert.equal(readPremiumPrice({ success: true, data: { marketcheck_price: -5, comparables: { listings: [] } } }), null);
  assert.equal(readPremiumPrice({ success: true, data: { price: 22000, comparables: { listings: [] } } }), null);
  assert.equal(readPremiumPrice({ success: true, data: { marketcheck_price: 22000 } }), null);
  assert.equal(readPremiumPrice({ success: false, data: { marketcheck_price: 22000, comparables: { listings: [] } } }), null);
  assert.equal(readPremiumPrice({ success: true, data: { marketcheck_price: Number.NaN, comparables: { listings: [] } } }), null);
});

test('one premium call returns the fair price and comps and does not search', async () => {
  const names: string[] = [];
  await withFetch((call) => {
    const tool = toolCall(call);
    names.push(tool?.name ?? call.url);
    assert.equal(tool?.name, PREMIUM_PRICE_TOOL);
    assert.deepEqual(tool?.arguments, {
      vin: VIN,
      miles: 30000,
      zip: ZIP,
      dealer_type: 'franchise',
    });
    return jsonRpc(FIXTURE);
  }, async (calls, logs) => {
    const first = await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions());
    const second = await getMarketCheckPrice({ vin: vinLower(), miles: 30000.4, zip: `${ZIP}-1234` }, Date.now, priceOptions());
    assert.equal(first?.price, 54926);
    assert.equal(first?.fromCache, false);
    assert.equal(first?.comparables?.length, 2);
    assert.equal(first?.comparables?.[1]?.daysOnMarket, 29);
    assert.equal(second?.fromCache, true);
    assert.equal(second?.price, 54926);
    assert.equal(second?.comparables?.length, 2);
    assert.equal(calls.length, 1);
    assert.equal(names.includes('search_active_cars'), false);
    assert.equal(marketCheckStoredKeyCount(), 1);
    const joined = logs.join('\n');
    assert.equal((joined.match(/"endpoint":"predict_price_with_comparables"/g) ?? []).length, 1);
    assert.equal(joined.includes(VIN), false);
    assert.equal(containsSecret(joined), false);
  });
});

test('a cached premium quote makes no further network call, including for comps', async () => {
  let calls = 0;
  await withFetch(() => {
    calls += 1;
    return jsonRpc(FIXTURE);
  }, async () => {
    await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions());
    const hit = await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions());
    assert.equal(hit?.fromCache, true);
    assert.equal(hit?.comparables?.length, 2);
    assert.equal(calls, 1);
  });
});

test('simultaneous premium quotes share one in-flight call', async () => {
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await withFetch(async () => {
    calls += 1;
    await gate;
    return jsonRpc(FIXTURE);
  }, async () => {
    const pending = Promise.all([
      getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions()),
      getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions()),
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    release();
    const [left, right] = await pending;
    assert.equal(left?.price, 54926);
    assert.equal(right?.comparables?.length, 2);
    assert.equal(calls, 1);
  });
});

test('an unknown price tool yields null and does not fall back to a listing search', async () => {
  const names: string[] = [];
  await withFetch((call) => {
    const tool = toolCall(call);
    names.push(tool?.name ?? 'other');
    return toolError('Unknown tool: get_marketcheck_price');
  }, async () => {
    const quote = await loadFairPriceIfAllowed('unlock_with_agent', {
      vin: VIN,
      miles: 30000,
      zip: ZIP,
      condition: 'used',
    }, priceOptions());
    assert.equal(quote, null);
    assert.deepEqual(names, [PREMIUM_PRICE_TOOL]);
    await assert.rejects(
      () => getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions({ strict: true })),
      (error: unknown) => error instanceof MarketCheckUpstreamError,
    );
    assert.equal(names.length, 1);
    assert.equal(names.includes('search_active_cars'), false);
    assert.equal(marketCheckStoredKeyCount(), 0);
  });
});

test('a negative or malformed premium price is not a quote and is not fetched again', async () => {
  let calls = 0;
  let nowMs = Date.parse('2026-11-22T12:00:00.000Z');
  await withFetch(() => {
    calls += 1;
    return jsonRpc({
      success: true,
      data: { marketcheck_price: -20, comparables: { listings: [] } },
    });
  }, async () => {
    const now = () => nowMs;
    assert.equal(await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, now, priceOptions()), null);
    assert.equal(await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, now, priceOptions()), null);
    assert.equal(calls, 1);
    assert.equal(marketCheckStoredKeyCount(), 0);
    nowMs += FAIR_PRICE_NEGATIVE_TTL_MS;
    assert.equal(await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, now, priceOptions()), null);
    assert.equal(calls, 2);
  });
});

test('the base-price selector calls REST and leaves comps to search', async () => {
  const names: string[] = [];
  await withFetch((call) => {
    assert.equal(call.body, '');
    const url = new URL(call.url);
    assert.equal(url.pathname, `/${REST_BASE_PRICE_ENDPOINT}`);
    assert.equal(url.pathname.includes('comparables'), false);
    assert.equal(url.searchParams.get('vin'), VIN);
    assert.equal(url.searchParams.get('miles'), '30000');
    assert.equal(url.searchParams.get('zip'), ZIP);
    assert.equal(url.searchParams.get('dealer_type'), 'independent');
    names.push(url.pathname);
    return new Response(JSON.stringify({ marketcheck_price: 25000, msrp: 30000 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }, async (_calls, logs) => {
    const quote = await getMarketCheckPrice({
      vin: VIN,
      miles: 30000,
      zip: ZIP,
      dealerType: 'independent',
    }, Date.now, priceOptions({ source: 'rest_base_plus_search' }));
    assert.equal(quote?.price, 25000);
    assert.equal(quote?.fromCache, false);
    assert.equal(quote?.comparables, undefined);
    assert.deepEqual(names, [`/${REST_BASE_PRICE_ENDPOINT}`]);
    const joined = logs.join('\n');
    assert.equal((joined.match(/"endpoint":"v2\/predict\/car\/us\/marketcheck_price"/g) ?? []).length, 1);
    assert.equal(joined.includes('predict_price_with_comparables'), false);
    assert.equal(joined.includes('search_active_cars'), false);
    assert.equal(containsSecret(joined), false);

    const again = await getMarketCheckPrice({
      vin: VIN,
      miles: 30000,
      zip: ZIP,
      dealerType: 'franchise',
    }, Date.now, priceOptions({ source: 'rest_base_plus_search' }));
    assert.equal(again?.fromCache, true);
    assert.equal(again?.comparables, undefined);
    assert.equal(names.length, 1);
  });

  resetMarketCheckCacheForTests();
  await withFetch(() => new Response(JSON.stringify({ marketcheck_price: -1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }), async () => {
    assert.equal(await getMarketCheckPrice({
      vin: VIN,
      miles: 12000,
      zip: ZIP,
    }, Date.now, priceOptions({ source: 'rest_base_plus_search' })), null);
  });
});

test('market intel uses the premium comps from one call and does not search', async () => {
  const names: string[] = [];
  const priced = premiumPayload();
  await withFetch((call) => respond(call, names, priced), async () => {
    const lookup = await loadMarketIntelFromMarketCheck({
      listingId: 'subject-listing',
      vin: null,
      profileZip: null,
      userId: PRICE_USER,
    });
    assert.equal(lookup.listingFound, true);
    assert.ok(lookup.intel);
    assert.equal(lookup.intel.fairVehiclePrice, 54926);
    assert.equal(lookup.intel.comparablesCount, 3);
    assert.equal(lookup.intel.lowPrice, 43972);
    assert.equal(lookup.intel.medianPrice, 44167);
    assert.equal(lookup.intel.highPrice, 45584);
    assert.equal(lookup.intel.daysListedMedian, 29);
    assert.equal(lookup.intel.priceDrops, 1);
    assert.equal(lookup.intel.isNewCar, false);
    assert.equal(lookup.intel.source, 'marketcheck');
    assert.equal(names.filter((name) => name === 'search_active_cars').length, 0);
    assert.equal(names.filter((name) => name === PREMIUM_PRICE_TOOL).length, 1);
    assert.equal(names.filter((name) => name === 'get_car_history').length, 1);
    assert.equal(names.filter((name) => name === 'listing_detail').length, 1);

    names.length = 0;
    const cached = await loadMarketIntelFromMarketCheck({
      listingId: 'subject-listing',
      vin: null,
      profileZip: null,
      userId: PRICE_USER,
    });
    assert.equal(cached.intel?.fairVehiclePrice, 54926);
    assert.equal(cached.intel?.comparablesCount, 3);
    assert.equal(names.includes(PREMIUM_PRICE_TOOL), false);
    assert.equal(names.includes('search_active_cars'), false);
  });
});

test('an unknown price tool refunds the key instead of saving a basic listing', async () => {
  const names: string[] = [];
  const repo = memoryRepo();
  await withFetch((call) => {
    if (call.url.includes('/v2/listing/car/')) {
      names.push('listing_detail');
      return json(listingPayload());
    }
    const tool = toolCall(call);
    names.push(tool?.name ?? 'other');
    return toolError('Unknown tool');
  }, async () => {
    const saved = await unlockMarketAndSave('shopper-1', { listingId: 'subject-listing' }, {
      repo,
      ownsDeal: async () => false,
      lookup: async () => null,
      now: new Date('2026-11-22T00:00:00.000Z'),
      supabase: memoryKeys(1),
      profileZip: async () => null,
      findUnlock: async () => null,
      lookupGuard: createMemoryMarketLookupGuard(),
      loadMarketIntel: loadMarketIntelFromMarketCheck,
    });
    assert.equal(saved.market, null);
    assert.equal(saved.spent, false);
    assert.equal(saved.unlocked, false);
    assert.equal(saved.available, false);
    assert.equal(saved.car, null);
    assert.equal(saved.credits.balance, 1);
    assert.equal(saved.reason, 'market_unavailable');
    assert.equal(repo.rows.length, 0);
    assert.equal(names.includes('search_active_cars'), false);
    assert.equal(names.includes(PREMIUM_PRICE_TOOL), true);
    assert.equal(names.includes('get_car_history'), false);
  });
});

test('spend stays off unless the env is exactly true, and then no price call is made', async () => {
  let calls = 0;
  await withFetch(() => {
    calls += 1;
    return jsonRpc(FIXTURE);
  }, async () => {
    const vehicle = { vin: VIN, miles: 30000, zip: ZIP, condition: 'used' as const };
    for (const value of [undefined, '', 'TRUE', '1', 'false', ' true', 'true ']) {
      if (value === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
      else process.env.FAIR_PRICE_SPEND_ENABLED = value;
      assert.equal(fairPriceSpendEnabled(), false);
      assert.equal(await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions()), null);
      assert.equal(await loadFairPriceIfAllowed('open_deal', vehicle, priceOptions({ purpose: 'deal' })), null);
      assert.equal(await loadFairPriceIfAllowed('unlock_with_agent', vehicle, priceOptions({ purpose: 'deal' })), null);
      assert.equal(await loadFairPriceIfAllowed('unlock_with_agent', vehicle, priceOptions({
        purpose: 'market_intel',
        strict: true,
      })), null);
    }
    const lookup = await loadMarketIntelFromMarketCheck({
      listingId: 'subject-listing',
      vin: null,
      profileZip: null,
      userId: PRICE_USER,
    });
    assert.equal(lookup.intel, null);
    assert.equal(calls, 0);

    process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
    assert.equal(await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }), null);
    assert.equal(calls, 0);
    const paid = await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions());
    assert.equal(paid?.price, 54926);
    assert.equal(calls, 1);
    delete process.env.FAIR_PRICE_SPEND_ENABLED;
    const fromCache = await getMarketCheckPrice({ vin: VIN, miles: 30000, zip: ZIP }, Date.now, priceOptions({ purpose: 'deal' }));
    assert.equal(fromCache?.price, 54926);
    assert.equal(fromCache?.fromCache, true);
    assert.equal(await getMarketCheckPrice({
      vin: VIN,
      miles: 30000,
      zip: ZIP,
    }, Date.now, priceOptions({ purpose: 'market_intel' })), null);
    assert.equal(calls, 1);
  }, { spend: false });
});

test('a shopper over the daily cap and a repeat upstream failure make no further price call', async () => {
  let calls = 0;
  let nowMs = Date.parse('2026-11-22T12:00:00.000Z');
  const now = () => nowMs;
  await withFetch(() => {
    calls += 1;
    if (calls === 1) return new Response('upstream', { status: 500 });
    return jsonRpc({
      success: true,
      data: { marketcheck_price: 25000, comparables: { listings: [] } },
    });
  }, async () => {
    const upstream = priceOptions({ userId: 'shopper-upstream', strict: true });
    await assert.rejects(
      () => getMarketCheckPrice({ vin: VIN, miles: 1, zip: ZIP }, now, upstream),
      (error: unknown) => error instanceof MarketCheckUpstreamError,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      () => getMarketCheckPrice({ vin: VIN, miles: 1, zip: ZIP }, now, upstream),
      (error: unknown) => error instanceof MarketCheckUpstreamError,
    );
    assert.equal(calls, 1);
    assert.equal(await getMarketCheckPrice({
      vin: VIN,
      miles: 1,
      zip: ZIP,
    }, now, priceOptions({ userId: 'shopper-upstream' })), null);
    assert.equal(calls, 1);
    nowMs += FAIR_PRICE_UPSTREAM_TTL_MS;
    const recovered = await getMarketCheckPrice({
      vin: VIN,
      miles: 1,
      zip: ZIP,
    }, now, priceOptions({ userId: 'shopper-upstream' }));
    assert.equal(recovered?.price, 25000);
    assert.equal(calls, 2);

    for (let miles = 1; miles <= FAIR_PRICE_DAILY_CAP; miles += 1) {
      const quote = await getMarketCheckPrice({ vin: VIN, miles, zip: '30301' }, now, priceOptions());
      assert.equal(quote?.price, 25000);
    }
    assert.equal(calls, FAIR_PRICE_DAILY_CAP + 2);
    const blocked = await getMarketCheckPrice({ vin: VIN, miles: 500, zip: '30301' }, now, priceOptions());
    assert.equal(blocked, null);
    assert.equal(calls, FAIR_PRICE_DAILY_CAP + 2);
    const hit = await getMarketCheckPrice({ vin: VIN, miles: 1, zip: '30301' }, now, priceOptions());
    assert.equal(hit?.fromCache, true);
    assert.equal(calls, FAIR_PRICE_DAILY_CAP + 2);
    const otherUser = await getMarketCheckPrice({
      vin: VIN,
      miles: 500,
      zip: '30301',
    }, now, priceOptions({ userId: 'shopper-other' }));
    assert.equal(otherUser?.price, 25000);
    nowMs = Date.parse('2026-11-23T00:00:00.000Z');
    const nextDay = await getMarketCheckPrice({ vin: VIN, miles: 501, zip: '30301' }, now, priceOptions());
    assert.equal(nextDay?.price, 25000);
  });
});

test('a strict cap or a missing shopper throws and does not block the next shopper', async () => {
  let calls = 0;
  const nowMs = Date.parse('2026-11-22T15:00:00.000Z');
  await withFetch(() => {
    calls += 1;
    return jsonRpc({
      success: true,
      data: { marketcheck_price: 25000, comparables: { listings: [] } },
    });
  }, async () => {
    await assert.rejects(
      () => getMarketCheckPrice({ vin: VIN, miles: 9, zip: '44114' }, () => nowMs, { strict: true }),
      (error: unknown) => error instanceof FairPriceCappedError,
    );
    assert.equal(calls, 0);
    for (let miles = 1; miles <= FAIR_PRICE_DAILY_CAP; miles += 1) {
      assert.ok(await getMarketCheckPrice({
        vin: VIN,
        miles,
        zip: '44114',
      }, () => nowMs, priceOptions({ userId: 'shopper-capped' })));
    }
    assert.equal(calls, FAIR_PRICE_DAILY_CAP);
    await assert.rejects(
      () => getMarketCheckPrice({
        vin: VIN,
        miles: 80,
        zip: '44114',
      }, () => nowMs, priceOptions({ userId: 'shopper-capped', strict: true })),
      (error: unknown) => error instanceof FairPriceCappedError,
    );
    assert.equal(calls, FAIR_PRICE_DAILY_CAP);
    const second = await getMarketCheckPrice({
      vin: VIN,
      miles: 80,
      zip: '44114',
    }, () => nowMs, priceOptions({ userId: 'shopper-next' }));
    assert.equal(second?.price, 25000);
    assert.equal(second?.fromCache, false);
    assert.equal(calls, FAIR_PRICE_DAILY_CAP + 1);
  });
});

test('market intel over the daily cap does not call the price tool', async () => {
  const names: string[] = [];
  const nowMs = Date.parse('2026-11-22T12:00:00.000Z');
  await withFetch((call) => {
    if (call.url.includes('/v2/listing/car/')) {
      names.push('listing_detail');
      return json(listingPayload());
    }
    const tool = toolCall(call);
    names.push(tool?.name ?? call.url);
    if (tool?.name === 'search_active_cars') throw new Error('comps search was called');
    if (tool?.name === PREMIUM_PRICE_TOOL) {
      return jsonRpc({
        success: true,
        data: { marketcheck_price: 25000, comparables: { listings: [] } },
      });
    }
    throw new Error(`unexpected call ${tool?.name ?? call.url}`);
  }, async () => {
    for (let miles = 1; miles <= FAIR_PRICE_DAILY_CAP; miles += 1) {
      assert.ok(await getMarketCheckPrice({ vin: VIN, miles, zip: '10001' }, () => nowMs, priceOptions()));
    }
    const priceCalls = names.filter((name) => name === PREMIUM_PRICE_TOOL).length;
    const lookup = await loadMarketIntelFromMarketCheck({
      listingId: 'subject-listing',
      vin: null,
      profileZip: null,
      userId: PRICE_USER,
      now: () => new Date(nowMs),
    });
    assert.equal(lookup.intel, null);
    assert.equal(names.filter((name) => name === PREMIUM_PRICE_TOOL).length, priceCalls);
    assert.equal(names.includes('search_active_cars'), false);
  });
});

function premiumPayload(): unknown {
  const payload = structuredClone(FIXTURE);
  payload.data.comparables.listings.push({
    id: 'subject-listing',
    vin: VIN,
    price: 99999,
    dom_active: 1,
  });
  payload.data.comparables.listings.push({
    id: 'extra-comp',
    vin: '2FTEW1EP5MFA00009',
    price: 47000,
    dom_active: 12,
  });
  return payload;
}

function listingPayload() {
  return {
    id: 'subject-listing',
    vin: VIN,
    price: 52900,
    msrp: 72620,
    miles: 30000,
    inventory_type: 'used',
    build: { year: 2023, make: 'Chevrolet', model: 'Tahoe', trim: 'Premier' },
    dealer: {
      name: 'Example Dealer',
      zip: ZIP,
      latitude: 34.92,
      longitude: -81.02,
      dealer_type: 'independent',
    },
  };
}

function respond(call: FetchCall, names: string[], priced: unknown): Response {
  if (call.url.includes('/v2/listing/car/')) {
    names.push('listing_detail');
    return json(listingPayload());
  }
  const tool = toolCall(call);
  names.push(tool?.name ?? call.url);
  if (tool?.name === 'search_active_cars') {
    throw new Error('comps search was called');
  }
  if (tool?.name === PREMIUM_PRICE_TOOL) {
    assert.equal(tool.arguments.dealer_type, 'independent');
    assert.equal(tool.arguments.vin, VIN);
    assert.equal(tool.arguments.miles, 30000);
    assert.equal(tool.arguments.zip, ZIP);
    return jsonRpc(priced);
  }
  if (tool?.name === 'get_car_history') {
    return jsonRpc([
      { price: 54000, first_seen_at: 10 },
      { price: 52900, first_seen_at: 20 },
    ]);
  }
  throw new Error(`unexpected call ${tool?.name ?? call.url}`);
}

function toolCall(call: FetchCall): { name: string; arguments: Record<string, unknown> } | null {
  if (!call.body) return null;
  try {
    const parsed = JSON.parse(call.body) as {
      method?: string;
      params?: { name?: string; arguments?: Record<string, unknown> };
    };
    if (parsed.method !== 'tools/call' || !parsed.params?.name) return null;
    return { name: parsed.params.name, arguments: parsed.params.arguments ?? {} };
  } catch {
    return null;
  }
}

function jsonRpc(payload: unknown): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function toolError(text: string): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { isError: true, content: [{ type: 'text', text }] },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function vinLower(): string {
  return VIN.toLowerCase();
}

async function withFetch(
  impl: (call: FetchCall) => Promise<Response> | Response,
  run: (calls: FetchCall[], logs: string[]) => Promise<void>,
  options?: { spend?: boolean },
) {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const previousSpend = process.env.FAIR_PRICE_SPEND_ENABLED;
  if (options?.spend === false) delete process.env.FAIR_PRICE_SPEND_ENABLED;
  else process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
  resetMarketCheckCacheForTests();
  resetFairPriceGuardsForTests();
  resetMarketCheckUsageForTests();
  const calls: FetchCall[] = [];
  const logs: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), body: String(init?.body ?? '') };
    calls.push(call);
    return impl(call);
  }) as typeof fetch;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  try {
    await run(calls, logs);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    if (previousSpend === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
    else process.env.FAIR_PRICE_SPEND_ENABLED = previousSpend;
  }
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
      rows.push(row);
      return row;
    },
    async remove() {
      return false;
    },
  };
}

function memoryKeys(balance: number): SupabaseClient {
  const row = { balance, lifetime_purchased: balance, lifetime_used: 0, lifetime_refunded: 0 };
  const keys = new Set<string>();
  const client = {
    rpc: async (fnName: string, params: { p_listing_id?: string }) => {
      if (fnName === 'consume_market_save_atomic') {
        const key = `use:market_save:${params.p_listing_id ?? ''}`;
        if (row.balance <= 0) {
          return { data: [{ consumed: false, already_consumed: false, balance: row.balance }], error: null };
        }
        keys.add(key);
        row.balance -= 1;
        row.lifetime_used += 1;
        return { data: [{ consumed: true, already_consumed: false, balance: row.balance }], error: null };
      }
      if (fnName === 'refund_unstored_market_save') {
        const spentKey = `use:market_save:${params.p_listing_id ?? ''}`;
        if (!keys.has(spentKey)) {
          return { data: [{ refunded: false, balance: row.balance }], error: null };
        }
        keys.delete(spentKey);
        row.balance += 1;
        row.lifetime_used = Math.max(0, row.lifetime_used - 1);
        row.lifetime_refunded += 1;
        return { data: [{ refunded: true, balance: row.balance }], error: null };
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
