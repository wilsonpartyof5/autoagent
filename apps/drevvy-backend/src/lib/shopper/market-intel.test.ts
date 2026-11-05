import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { DetailResponse } from '@/lib/marketcheck/mcp-adapter';

import {
  MARKET_INTEL_KEYS,
  computeMarketIntel,
  countPriceDrops,
  listingFactsFromDetail,
  marketIntelHasValue,
  presentMarketIntel,
  type CompFact,
  type ListingFacts,
  type MarketIntelSources,
} from './market-intel';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIN = '1GNSKCKD5RR123456';

test('market intelligence is the MarketCheck quote and other comps, with no invented fee', async () => {
  const source = readFileSync(join(HERE, 'market-intel.ts'), 'utf8');
  assert.equal(source.includes('0.92'), false);
  assert.equal(source.includes('1.03'), false);
  assert.equal(source.includes('3500'), false);
  assert.equal(source.includes('fairOtd'), false);
  assert.match(source, /unlock_with_agent/);

  const calls = { fair: 0, comps: 0, drops: 0 };
  const intel = await computeMarketIntel(
    { listingId: 'mc-listing-1', vin: VIN, profileZip: '62701' },
    sources(calls, {
      comps: [
        comp('mc-listing-1', VIN, 100, 1),
        comp('mc-other-1', '2GNSKCKD5RR123456', 28000, 10),
        comp('mc-other-2', '3GNSKCKD5RR123456', 29000, 20),
        comp('mc-other-3', '4GNSKCKD5RR123456', 30500, 30),
        comp('mc-other-4', '5GNSKCKD5RR123456', 33000, 40),
      ],
    }),
  );

  assert.ok(intel);
  assert.equal(intel.fairVehiclePrice, 30100);
  assert.equal(intel.comparablesCount, 4);
  assert.equal(intel.lowPrice, 28750);
  assert.equal(intel.medianPrice, 29750);
  assert.equal(intel.highPrice, 31125);
  assert.equal(intel.daysListedMedian, 25);
  assert.equal(intel.priceDrops, 1);
  assert.equal(intel.isNewCar, false);
  assert.equal(intel.source, 'marketcheck');
  assert.equal(Object.prototype.hasOwnProperty.call(intel, 'fairOtd'), false);
  assert.deepEqual(Object.keys(presentMarketIntel(intel)), [...MARKET_INTEL_KEYS]);
  assert.equal(JSON.stringify(intel).includes('dealerPhone'), false);
  assert.equal(calls.fair, 1);
  assert.equal(calls.comps, 1);
  assert.equal(calls.drops, 1);
  assert.equal(marketIntelHasValue(intel), true);
});

test('fewer than three other comps, a missing zip, or a placeholder listing has no value', async () => {
  const thin = tracker();
  const missing = await computeMarketIntel(
    { listingId: 'mc-listing-1', vin: VIN, profileZip: null },
    sources(thin, {
      comps: [
        comp('mc-other-1', '2GNSKCKD5RR123456', 28000, 10),
        comp('mc-other-2', '3GNSKCKD5RR123456', 29000, 20),
      ],
    }),
  );
  assert.equal(missing, null);
  assert.equal(thin.drops, 0);

  const noZip = tracker();
  const unpriced = await computeMarketIntel(
    { listingId: 'mc-listing-1', vin: VIN, profileZip: null },
    sources(noZip, { dealerZip: null }),
  );
  assert.equal(unpriced, null);
  assert.equal(noZip.fair, 0);

  const blank = await computeMarketIntel(
    { listingId: 'mc-listing-1', vin: VIN, profileZip: '62701' },
    sources(tracker(), { listing: null }),
  );
  assert.equal(blank, null);
});

test('a used car uses the dealer ZIP ahead of the profile ZIP', async () => {
  let pricedZip = '';
  await computeMarketIntel(
    { listingId: 'mc-listing-1', vin: VIN, profileZip: '60601' },
    sources(tracker(), {
      onFair: (zip) => {
        pricedZip = zip;
      },
    }),
  );
  assert.equal(pricedZip, '62704');

  let profileZip = '';
  await computeMarketIntel(
    { listingId: 'mc-listing-1', vin: VIN, profileZip: '60601-1234' },
    sources(tracker(), {
      dealerZip: null,
      onFair: (zip) => {
        profileZip = zip;
      },
    }),
  );
  assert.equal(profileZip, '60601');
});

