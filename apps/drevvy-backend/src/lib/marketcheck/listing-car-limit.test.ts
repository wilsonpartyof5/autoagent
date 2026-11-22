import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MemoryRateLimitStore, type RateLimitStore } from '@/lib/public-discover/rate-limit';

import { DurableRateLimitUnavailable, takeDurableLimits } from '@/lib/shopper/durable-rate-limit';

import {
  LISTING_CAR_IP_PER_DAY,
  ListingCarRateLimited,
  enforceListingCarDailyCap,
  listingCarLimitWindows,
  withListingCarLimits,
} from './listing-car-limit';

const HERE = dirname(fileURLToPath(import.meta.url));

test('listing car caps are global and per IP on the existing counter', () => {
  const windows = listingCarLimitWindows('203.0.113.10');
  assert.equal(windows[0]?.bucket, 'mc:car:shop:g:d');
  assert.equal(windows[1]?.bucket.startsWith('mc:car:shop:ip:'), true);
  assert.equal(windows[0]?.limit, 2_000);
  assert.equal(windows[1]?.limit, LISTING_CAR_IP_PER_DAY);
  assert.equal((windows[1]?.bucket.length ?? 0) >= 8 && (windows[1]?.bucket.length ?? 0) <= 180, true);
  assert.notEqual(listingCarLimitWindows('203.0.113.11')[1]?.bucket, windows[1]?.bucket);
  const listing = readFileSync(join(HERE, 'listing-car.ts'), 'utf8');
  const enforceAt = listing.indexOf('await enforceListingCarDailyCap()');
  const recordAt = listing.indexOf('recordMarketCheckCall(LISTING_CAR_ENDPOINT)');
  assert.equal(enforceAt > 0 && recordAt > enforceAt, true);
});

test('the per-IP listing cap stops the next paid call', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = Date.parse('2026-11-22T18:00:00.000Z');
  for (let i = 0; i < LISTING_CAR_IP_PER_DAY; i += 1) {
    await withListingCarLimits({ ip: '203.0.113.10', store, nowMs }, () => enforceListingCarDailyCap());
  }
  await assert.rejects(
    () => withListingCarLimits({ ip: '203.0.113.10', store, nowMs }, () => enforceListingCarDailyCap()),
    (error: unknown) => error instanceof ListingCarRateLimited,
  );
  await withListingCarLimits({ ip: '203.0.113.11', store, nowMs }, () => enforceListingCarDailyCap());
});

test('a listing lookup outside the cap context is not counted', async () => {
  await enforceListingCarDailyCap();
});

test('discover and inventory detail fetches do not spend the deal or OTD cap', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = Date.parse('2026-11-22T18:00:00.000Z');
  let hits = 0;
  const counting: RateLimitStore = {
    async hit(bucket, windowStartMs, windowMs, limit, now) {
      hits += 1;
      assert.equal(bucket.startsWith('mc:car:shop:'), true);
      return store.hit(bucket, windowStartMs, windowMs, limit, now);
    },
  };
  for (let i = 0; i < 20; i += 1) await enforceListingCarDailyCap();
  await withListingCarLimits(
    { ip: '198.51.100.10', store: counting, nowMs },
    () => enforceListingCarDailyCap(),
  );
  assert.equal(hits, 2);

  const root = join(HERE, '../..');
  const handlers = readFileSync(join(root, 'lib/public-discover/handlers.ts'), 'utf8');
  const inventory = readFileSync(join(root, 'app/api/inventory/detail/[id]/route.ts'), 'utf8');
  const network = readFileSync(join(root, 'app/api/consumer/listings/network/route.ts'), 'utf8');
  assert.equal(handlers.includes('withListingCarLimits'), false);
  assert.equal(inventory.includes('withListingCarLimits'), false);
  assert.equal(network.includes('withListingCarLimits'), false);
  assert.match(handlers, /getVehicleDetailMcp/);
  assert.match(inventory, /getVehicleDetailMcp/);
  assert.match(inventory, /ListingCarRateLimited/);
  assert.match(handlers, /ListingCarRateLimited/);
});

test('a missing shopper rate-limit store fails closed instead of throwing a raw error', async () => {
  await assert.rejects(
    () => takeDurableLimits({
      windows: [{ bucket: 'mc:car:shop:g:d', windowMs: 86_400_000, limit: 1 }],
      nowMs: Date.parse('2026-11-22T18:00:00.000Z'),
      env: { NODE_ENV: 'production', VERCEL_ENV: 'production' },
    }),
    (error: unknown) => error instanceof DurableRateLimitUnavailable,
  );
});
