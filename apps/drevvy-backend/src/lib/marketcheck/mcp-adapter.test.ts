import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { resetMarketCheckCacheForTests, marketCheckStoredKeyCount } from './cache-policy';
import { hashMarketCheckSubject, withMarketCheckContext } from './context';
import { lookupListingDealerIdentity } from '@/lib/dealer/rooftop-store';

import { marketCheckListingFromPayload } from './listing-car';
import { MarketCheckUpstreamError } from './mcp-client';
import { getVehicleDetailMcp, parseDetailSections, searchActiveCarsMcp, summarizeListingPhotos } from './mcp-adapter';
import { publicListingFromDetail, publicListingFromSearchVehicle } from '../public-discover/allowlist';
import { getMarketCheckPrice, resetFairPriceGuardsForTests } from './price';
import { containsSecret } from './secrets';
import { resetMarketCheckUsageForTests } from './usage';

const SECRET = 'test-marketcheck-key-do-not-ship';
const VIN = '1HGCM82633A004352';
const ZIP = '29730';

type FetchCall = { url: string; body: string };

function jsonRpc(payload: unknown): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function vinSearchPayload(id: string) {
  const payload = listingPayload('https://images.marketcheck.com/tahoe.jpg');
  payload.data.listings[0].id = id;
  payload.data.listings[0].dealer = {
    ...payload.data.listings[0].dealer,
    id: '1038994',
    website: 'https://dealer.example',
  } as typeof payload.data.listings[0]['dealer'];
  return payload;
}

function listingPayload(photo: string) {
  return {
    data: {
      num_found: 1,
      listings: [{
        id: 'listing-1',
        vin: VIN,
        price: 32000,
        miles: 41000,
        inventory_type: 'used',
        media: {
          photo_links: [`https://cdn.dealer.example/tahoe.jpg?api_key=${SECRET}`],
          photo_links_cached: [photo],
          primary_photo_url: photo,
        },
        build: { year: 2021, make: 'Honda', model: 'Accord', trim: 'EX', drivetrain: 'FWD' },
        dealer: {
          name: 'Example Dealer',
          city: 'Rock Hill',
          state: 'SC',
          latitude: 34.92,
          longitude: -81.02,
        },
      }],
    },
  };
}

async function withFetch(
  impl: (call: FetchCall, calls: FetchCall[]) => Promise<Response> | Response,
  run: (calls: FetchCall[], logs: string[], errors: string[]) => Promise<void>,
) {
  const calls: FetchCall[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), body: String(init?.body ?? '') };
    calls.push(call);
    return impl(call, calls);
  }) as typeof fetch;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  try {
    await run(calls, logs, errors);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
}

test('search results do not cache and never return the API key', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  process.env.DREVVY_PUBLIC_ORIGIN = 'https://app.example';
  resetMarketCheckCacheForTests();
  resetMarketCheckUsageForTests();
  const photo = `https://api.marketcheck.com/v2/image/cache/car/abc?api_key=${SECRET}`;

  await withFetch(() => jsonRpc(listingPayload(photo)), async (calls, logs) => {
    const params = {
      latitude: 34.924,
      longitude: -81.025,
      radiusMiles: 25,
      rows: 5,
      start: 0,
    };
    const first = await searchActiveCarsMcp(params);
    const second = await searchActiveCarsMcp(params);
    assert.equal(calls.length, 2);
    assert.equal(first.fromCache, false);
    assert.equal(second.fromCache, false);
    assert.equal(marketCheckStoredKeyCount(), 0);

    const serialized = JSON.stringify(first);
    assert.equal(containsSecret(serialized), false);
    assert.equal(serialized.includes('api_key'), false);
    assert.match(first.vehicles[0]?.thumbnailUrl ?? '', /^https:\/\/app\.example\/api\/inventory\/photo\?/);
    const photos = first.vehicles[0]?.photoUrls ?? [];
    assert.equal(photos.length > 0, true);
    assert.match(photos[0] ?? '', /^https:\/\/app\.example\/api\/inventory\/photo\?/);
    assert.equal(first.vehicles[0]?.primaryPhotoUrl, photos[0]);
    assert.equal(JSON.stringify(first).includes('cdn.dealer.example'), false);
    assert.equal(logs.some((line) => line.includes('"endpoint":"search_active_cars"') && line.includes('"count":1')), true);
    assert.equal(containsSecret(logs.join('\n')), false);
    assert.equal(calls[0]?.url.includes(SECRET), true);
  });
});