test('a new car uses MSRP and the listed price and does not ask for a fair price', async () => {
  const calls = tracker();
  const intel = await computeMarketIntel(
    { listingId: 'mc-new-1', vin: null, profileZip: null },
    sources(calls, { condition: 'new', price: 37000, msrp: 40000, miles: null }),
  );
  assert.ok(intel);
  assert.equal(intel.isNewCar, true);
  assert.equal(intel.msrp, 40000);
  assert.equal(intel.listedPrice, 37000);
  assert.equal(intel.msrpDiscount, 3000);
  assert.equal(intel.fairVehiclePrice, null);
  assert.equal(intel.comparablesCount, 0);
  assert.equal(calls.fair, 0);
  assert.equal(calls.comps, 0);
  assert.equal(marketIntelHasValue(intel), true);

  const noMsrp = await computeMarketIntel(
    { listingId: 'mc-new-1', vin: null, profileZip: null },
    sources(tracker(), { condition: 'new', price: 37000, msrp: null }),
  );
  assert.equal(noMsrp, null);
});

test('an upstream failure is not a market value', async () => {
  await assert.rejects(
    () => computeMarketIntel(
      { listingId: 'mc-listing-1', vin: VIN, profileZip: '62701' },
      sources(tracker(), { fail: 'comps' }),
    ),
    /comps failed/,
  );
  await assert.rejects(
    () => computeMarketIntel(
      { listingId: 'mc-new-2', vin: null, profileZip: null },
      sources(tracker(), { condition: 'new', price: 37000, msrp: 40000, fail: 'drops' }),
    ),
    /history failed/,
  );
  assert.equal(countPriceDrops([]), null);
  assert.equal(countPriceDrops(null), null);
  assert.equal(countPriceDrops([
    { price: 32000, first_seen_at: 10 },
    { price: 31000, first_seen_at: 20 },
    { price: 31500, first_seen_at: 30 },
  ]), 1);
});

test('listing facts keep the market ZIP and drop dealer contact fields', () => {
  const facts = listingFactsFromDetail('mc-listing-1', detail());
  assert.equal(facts?.dealerZip, '62704');
  assert.equal(JSON.stringify(facts).includes('555-0100'), false);
  assert.equal(JSON.stringify(facts).includes('Secret Dealer'), false);
  assert.equal(listingFactsFromDetail('mc-listing-1', {
    ...detail(),
    make: 'Unknown',
    model: 'Vehicle',
  }), null);
});

function tracker() {
  return { fair: 0, comps: 0, drops: 0 };
}

function comp(id: string, vin: string, price: number, daysOnMarket: number): CompFact {
  return { id, vin, price, daysOnMarket };
}

function sources(
  calls: { fair: number; comps: number; drops: number },
  options: {
    listing?: ListingFacts | null;
    comps?: CompFact[];
    dealerZip?: string | null;
    condition?: 'new' | 'used';
    price?: number;
    msrp?: number | null;
    miles?: number | null;
    fail?: 'comps' | 'drops';
    onFair?: (zip: string) => void;
  } = {},
): MarketIntelSources {
  const listing = options.listing === undefined ? facts(options) : options.listing;
  return {
    listing: async () => listing,
    fairPrice: async (vehicle) => {
      calls.fair += 1;
      options.onFair?.(vehicle.zip);
      return { price: 30100 };
    },
    comparables: async () => {
      calls.comps += 1;
      if (options.fail === 'comps') throw new Error('comps failed');
      return options.comps ?? [
        comp('mc-other-1', '2GNSKCKD5RR123456', 28000, 10),
        comp('mc-other-2', '3GNSKCKD5RR123456', 29000, 20),
        comp('mc-other-3', '4GNSKCKD5RR123456', 30500, 30),
        comp('mc-other-4', '5GNSKCKD5RR123456', 33000, 40),
      ];
    },
    priceDrops: async () => {
      calls.drops += 1;
      if (options.fail === 'drops') throw new Error('history failed');
      return 1;
    },
  };
}

function facts(options: {
  dealerZip?: string | null;
  condition?: 'new' | 'used';
  price?: number;
  msrp?: number | null;
  miles?: number | null;
}): ListingFacts {
  return {
    id: 'mc-listing-1',
    vin: options.condition === 'new' ? null : VIN,
    year: 2021,
    make: 'Chevrolet',
    model: 'Tahoe',
    condition: options.condition ?? 'used',
    price: options.price ?? 32995,
    msrp: options.msrp === undefined ? 54000 : options.msrp,
    miles: options.miles === undefined ? 41000 : options.miles,
    latitude: 39.8,
    longitude: -89.6,
    dealerZip: options.dealerZip === undefined ? '62704' : options.dealerZip,
  };
}

function detail(): DetailResponse {
  return {
    id: 'mc-listing-1',
    vin: VIN,
    year: 2021,
    make: 'Chevrolet',
    model: 'Tahoe',
    condition: 'used',
    price: 32995,
    msrp: 54000,
    miles: 41000,
    location: {
      latitude: 39.8,
      longitude: -89.6,
      dealerName: 'Secret Dealer',
      dealerZip: '62704-1234',
      dealerPhone: '555-0100',
      dealerAddress: '1 Main St',
    },
    enrichedAt: '2026-11-05T00:00:00.000Z',
    partial: false,
    loadedSections: ['listing'],
  };
}
