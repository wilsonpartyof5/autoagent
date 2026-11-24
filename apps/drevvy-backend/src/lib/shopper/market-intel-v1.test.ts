import assert from 'node:assert/strict';
import test from 'node:test';

import type { FairPriceComp } from '@/lib/marketcheck/price';

import { MarketCheckUpstreamError } from '@/lib/marketcheck/mcp-client';
import { FAIR_PRICE_GLOBAL_DAILY_CAP, resetFairPriceGuardsForTests, tryConsumeFairPriceCall } from '@/lib/marketcheck/price';

import { toStoredMarketIntel } from './market-intel';
import {
  FAIR_BAND,
  HIGH_BAND,
  MARKET_INTEL_CALL_BUDGET,
  MIN_SHOW,
  buildMarketIntelV1,
  loadMarketIntelV1,
  resetMarketIntelUnlockCacheForTests,
  type IntelInputs,
  type Subject,
} from './market-intel-v1';

function subject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: 'mc-jeep-1',
    vin: '1C4HJXDG5LW123456',
    year: 2020,
    make: 'Jeep',
    model: 'Wrangler',
    trim: 'Limited',
    condition: 'used',
    price: 26724,
    miles: 83609,
    domActive: 40,
    dosActive: 12,
    refPrice: null,
    refPriceDate: null,
    dealerName: 'Example Jeep',
    dealerType: 'franchise',
    zip: '62701',
    latitude: null,
    longitude: null,
    ...overrides,
  };
}

function comp(id: string, price: number, miles: number | null): FairPriceComp {
  return {
    id,
    vin: null,
    price,
    daysOnMarket: 10,
    year: 2020,
    trim: 'Limited',
    miles,
    distanceMiles: 12,
    dealerName: null,
    vdpUrl: null,
  };
}

function inputs(partial: Partial<IntelInputs> = {}): IntelInputs {
  return {
    subject: subject(),
    fairPrice: null,
    usedComps: null,
    usedCompsRadius: null,
    newComps: null,
    newCompsRadius: null,
    cheaper: null,
    cheaperRadius: null,
    history: null,
    mds: null,
    recents: null,
    recentsRadius: null,
    neovin: null,
    incentives: null,
    today: new Date('2026-11-24T12:00:00Z'),
    ...partial,
  };
}

const JEEP_PRICES = [22000, 23000, 24000, 25000, 25500, 26000, 26500, 27000, 28000, 29000, 30000, 31000];

function jeepInputs(overrides: Partial<IntelInputs> = {}): IntelInputs {
  return inputs({
    fairPrice: {
      price: 25151,
      msrp: 51875,
      comparables: JEEP_PRICES.map((price, index) => comp(`c${index}`, price, 80000)),
    },
    cheaper: {
      num_found: 2,
      listings: [
        {
          id: 'cheap-1',
          vin: 'OTHERVIN000000001',
          price: 24000,
          miles: 70000,
          dist: 18,
          build: { year: 2020, make: 'Jeep', model: 'Wrangler', trim: 'Sport' },
        },
      ],
    },
    cheaperRadius: 80,
    mds: { mds: 45, total_active_cars_for_ymmt: 20, total_cars_sold_in_last_45_days: 9 },
    recents: {
      num_found: 8,
      stats: { price: { median: 24000, percentiles: { '25.0': 22000, '50.0': 24000, '75.0': 26000 } } },
    },
    ...overrides,
  });
}

function shownText(card: ReturnType<typeof buildMarketIntelV1>): string {
  return card.lines
    .filter((line) => line.shown)
    .map((line) => [line.text, line.detail].filter(Boolean).join(' '))
    .join('\n');
}

test('deal bands stay at the patch cutoffs', () => {
  assert.equal(FAIR_BAND, 0.03);
  assert.equal(HIGH_BAND, 0.08);
  assert.equal(MIN_SHOW, 3);
});