test('simultaneous identical searches share one upstream call', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  resetMarketCheckCacheForTests();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await withFetch(async () => {
    await gate;
    return jsonRpc(listingPayload('https://images.marketcheck.com/tahoe.jpg'));
  }, async (calls) => {
    const params = { latitude: 34.92, longitude: -81.02, radiusMiles: 10 };
    const pending = Promise.all([searchActiveCarsMcp(params), searchActiveCarsMcp(params)]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 1);
    release();
    const [left, right] = await pending;
    assert.equal(left.vehicles.length, 1);
    assert.equal(right.vehicles.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(marketCheckStoredKeyCount(), 0);
  });
});

test('listing detail skips VIN decode and history until those sections are opened', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  resetMarketCheckCacheForTests();
  resetMarketCheckUsageForTests();
  const tools: string[] = [];

  await withFetch((call) => {
    if (call.url.includes('/v2/decode/car/')) {
      tools.push('decode_vin_basic');
      assert.equal(call.url.includes('/neovin/'), false);
      assert.equal(call.url.includes('/specs'), true);
      return new Response(JSON.stringify({
        is_valid: true,
        engine: '2.0L I4',
        city_mpg: 30,
        highway_mpg: 38,
        std_seating: '5',
        drivetrain: 'FWD',
        transmission: 'Automatic',
        fuel_type: 'Unleaded',
        powertrain_type: 'Combustion',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const body = JSON.parse(call.body) as { params: { name: string } };
    tools.push(body.params.name);
    if (body.params.name === 'get_car_history') {
      return jsonRpc([{ first_seen_at: Math.floor(Date.now() / 1000) - 86400 * 12, price: 33000 }]);
    }
    assert.equal(body.params.name === 'decode_vin_neovin', false);
    assert.equal(body.params.name === 'get_marketcheck_price', false);
    return jsonRpc(listingPayload('https://images.marketcheck.com/tahoe.jpg'));
  }, async (_calls, logs) => {
    assert.equal(parseDetailSections(null)?.join(','), 'listing');
    assert.equal(parseDetailSections('vin,nope'), null);
    assert.deepEqual(parseDetailSections('history,vin'), ['history', 'vin']);

    const shell = await getVehicleDetailMcp('listing-1', VIN);
    assert.deepEqual(tools, ['search_active_cars']);
    assert.equal(shell?.engine, undefined);
    assert.equal(shell?.loadedSections?.includes('vin'), false);
    assert.equal(shell?.loadedSections?.includes('history'), false);

    tools.length = 0;
    const specs = await getVehicleDetailMcp('listing-1', VIN, ['vin']);
    assert.deepEqual(tools, ['decode_vin_basic']);
    assert.equal(specs?.engine, '2.0L I4');
    assert.equal(specs?.cityMpg, 30);
    assert.equal(specs?.highwayMpg, 38);
    assert.equal(specs?.seatingCapacity, 5);
    assert.equal(specs?.drivetrain, 'FWD');
    assert.equal(specs?.transmission, 'Automatic');
    assert.equal(specs?.fuelType, 'Unleaded');
    assert.equal(specs?.powertrainType, 'Combustion');
    assert.deepEqual(specs?.loadedSections, ['vin']);

    tools.length = 0;
    await getVehicleDetailMcp('listing-1', VIN, ['vin']);
    assert.deepEqual(tools, ['decode_vin_basic']);
    assert.equal(marketCheckStoredKeyCount(), 0);

    tools.length = 0;
    const history = await getVehicleDetailMcp('listing-1', VIN, ['history']);
    assert.deepEqual(tools, ['get_car_history']);
    assert.equal(typeof history?.daysOnMarket, 'number');

    const joined = logs.join('\n');
    assert.equal(joined.includes(VIN), false);
    assert.equal(joined.includes('"endpoint":"decode_vin_basic"'), true);
    assert.equal(joined.includes('"endpoint":"decode_vin_neovin"'), false);
    assert.equal(joined.includes('"endpoint":"get_marketcheck_price"'), false);
    assert.equal(joined.includes('"endpoint":"get_car_history"'), true);
    assert.equal(containsSecret(joined), false);
    assert.equal(containsSecret(JSON.stringify(shell)), false);
  });
});

test('a VIN search keeps MarketCheck listing id and never adopts the caller id', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  resetMarketCheckCacheForTests();

  await withFetch((call) => {
    const body = JSON.parse(call.body) as { params: { name: string; arguments: { vin?: string; listing_id?: string } } };
    assert.equal(body.params.name, 'search_active_cars');
    assert.equal(body.params.arguments.vin, VIN);
    assert.equal(body.params.arguments.listing_id, undefined);
    const payload = listingPayload('https://images.marketcheck.com/tahoe.jpg');
    payload.data.listings[0].id = 'mc-real-listing';
    return jsonRpc(payload);
  }, async () => {
    const detail = await getVehicleDetailMcp('caller-listing', VIN, ['listing']);
    assert.equal(detail?.id, 'mc-real-listing');
  });

  resetMarketCheckCacheForTests();
  await withFetch(() => {
    const payload = listingPayload('https://images.marketcheck.com/tahoe.jpg');
    payload.data.listings[0].id = '';
    return jsonRpc(payload);
  }, async () => {
    const detail = await getVehicleDetailMcp('caller-listing', VIN, ['listing']);
    assert.equal(detail?.id, '');
    assert.notEqual(detail?.id, 'caller-listing');
  });

  resetMarketCheckCacheForTests();
  await withFetch(() => jsonRpc(vinSearchPayload('mc-real-listing')), async () => {
    const found = await lookupListingDealerIdentity('caller-listing', VIN);
    assert.equal(found.status, 'found');
    if (found.status === 'found') assert.equal(found.identity.listingId, 'mc-real-listing');
  });

  resetMarketCheckCacheForTests();
  await withFetch(() => jsonRpc(vinSearchPayload('')), async () => {
    const found = await lookupListingDealerIdentity('caller-listing', VIN);
    assert.equal(found.status, 'found');
    if (found.status === 'found') assert.equal(found.identity.listingId, null);
  });
});

test('a listing id lookup uses GET /v2/listing/car and rejects a mismatched id', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  resetMarketCheckCacheForTests();
  const listing = {
    id: 'listing-1',
    vin: VIN,
    price: 32000,
    miles: 41000,
    inventory_type: 'used',
    media: { photo_links: ['https://images.marketcheck.com/tahoe.jpg'] },
    build: { year: 2021, make: 'Honda', model: 'Accord' },
    dealer: { name: 'Example Dealer', city: 'Rock Hill', state: 'SC', website: 'https://dealer.example' },
    vdp_url: 'https://dealer.example/vdp',
  };

  await withFetch((call) => {
    assert.match(call.url, /\/v2\/listing\/car\/listing-1\?/);
    assert.equal(call.url.includes('search'), false);
    assert.equal(call.body, '');
    return new Response(JSON.stringify(listing), { status: 200, headers: { 'content-type': 'application/json' } });
  }, async (_calls, logs) => {
    const detail = await getVehicleDetailMcp('listing-1', undefined, ['listing']);
    assert.equal(detail?.id, 'listing-1');
    assert.equal(detail?.vin, VIN);
    assert.equal(logs.join('\n').includes(SECRET), false);
    const found = await lookupListingDealerIdentity('listing-1');
    assert.equal(found.status, 'found');
    if (found.status === 'found') assert.equal(found.identity.listingId, 'listing-1');
  });

  resetMarketCheckCacheForTests();
  await withFetch(() => new Response(JSON.stringify({ ...listing, id: 'other-car' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }), async () => {
    const mismatched = await lookupListingDealerIdentity('listing-1');
    assert.equal(mismatched.status, 'unavailable');
    if (mismatched.status === 'unavailable') assert.equal(mismatched.reason, 'mismatch');
  });

  const decoded = marketCheckListingFromPayload({
    ...listing,
    heading: '2025%20Eagle%20Dennis%20Proview',
    exterior_color: '100%',
    build: { ...listing.build, make: 'Eagle%20Dennis' },
    photo_url: 'https://cdn.example/c%20d.jpg',
    media: { primary_photo_url: 'https://cdn.example/a%20b.jpg' },
  });
  assert.equal(decoded?.heading, '2025 Eagle Dennis Proview');
  assert.equal(decoded?.exterior_color, '100%');
  assert.equal((decoded?.build as { make?: string } | undefined)?.make, 'Eagle Dennis');
  assert.equal(decoded?.price, 32000);
  assert.equal((decoded?.media as { primary_photo_url?: string } | undefined)?.primary_photo_url, 'https://cdn.example/a%20b.jpg');
  assert.equal(decoded?.photo_url, 'https://cdn.example/c%20d.jpg');
  assert.equal(marketCheckListingFromPayload({ data: { listings: [listing] } })?.id, 'listing-1');
  assert.equal(marketCheckListingFromPayload(listing)?.id, 'listing-1');
});

test('a listing outage throws and a search outage stays an empty envelope', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  resetMarketCheckCacheForTests();
  await withFetch(() => new Response('upstream', { status: 500 }), async () => {
    await assert.rejects(
      () => getVehicleDetailMcp('listing-1', undefined, ['listing']),
      (error: unknown) => error instanceof MarketCheckUpstreamError,
    );
  });
  resetMarketCheckCacheForTests();
  await withFetch(() => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    throw abort;
  }, async () => {
    await assert.rejects(
      () => getVehicleDetailMcp('listing-1', undefined, ['listing']),
      (error: unknown) => error instanceof MarketCheckUpstreamError && /timed out/.test(error.message),
    );
  });
  resetMarketCheckCacheForTests();
  await withFetch(() => new Response('upstream', { status: 500 }), async () => {
    const empty = await searchActiveCarsMcp({ latitude: 34.9, longitude: -81.0, radiusMiles: 10 });
    assert.deepEqual(empty.vehicles, []);
    await assert.rejects(
      () => searchActiveCarsMcp({ latitude: 34.9, longitude: -81.0, radiusMiles: 10 }, { strict: true }),
      (error: unknown) => error instanceof MarketCheckUpstreamError && error.status === 500,
    );
    const previousSpend = process.env.FAIR_PRICE_SPEND_ENABLED;
    process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
    resetFairPriceGuardsForTests();
    try {
      await assert.rejects(
        () => getMarketCheckPrice({ vin: VIN, miles: 41000, zip: ZIP }, Date.now, {
          strict: true,
          userId: 'shopper-price-test',
        }),
        (error: unknown) => error instanceof MarketCheckUpstreamError,
      );
    } finally {
      if (previousSpend === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
      else process.env.FAIR_PRICE_SPEND_ENABLED = previousSpend;
    }
  });
});

test('usage logs can be grouped by a hashed shopper id without PII', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  resetMarketCheckUsageForTests();
  const userId = '11111111-1111-4111-8111-111111111111';
  await withFetch(() => jsonRpc(listingPayload('https://images.marketcheck.com/tahoe.jpg')), async (_calls, logs) => {
    await withMarketCheckContext({ origin: 'https://app.example', subject: userId }, () => (
      searchActiveCarsMcp({ latitude: 34.9, longitude: -81.0, radiusMiles: 15 })
    ));
    const entry = logs.find((line) => line.includes('"event":"marketcheck_call"'));
    assert.ok(entry);
    assert.equal(entry.includes(userId), false);
    assert.equal(entry.includes(hashMarketCheckSubject(userId)), true);
    assert.match(entry, /"endpoint":"search_active_cars"/);
    assert.match(entry, /"count":1/);
    assert.equal(containsSecret(entry), false);
  });
});

