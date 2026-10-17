import assert from 'node:assert/strict';
import test from 'node:test';

import { resetMarketCheckCacheForTests, marketCheckStoredKeyCount } from './cache-policy';
import { hashMarketCheckSubject, withMarketCheckContext } from './context';
import { getVehicleDetailMcp, parseDetailSections, searchActiveCarsMcp } from './mcp-adapter';
import { getMarketCheckPrice } from './price';
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
    assert.equal(first.vehicles[0]?.photoUrls?.[0], 'https://cdn.dealer.example/tahoe.jpg');
    assert.equal(first.vehicles[0]?.primaryPhotoUrl, 'https://cdn.dealer.example/tahoe.jpg');
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
  resetMarketCheckCacheForTests();
  resetMarketCheckUsageForTests();
  let calls = 0;

  await withFetch((call) => {
    calls += 1;
    const body = JSON.parse(call.body) as { params: { name: string; arguments: { zip: string } } };
    assert.equal(body.params.name, 'get_marketcheck_price');
    return jsonRpc({ data: { marketcheck_price: body.params.arguments.zip === ZIP ? 30100 : 28000 } });
  }, async (_calls, logs) => {
    const first = await getMarketCheckPrice({ vin: VIN, miles: 41000, zip: `${ZIP}-1234` });
    const second = await getMarketCheckPrice({ vin: VIN.toLowerCase(), miles: 41000, zip: ZIP });
    const otherArea = await getMarketCheckPrice({ vin: VIN, miles: 41000, zip: '94105' });
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
    assert.equal(joined.includes('"endpoint":"get_marketcheck_price"'), true);
    assert.equal(containsSecret(joined), false);
    assert.equal(containsSecret(JSON.stringify(first)), false);
  });
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