test('a mile-matched used car shows the deal score and the range', () => {
  const card = buildMarketIntelV1(jeepInputs());
  const deal = card.lines.find((line) => line.key === 'deal_score');
  assert.equal(deal?.shown, true);
  assert.equal(deal?.text, 'A bit high: $1,573 over the fair price');
  assert.match(deal?.detail ?? '', /Fair price \$25,151\./);
  assert.match(deal?.detail ?? '', /Most cars like this:/);
  assert.equal(card.similar?.mileMatched, true);
  assert.ok(card.similar?.low != null && card.similar?.high != null);

  const copy = shownText(card);
  assert.equal(/\bsold\b/i.test(copy), false);
  assert.equal(/days of supply/i.test(copy), false);
  assert.equal(copy.includes('%'), false);
  assert.match(copy, /About 45 days to sell\./);
  assert.match(copy, /These are not final sale prices\./);
  assert.match(copy, /It cost about \$51,875 new\. They ask \$26,724 now\./);
  assert.match(copy, /within 80 miles/);
  assert.equal(/discount|%\s*off|\boff\b|savings/i.test(copy), false);
});

test('the range stays hidden when the cars are not mile-matched', () => {
  const noMiles = buildMarketIntelV1(jeepInputs({ subject: subject({ miles: null }) }));
  assert.equal(noMiles.similar?.mileMatched, false);
  assert.equal(noMiles.similar?.low, null);
  assert.equal(noMiles.similar?.high, null);
  const hiddenDeal = noMiles.lines.find((line) => line.key === 'deal_score');
  assert.equal((hiddenDeal?.detail ?? '').includes('Most cars like this'), false);

  const farMiles = buildMarketIntelV1(jeepInputs({
    fairPrice: {
      price: 25151,
      msrp: 51875,
      comparables: JEEP_PRICES.map((price, index) => comp(`far${index}`, price, 10000)),
    },
  }));
  assert.equal(farMiles.similar?.mileMatched, false);
  assert.equal(farMiles.similar?.low, null);
  assert.equal(farMiles.similar?.high, null);
});

test('no fair price is not stored, so the key can be refunded', () => {
  const card = buildMarketIntelV1(jeepInputs({ fairPrice: null }));
  const deal = card.lines.find((line) => line.key === 'deal_score');
  assert.equal(deal?.shown, false);
  assert.equal(card.fairPrice, null);
  assert.equal(toStoredMarketIntel(card), null);
});

test('maker deals are real offers and each one says when it ends', () => {
  const card = buildMarketIntelV1(inputs({
    subject: subject({
      condition: 'new',
      price: 43000,
      miles: 12,
      model: 'Wrangler',
    }),
    newComps: {
      num_found: 4,
      listings: [40000, 42000, 44000, 46000].map((price, index) => ({
        vin: `NEWVIN${index}`,
        price,
        dom_active: 10,
      })),
    },
    neovin: { combined_msrp: 46000 },
    incentives: {
      listings: [{
        offer: {
          vehicles: [{ model: 'Wrangler', year: 2020 }],
          valid_through: '2026-12-31',
          offer_type: 'lease',
          titles: ['Holiday lease'],
          amounts: [{ monthly: 399, term: 36 }],
          due_at_signing: 2999,
        },
      }],
    },
  }));
  const deals = card.lines.find((line) => line.key === 'maker_deals');
  assert.equal(deals?.shown, true);
  assert.match(deals?.detail ?? '', /Ends Dec 31\./);
  assert.equal(card.similar?.mileMatched, false);
  assert.equal(card.similar?.low, null);
  const used = buildMarketIntelV1(jeepInputs());
  assert.equal(used.lines.find((line) => line.key === 'maker_deals')?.shown, false);
});