test('MarketCheck Price is cached for the same VIN and ZIP area', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const previousSpend = process.env.FAIR_PRICE_SPEND_ENABLED;
  process.env.FAIR_PRICE_SPEND_ENABLED = 'true';
  resetMarketCheckCacheForTests();
  resetFairPriceGuardsForTests();
  resetMarketCheckUsageForTests();
  let calls = 0;

  await withFetch((call) => {
    calls += 1;
    const body = JSON.parse(call.body) as { params: { name: string; arguments: { zip: string } } };
    assert.equal(body.params.name, 'predict_price_with_comparables');
    return jsonRpc({
      success: true,
      data: {
        marketcheck_price: body.params.arguments.zip === ZIP ? 30100 : 28000,
        comparables: { listings: [] },
      },
    });
  }, async (_calls, logs) => {
    const paid = { userId: 'shopper-price-test' };
    const first = await getMarketCheckPrice({ vin: VIN, miles: 41000, zip: `${ZIP}-1234` }, Date.now, paid);
    const second = await getMarketCheckPrice({ vin: VIN.toLowerCase(), miles: 41000, zip: ZIP }, Date.now, paid);
    const otherArea = await getMarketCheckPrice({ vin: VIN, miles: 41000, zip: '94105' }, Date.now, paid);
    assert.equal(first?.price, 30100);
    assert.equal(first?.fromCache, false);
    assert.equal(second?.fromCache, true);
    assert.equal(second?.price, 30100);
    assert.equal(otherArea?.fromCache, false);
    assert.equal(otherArea?.price, 28000);
    assert.equal(calls, 2);
    assert.equal(marketCheckStoredKeyCount(), 2);
    const joined = logs.join('\n');
    assert.equal(joined.includes(VIN), false);
    assert.equal(joined.includes(ZIP), false);
    assert.equal(joined.includes('"endpoint":"predict_price_with_comparables"'), true);
    assert.equal(joined.includes('get_marketcheck_price'), false);
    assert.equal(containsSecret(joined), false);
    assert.equal(containsSecret(JSON.stringify(first)), false);
  });
  if (previousSpend === undefined) delete process.env.FAIR_PRICE_SPEND_ENABLED;
  else process.env.FAIR_PRICE_SPEND_ENABLED = previousSpend;
});

