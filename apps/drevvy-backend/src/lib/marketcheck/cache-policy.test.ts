import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MARKETCHECK_CACHE_POLICY,
  MARKETCHECK_CACHE_TTL_MS,
  loadMarketCheck,
  marketCheckPriceCacheKey,
  marketCheckStoredKeyCount,
  resetMarketCheckCacheForTests,
  zipArea,
} from './cache-policy';

const policySource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'cache-policy.ts'), 'utf8');

test('cache policy cites the MarketCheck sales terms and the 24 hour limit', () => {
  assert.match(policySource, /must not be cached or stored/);
  assert.match(policySource, /dealership inventory syndication/);
  assert.match(policySource, /incentives API/);
  assert.match(policySource, /MarketCheck Price/);
  assert.match(policySource, /24 hours/);
  assert.equal(MARKETCHECK_CACHE_TTL_MS, 24 * 60 * 60 * 1000);
});

test('only syndication, incentives, and fair price may be cached', () => {
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.search_active_cars, { allowed: false, ttlMs: 0 });
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.listing_detail, { allowed: false, ttlMs: 0 });
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.decode_vin_basic, { allowed: false, ttlMs: 0 });
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.decode_vin_neovin, { allowed: false, ttlMs: 0 });
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.get_car_history, { allowed: false, ttlMs: 0 });
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.dealership_inventory, { allowed: true, ttlMs: MARKETCHECK_CACHE_TTL_MS });
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.incentives, { allowed: true, ttlMs: MARKETCHECK_CACHE_TTL_MS });
  assert.deepEqual(MARKETCHECK_CACHE_POLICY.marketcheck_price, { allowed: true, ttlMs: MARKETCHECK_CACHE_TTL_MS });
});

test('fair price cache key is VIN, ZIP area, and miles', () => {
  assert.equal(zipArea('29730-1234'), '29730');
  assert.equal(marketCheckPriceCacheKey('1hgcm82633a004352', '29730-1234', 41200.4), '1HGCM82633A004352|29730|41200');
});

test('non-cacheable endpoints are not stored and in-flight duplicates share one call', async () => {
  resetMarketCheckCacheForTests();
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const load = () => loadMarketCheck('search_active_cars', 'same', async () => {
    calls += 1;
    await gate;
    return { ok: true };
  });

  const pending = Promise.all([load(), load()]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  const [first, second] = await pending;
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, false);
  assert.equal(marketCheckStoredKeyCount(), 0);

  await loadMarketCheck('search_active_cars', 'same', async () => {
    calls += 1;
    return { ok: true };
  });
  assert.equal(calls, 2);
  assert.equal(marketCheckStoredKeyCount(), 0);
});

test('a failed non-cacheable call is not reused', async () => {
  resetMarketCheckCacheForTests();
  let calls = 0;
  const load = () => loadMarketCheck('decode_vin_neovin', 'vin', async () => {
    calls += 1;
    throw new Error('upstream');
  });
  await assert.rejects(load(), /upstream/);
  await assert.rejects(load(), /upstream/);
  assert.equal(calls, 2);
  assert.equal(marketCheckStoredKeyCount(), 0);
});

test('fair price stays cached for 24 hours and expires after that', async () => {
  resetMarketCheckCacheForTests();
  let now = 1_000;
  let calls = 0;
  const load = () => loadMarketCheck('marketcheck_price', 'VIN|29730|1000', async () => {
    calls += 1;
    return { price: 24000 };
  }, () => now);

  const first = await load();
  const second = await load();
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(second.value.price, 24000);
  assert.equal(calls, 1);
  assert.equal(marketCheckStoredKeyCount(), 1);

  now += MARKETCHECK_CACHE_TTL_MS;
  const expired = await load();
  assert.equal(expired.fromCache, false);
  assert.equal(calls, 2);
});

test('a null fair-price result is not stored', async () => {
  resetMarketCheckCacheForTests();
  let calls = 0;
  const load = () => loadMarketCheck('marketcheck_price', 'missing', async () => {
    calls += 1;
    return null;
  });
  assert.equal((await load()).fromCache, false);
  assert.equal((await load()).fromCache, false);
  assert.equal(calls, 2);
  assert.equal(marketCheckStoredKeyCount(), 0);
});
