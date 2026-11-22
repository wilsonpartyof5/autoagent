import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MemoryRateLimitStore } from '@/lib/public-discover/rate-limit';

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
  assert.equal(windows[0]?.bucket, 'mc:car:g:d');
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