test('upstream errors that echo the API key are redacted in logs', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  resetMarketCheckCacheForTests();
  await withFetch(() => {
    throw new Error(`connect failed https://api.marketcheck.com/mcp?api_key=${SECRET}`);
  }, async (_calls, _logs, errors) => {
    const result = await searchActiveCarsMcp({ latitude: 34.9, longitude: -81.0, radiusMiles: 10 });
    assert.deepEqual(result.vehicles, []);
    const joined = errors.join('\n');
    assert.equal(containsSecret(joined), false);
    assert.match(joined, /\[redacted\]/);
    assert.equal(joined.includes(SECRET), false);
  });
});

test('http dealer photo_links upgrade, and a dropped gallery falls back to cached or primary', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  process.env.DREVVY_PUBLIC_ORIGIN = 'https://app.example';
  resetMarketCheckCacheForTests();
  const vin = '3N6CM0KN2GK693924';
  const lot = {
    name: 'Example Independent Lot',
    city: 'Charlotte',
    state: 'NC',
    phone: '704-555-0148',
    website: 'http://example-lot.test',
    latitude: 35.006611,
    longitude: -80.946295,
  };
  const origin = { latitude: 35.0071, longitude: -80.9398 };
  const listings = [
    {
      id: 'nv200-http',
      vin,
      price: 12995,
      miles: 87000,
      inventory_type: 'used',
      vdp_url: 'http://example-lot.test/vdp/nv200',
      build: { year: 2016, make: 'Nissan', model: 'NV200' },
      dealer: lot,
      media: {
        photo_links: [
          'http://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg',
          'http://images.example-cdn.test/3N6CM0KN2GK693924/2.jpg',
        ],
        photo_links_cached: ['https://marketcheck-prod.apigee.net/v2/image/cache/car/nv200-1'],
        primary_photo_url: 'http://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg',
      },
    },
    {
      id: 'nv200-cached',
      vin: '3N6CM0KN2GK693925',
      price: 11995,
      miles: 91000,
      inventory_type: 'used',
      build: { year: 2016, make: 'Nissan', model: 'NV200' },
      dealer: lot,
      media: {
        photo_links: [`http://images.example-cdn.test/secret.jpg?api_key=${SECRET}`],
        photo_links_cached: ['https://images.marketcheck.com/vehicles/nv200-cached.jpg'],
        primary_photo_url: `http://images.example-cdn.test/secret.jpg?api_key=${SECRET}`,
      },
    },
    {
      id: 'cdn-https',
      vin: '3N6CM0KN2GK693926',
      price: 14995,
      miles: 64000,
      inventory_type: 'used',
      build: { year: 2018, make: 'Nissan', model: 'NV200' },
      dealer: { ...lot, latitude: 35.08, longitude: -80.9 },
      media: {
        photo_links: [
          'https://images.carsforsale.com/nv200/1.jpg',
          'https://images.autodealersdigital.com/nv200/2.jpg',
          'https://images.inventoryrsc.com/nv200/3.jpg',
        ],
      },
    },
    {
      id: 'photo-url-only',
      vin: '3N6CM0KN2GK693927',
      price: 9995,
      miles: 99000,
      inventory_type: 'used',
      build: { year: 2015, make: 'Nissan', model: 'NV200' },
      dealer: lot,
      photo_url: 'http://images.example-cdn.test/only-photo-url.jpg',
      media: {
        photo_links: 'http://images.example-cdn.test/tracked.jpg?utm_source=lot',
      },
    },
    {
      id: 'photo-string',
      vin: '3N6CM0KN2GK693928',
      price: 10995,
      miles: 80000,
      inventory_type: 'used',
      build: { year: 2016, make: 'Nissan', model: 'NV200' },
      dealer: lot,
      media: { photo_links: 'http://images.example-cdn.test/single.jpg' },
    },
    {
      id: 'no-photos',
      vin: '3N6CM0KN2GK693929',
      price: 8995,
      miles: 120000,
      inventory_type: 'used',
      build: { year: 2014, make: 'Nissan', model: 'NV200' },
      dealer: lot,
      media: {},
    },
  ];

  await withFetch(() => jsonRpc({ data: { num_found: listings.length, listings } }), async (calls) => {
    const found = await searchActiveCarsMcp({
      latitude: origin.latitude,
      longitude: origin.longitude,
      radiusMiles: 50,
      rows: 20,
      start: 0,
    });
    assert.equal(calls.length, 1);
    const byId = new Map(found.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    assert.deepEqual(byId.get('nv200-http')?.photoUrls, [
      'https://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg',
      'https://images.example-cdn.test/3N6CM0KN2GK693924/2.jpg',
    ]);
    assert.equal(byId.get('nv200-http')?.primaryPhotoUrl, 'https://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg');
    assert.deepEqual(byId.get('nv200-cached')?.photoUrls, ['https://images.marketcheck.com/vehicles/nv200-cached.jpg']);
    assert.equal(byId.get('photo-url-only')?.photoUrls?.[0], 'https://images.example-cdn.test/only-photo-url.jpg');
    assert.deepEqual(byId.get('photo-string')?.photoUrls, ['https://images.example-cdn.test/single.jpg']);
    assert.equal(byId.get('no-photos')?.photoUrls, undefined);
    assert.equal(byId.get('no-photos')?.primaryPhotoUrl, undefined);

    const publicListings = found.vehicles.map((vehicle) => publicListingFromSearchVehicle(vehicle, origin));
    const publicById = new Map(publicListings.map((listing) => [listing?.id, listing]));
    assert.deepEqual(publicById.get('nv200-http')?.media.photo_links, [
      'https://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg',
      'https://images.example-cdn.test/3N6CM0KN2GK693924/2.jpg',
    ]);
    assert.deepEqual(publicById.get('nv200-cached')?.media.photo_links, [
      'https://images.marketcheck.com/vehicles/nv200-cached.jpg',
    ]);
    assert.deepEqual(publicById.get('cdn-https')?.media.photo_links, [
      'https://images.carsforsale.com/nv200/1.jpg',
      'https://images.autodealersdigital.com/nv200/2.jpg',
      'https://images.inventoryrsc.com/nv200/3.jpg',
    ]);
    assert.deepEqual(publicById.get('no-photos')?.media.photo_links, []);
    const json = JSON.stringify(publicListings);
    assert.equal(json.includes('http://'), false);
    assert.equal(json.includes('Example Independent'), false);
    assert.equal(json.includes('704-555-0148'), false);
    assert.equal(json.includes('example-lot.test'), false);
    assert.equal(json.includes('vdp'), false);
    assert.equal(json.includes('api_key'), false);
    assert.equal(json.includes('photo_links_cached'), false);
    assert.equal(containsSecret(json), false);
  });

  resetMarketCheckCacheForTests();
  await withFetch(() => new Response(JSON.stringify({
    id: 'nv200-detail',
    vin,
    price: 12995,
    miles: 87000,
    inventory_type: 'used',
    vdp_url: 'http://example-lot.test/vdp/nv200',
    build: { year: 2016, make: 'Nissan', model: 'NV200' },
    dealer: lot,
    media: {
      photo_links: ['http://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg'],
      primary_photo_url: 'http://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg',
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } }), async () => {
    const detail = await getVehicleDetailMcp('nv200-detail', undefined, ['listing']);
    assert.deepEqual(detail?.photoUrls, ['https://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg']);
    const listing = detail ? publicListingFromDetail(detail) : null;
    assert.deepEqual(listing?.media.photo_links, ['https://images.example-cdn.test/3N6CM0KN2GK693924/1.jpg']);
    const json = JSON.stringify(listing);
    assert.equal(json.includes('704-555-0148'), false);
    assert.equal(json.includes('example-lot.test'), false);
    assert.equal(json.includes('Example Independent'), false);
    assert.equal(json.includes('http://'), false);
  });
});

function photoLogId(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 12);
}