test('a new car talks about the typical asking price and never says fair', () => {
  const card = buildMarketIntelV1(inputs({
    subject: subject({ condition: 'new', price: 40000, miles: 8, model: 'Wrangler' }),
    newComps: {
      num_found: 4,
      listings: [42000, 44000, 46000, 48000].map((price, index) => ({
        vin: `NEWVIN${index}`,
        price,
        dom_active: 10,
      })),
    },
  }));
  const deal = card.lines.find((line) => line.key === 'deal_score');
  assert.equal(deal?.shown, true);
  assert.equal(deal?.title, 'Typical asking price');
  assert.match(deal?.text ?? '', /under the typical asking price/);
  assert.match(deal?.detail ?? '', /^Typical asking price /);
  const shown = card.lines.filter((line) => line.shown).map((line) => `${line.title} ${line.text} ${line.detail ?? ''}`).join('\n');
  assert.equal(/fair/i.test(shown), false);
  const used = buildMarketIntelV1(jeepInputs());
  assert.match(used.lines.find((line) => line.key === 'deal_score')?.text ?? '', /fair price/);
});

test('no fair price stops before more paid calls, and a retry does not pay again', async () => {
  const previous = process.env.FAIR_PRICE_SPEND_ENABLED;
  process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
  resetMarketIntelUnlockCacheForTests();
  const paths: string[] = [];
  const listing = {
    id: 'budget-used',
    vin: '1C4HJXDG5LW123456',
    price: 26724,
    miles: 83609,
    inventory_type: 'used',
    build: { year: 2020, make: 'Jeep', model: 'Wrangler', trim: 'Limited' },
    dealer: { zip: '28202' },
  };
  try {
    const get = async (path: string) => {
      paths.push(path);
      if (path.startsWith('listing/')) return listing;
      throw new Error(`unexpected ${path}`);
    };
    const first = await loadMarketIntelV1({
      listingId: 'budget-used',
      get: get as never,
      loadPrice: async () => null,
    });
    assert.equal(first.definitiveEmpty, true);
    assert.equal(first.upstreamRetry, false);
    assert.deepEqual(paths, ['listing/car/budget-used']);
    const second = await loadMarketIntelV1({
      listingId: 'budget-used',
      get: get as never,
      loadPrice: async () => { throw new Error('paid again'); },
    });
    assert.equal(second.definitiveEmpty, true);
    assert.deepEqual(paths, ['listing/car/budget-used']);
  } finally {
    resetMarketIntelUnlockCacheForTests();
    if (previous === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
    else process.env.FAIR_PRICE_SPEND_ENABLED = previous;
  }
});

test('a 402 is a retry, not an empty quote', async () => {
  const previous = process.env.FAIR_PRICE_SPEND_ENABLED;
  process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
  resetMarketIntelUnlockCacheForTests();
  try {
    const result = await loadMarketIntelV1({
      listingId: 'retry-used',
      get: async () => ({
        id: 'retry-used',
        vin: '1C4HJXDG5LW123456',
        price: 26724,
        miles: 83609,
        inventory_type: 'used',
        build: { year: 2020, make: 'Jeep', model: 'Wrangler' },
        dealer: { zip: '28202' },
      }),
      loadPrice: async () => {
        throw new MarketCheckUpstreamError('quota', 402);
      },
    });
    assert.equal(result.upstreamRetry, true);
    assert.equal(result.definitiveEmpty, false);
    assert.equal(result.card, null);
  } finally {
    resetMarketIntelUnlockCacheForTests();
    if (previous === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
    else process.env.FAIR_PRICE_SPEND_ENABLED = previous;
  }
});

test('one unlock stays inside the paid-call budget', () => {
  assert.equal(MARKET_INTEL_CALL_BUDGET, 12);
});

test('price calls stop at the process-wide daily ceiling', () => {
  resetFairPriceGuardsForTests();
  const now = Date.parse('2026-11-22T12:00:00.000Z');
  let allowed = 0;
  for (let user = 0; user < 15; user += 1) {
    for (let call = 0; call < 20; call += 1) {
      if (tryConsumeFairPriceCall(`ceiling-${user}`, now)) allowed += 1;
    }
  }
  assert.equal(allowed, FAIR_PRICE_GLOBAL_DAILY_CAP);
  assert.equal(tryConsumeFairPriceCall('ceiling-extra', now), false);
  resetFairPriceGuardsForTests();
});
