import assert from 'node:assert/strict';
import test from 'node:test';

import { DISCOVER_LIMITS } from './constants';
import { DiscoverApiError } from './errors';
import {
  MemoryRateLimitStore,
  SupabaseRateLimitStore,
  discoverLimiterFailsClosed,
  enforceDiscoverRateLimit,
  type RateLimitStore,
} from './rate-limit';

const PRODUCTION_ENV: NodeJS.ProcessEnv = { NODE_ENV: 'production', VERCEL_ENV: 'production' };
const DEVELOPMENT_ENV: NodeJS.ProcessEnv = { NODE_ENV: 'development' };

function throwingStore(failOnBucket?: string): RateLimitStore {
  return {
    async hit(bucket) {
      if (!failOnBucket || bucket.includes(failOnBucket)) {
        throw new Error('relation "public.public_discover_rate_limits" does not exist');
      }
      return {
        allowed: true,
        count: 1,
        limit: 20,
        remaining: 19,
        resetAtMs: 1_700_000_060_000,
      };
    },
  };
}

test('per-IP search window returns 429 after the cap with Retry-After', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_000_000_000;
  const ip = '203.0.113.10';
  for (let i = 0; i < DISCOVER_LIMITS.search.ipPerMinute; i += 1) {
    const ok = await enforceDiscoverRateLimit({ ip, route: 'search', nowMs, store });
    assert.equal(ok.headers['RateLimit-Limit'], String(DISCOVER_LIMITS.search.ipPerMinute));
    assert.equal(ok.headers['RateLimit-Remaining'], String(DISCOVER_LIMITS.search.ipPerMinute - (i + 1)));
  }
  await assert.rejects(
    () => enforceDiscoverRateLimit({ ip, route: 'search', nowMs, store }),
    (error: unknown) => {
      assert.equal(error instanceof DiscoverApiError, true);
      const limited = error as DiscoverApiError;
      assert.equal(limited.code, 'RATE_LIMITED');
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.extraHeaders['Retry-After']) >= 1);
      assert.equal(limited.extraHeaders['RateLimit-Remaining'], '0');
      return true;
    },
  );
});

test('a second IP is not blocked by the first IP exhaust', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_000_060_000;
  for (let i = 0; i < DISCOVER_LIMITS.search.ipPerMinute; i += 1) {
    await enforceDiscoverRateLimit({ ip: '198.51.100.2', route: 'search', nowMs, store });
  }
  const other = await enforceDiscoverRateLimit({ ip: '198.51.100.3', route: 'search', nowMs, store });
  assert.equal(other.headers['RateLimit-Remaining'], String(DISCOVER_LIMITS.search.ipPerMinute - 1));
});

test('global search cap 429s every IP once the window is full', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_000_120_000;
  const needed = DISCOVER_LIMITS.search.globalPerMinute;
  for (let i = 0; i < needed; i += 1) {
    await enforceDiscoverRateLimit({
      ip: `198.51.100.${(i % 200) + 1}`,
      route: 'search',
      nowMs,
      store,
    });
  }
  await assert.rejects(
    () => enforceDiscoverRateLimit({ ip: '203.0.113.99', route: 'search', nowMs, store }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMITED',
  );
});

test('detail has a higher IP cap than search', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_000_180_000;
  for (let i = 0; i < DISCOVER_LIMITS.search.ipPerMinute + 1; i += 1) {
    await enforceDiscoverRateLimit({ ip: '192.0.2.8', route: 'detail', nowMs, store });
  }
  const still = await enforceDiscoverRateLimit({ ip: '192.0.2.8', route: 'detail', nowMs, store });
  assert.ok(Number(still.headers['RateLimit-Remaining']) >= 0);
});

test('production mode is fail-closed and development is not', () => {
  assert.equal(discoverLimiterFailsClosed(PRODUCTION_ENV), true);
  assert.equal(discoverLimiterFailsClosed({ NODE_ENV: 'development', VERCEL_ENV: 'preview' }), true);
  assert.equal(discoverLimiterFailsClosed({ NODE_ENV: 'test', VERCEL_ENV: 'preview' }), true);
  assert.equal(discoverLimiterFailsClosed(DEVELOPMENT_ENV), false);
  assert.equal(discoverLimiterFailsClosed({ NODE_ENV: 'test' }), false);
});

test('a durable store error is 503 in production and does not use the memory counter', async () => {
  const fallback = new MemoryRateLimitStore();
  let fallbackHits = 0;
  const countingFallback: RateLimitStore = {
    async hit(bucket, windowStartMs, windowMs, limit, nowMs) {
      fallbackHits += 1;
      return fallback.hit(bucket, windowStartMs, windowMs, limit, nowMs);
    },
  };
  await assert.rejects(
    () => enforceDiscoverRateLimit({
      ip: '203.0.113.40',
      route: 'search',
      nowMs: 1_700_000_300_000,
      store: throwingStore(':g:d'),
      fallbackStore: countingFallback,
      env: PRODUCTION_ENV,
    }),
    (error: unknown) => {
      assert.equal(error instanceof DiscoverApiError, true);
      const unavailable = error as DiscoverApiError;
      assert.equal(unavailable.code, 'RATE_LIMIT_UNAVAILABLE');
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.message.includes('relation'), false);
      return true;
    },
  );
  assert.equal(fallbackHits, 0);
});

test('a missing durable store is 503 in production before any counter write', async () => {
  await assert.rejects(
    () => enforceDiscoverRateLimit({
      ip: '203.0.113.41',
      route: 'detail',
      nowMs: 1_700_000_360_000,
      env: { NODE_ENV: 'production' },
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMIT_UNAVAILABLE' && error.status === 503,
  );
});

test('development keeps a memory limiter when the durable store errors', async () => {
  const fallback = new MemoryRateLimitStore();
  const nowMs = 1_700_000_420_000;
  const ip = '203.0.113.42';
  for (let i = 0; i < DISCOVER_LIMITS.search.ipPerMinute; i += 1) {
    const ok = await enforceDiscoverRateLimit({
      ip,
      route: 'search',
      nowMs,
      store: throwingStore(),
      fallbackStore: fallback,
      env: DEVELOPMENT_ENV,
    });
    assert.equal(ok.headers['RateLimit-Remaining'], String(DISCOVER_LIMITS.search.ipPerMinute - (i + 1)));
  }
  await assert.rejects(
    () => enforceDiscoverRateLimit({
      ip,
      route: 'search',
      nowMs,
      store: throwingStore(),
      fallbackStore: fallback,
      env: DEVELOPMENT_ENV,
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMITED' && error.status === 429,
  );
});

test('Supabase store maps the RPC row onto remaining counts', async () => {
  const store = new SupabaseRateLimitStore(async () => ({
    allowed: true,
    hit_count: 3,
    window_start: new Date(1_700_000_000_000).toISOString(),
  }));
  const hit = await store.hit('disc:search:ip:1:m', 1_700_000_000_000, 60_000, 20, 1_700_000_000_100);
  assert.equal(hit.allowed, true);
  assert.equal(hit.count, 3);
  assert.equal(hit.remaining, 17);
});