test('listing photo logs are counts only, and a coming-soon file is dropped', async () => {
  const counts = summarizeListingPhotos({
    media: {
      photo_links: [
        'javascript:alert(1)',
        'https://user:pass@cdn.example.test/a.jpg',
        `https://cdn.example.test/a.jpg?api_key=${SECRET}`,
        { url: 'https://cdn.example.test/obj.jpg' },
      ],
      photo_links_cached: ['https://cdn.example.test/ok.jpg'],
      primary_photo_url: 'https://cdn.example.test/comingsoon.jpg',
    },
  });
  assert.equal(counts.photoLinks, 4);
  assert.equal(counts.photoLinksCached, 1);
  assert.equal(counts.primary, 1);
  assert.equal(counts.kept, 1);
  assert.deepEqual(counts.rejected, { scheme: 1, host: 1, query: 1, other: 2 });
  assert.equal(counts.kept + counts.rejected.scheme + counts.rejected.host + counts.rejected.query + counts.rejected.other, 6);
  assert.equal(JSON.stringify(counts).includes('cdn.example'), false);
  assert.equal(JSON.stringify(counts).includes(SECRET), false);
  assert.equal(JSON.stringify(counts).includes('comingsoon'), false);

  process.env.MARKETCHECK_API_KEY = SECRET;
  process.env.DREVVY_PUBLIC_ORIGIN = 'https://app.example';
  resetMarketCheckCacheForTests();
  const origin = { latitude: 35.0071, longitude: -80.9398 };
  const dealer = {
    name: 'Example Independent Lot',
    city: 'Charlotte',
    state: 'NC',
    phone: '704-555-0148',
    website: 'http://example-lot.test',
    latitude: 35.006611,
    longitude: -80.946295,
  };
  const listings = [
    {
      id: 'photo-empty',
      vin: '1N4AL3AP8JC100001',
      price: 9000,
      miles: 80000,
      inventory_type: 'used',
      build: { year: 2016, make: 'Nissan', model: 'NV200' },
      dealer,
      media: {},
    },
    {
      id: 'photo-soon',
      vin: '1N4AL3AP8JC100002',
      price: 9100,
      miles: 81000,
      inventory_type: 'used',
      build: { year: 2016, make: 'Nissan', model: 'NV200' },
      dealer,
      media: { photo_links: ['https://images.example-cdn.test/comingsoon.jpg'] },
    },
    {
      id: 'photo-real',
      vin: '1N4AL3AP8JC100003',
      price: 9200,
      miles: 82000,
      inventory_type: 'used',
      build: { year: 2016, make: 'Nissan', model: 'NV200' },
      dealer,
      media: {
        photo_links: [
          'https://images.example-cdn.test/coming-soon.png',
          'https://images.carsforsale.com/nv200/1.jpg',
        ],
      },
    },
  ];

  await withFetch(() => jsonRpc({ data: { num_found: listings.length, listings } }), async (_calls, logs) => {
    const found = await searchActiveCarsMcp({
      latitude: origin.latitude,
      longitude: origin.longitude,
      radiusMiles: 50,
      rows: 20,
    });
    const publicById = new Map(
      found.vehicles.map((vehicle) => [vehicle.id, publicListingFromSearchVehicle(vehicle, origin)]),
    );
    assert.deepEqual(publicById.get('photo-empty')?.media.photo_links, []);
    assert.deepEqual(publicById.get('photo-soon')?.media.photo_links, []);
    assert.deepEqual(publicById.get('photo-real')?.media.photo_links, ['https://images.carsforsale.com/nv200/1.jpg']);

    const photoLogs = logs
      .filter((line) => line.includes('"event":"mc_listing_photos"'))
      .map((line) => JSON.parse(line) as {
        source: string;
        id: string;
        photoLinks: number;
        kept: number;
        rejected: { scheme: number; host: number; query: number; other: number };
      });
    assert.equal(photoLogs.length, 3);
    const soon = photoLogs.find((row) => row.id === photoLogId('photo-soon'));
    assert.ok(soon);
    assert.equal(soon.source, 'search');
    assert.equal(soon.photoLinks, 1);
    assert.equal(soon.kept, 0);
    assert.equal(soon.rejected.other, 1);
    const empty = photoLogs.find((row) => row.id === photoLogId('photo-empty'));
    assert.equal(empty?.photoLinks, 0);
    assert.equal(empty?.kept, 0);
    const real = photoLogs.find((row) => row.id === photoLogId('photo-real'));
    assert.equal(real?.photoLinks, 2);
    assert.equal(real?.kept, 1);
    assert.equal(real?.rejected.other, 1);
    const joined = photoLogs.map((row) => JSON.stringify(row)).join('\n');
    assert.equal(joined.includes('example-cdn'), false);
    assert.equal(joined.includes('carsforsale'), false);
    assert.equal(joined.includes('comingsoon'), false);
    assert.equal(joined.includes('coming-soon'), false);
    assert.equal(joined.includes('photo-soon'), false);
    assert.equal(joined.includes('1N4AL3AP'), false);
    assert.equal(joined.includes(SECRET), false);
    assert.equal(containsSecret(joined), false);
  });

  resetMarketCheckCacheForTests();
  await withFetch(() => new Response(JSON.stringify({
    id: 'photo-soon',
    vin: '1N4AL3AP8JC100002',
    price: 9100,
    miles: 81000,
    inventory_type: 'used',
    build: { year: 2016, make: 'Nissan', model: 'NV200' },
    dealer,
    media: { photo_links: ['http://images.example-cdn.test/coming_soon.webp'] },
  }), { status: 200, headers: { 'content-type': 'application/json' } }), async (_calls, logs) => {
    const detail = await getVehicleDetailMcp('photo-soon', undefined, ['listing']);
    assert.equal(detail?.photoUrls, undefined);
    const listing = detail ? publicListingFromDetail(detail) : null;
    assert.deepEqual(listing?.media.photo_links, []);
    const photoLogs = logs
      .filter((line) => line.includes('"event":"mc_listing_photos"'))
      .map((line) => JSON.parse(line) as { source: string; id: string; photoLinks: number; kept: number; rejected: { other: number } });
    assert.equal(photoLogs.length, 1);
    assert.equal(photoLogs[0]?.source, 'detail');
    assert.equal(photoLogs[0]?.id, photoLogId('photo-soon'));
    assert.equal(photoLogs[0]?.photoLinks, 1);
    assert.equal(photoLogs[0]?.kept, 0);
    assert.equal(photoLogs[0]?.rejected.other, 1);
    const joined = JSON.stringify(photoLogs[0]);
    assert.equal(joined.includes('example-cdn'), false);
    assert.equal(joined.includes('coming'), false);
    assert.equal(joined.includes('photo-soon'), false);
    assert.equal(containsSecret(joined), false);
  });
});
