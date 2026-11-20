import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DISCOVER_LIMITS, PHOTO_LIMITS } from './constants';
import { DiscoverApiError } from './errors';
import {
  MemoryRateLimitStore,
  SupabaseRateLimitStore,
  discoverLimiterFailsClosed,
  enforceDiscoverRateLimit,
  enforcePhotoRateLimit,
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

test('an IP hammering past its cap does not consume the global buckets', async () => {
  const store = new MemoryRateLimitStore();
  const globalHits: string[] = [];
  const wrapped: RateLimitStore = {
    async hit(bucket, windowStartMs, windowMs, limit, nowMs) {
      if (bucket.includes(':g:')) globalHits.push(bucket);
      return store.hit(bucket, windowStartMs, windowMs, limit, nowMs);
    },
  };
  const nowMs = 1_700_000_900_000;
  const ip = '203.0.113.80';
  for (let i = 0; i < DISCOVER_LIMITS.search.ipPerMinute; i += 1) {
    await enforceDiscoverRateLimit({ ip, route: 'search', nowMs, store: wrapped });
  }
  const allowedGlobalHits = globalHits.length;
  assert.equal(allowedGlobalHits, DISCOVER_LIMITS.search.ipPerMinute * 2);
  for (let i = 0; i < 30; i += 1) {
    await assert.rejects(
      () => enforceDiscoverRateLimit({ ip, route: 'search', nowMs, store: wrapped }),
      (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMITED',
    );
  }
  assert.equal(globalHits.length, allowedGlobalHits);
  const other = await enforceDiscoverRateLimit({
    ip: '203.0.113.81',
    route: 'search',
    nowMs,
    store: wrapped,
  });
  assert.equal(other.headers['RateLimit-Remaining'], String(DISCOVER_LIMITS.search.ipPerMinute - 1));
  assert.equal(globalHits.length, allowedGlobalHits + 2);
});

test('IPv6 clients in one /64 share a bucket and a different /64 does not', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_001_000_000;
  const first = '2001:db8:85a3::1';
  const samePrefix = '2001:DB8:85a3:0:ffff:ffff:ffff:ffff';
  for (let i = 0; i < DISCOVER_LIMITS.search.ipPerMinute; i += 1) {
    await enforceDiscoverRateLimit({ ip: i % 2 === 0 ? first : samePrefix, route: 'search', nowMs, store });
  }
  await assert.rejects(
    () => enforceDiscoverRateLimit({ ip: samePrefix, route: 'search', nowMs, store }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMITED',
  );
  const otherPrefix = await enforceDiscoverRateLimit({
    ip: '2001:db8:85a4::1',
    route: 'search',
    nowMs,
    store,
  });
  assert.equal(otherPrefix.headers['RateLimit-Remaining'], String(DISCOVER_LIMITS.search.ipPerMinute - 1));
});

test('IPv4-mapped IPv6 keeps the embedded address', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_001_060_000;
  for (let i = 0; i < DISCOVER_LIMITS.search.ipPerMinute; i += 1) {
    await enforceDiscoverRateLimit({ ip: '::ffff:203.0.113.50', route: 'search', nowMs, store });
  }
  await assert.rejects(
    () => enforceDiscoverRateLimit({ ip: '203.0.113.50', route: 'search', nowMs, store }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMITED',
  );
  const other = await enforceDiscoverRateLimit({ ip: '::ffff:203.0.113.51', route: 'search', nowMs, store });
  assert.equal(other.headers['RateLimit-Remaining'], String(DISCOVER_LIMITS.search.ipPerMinute - 1));
});

function relationStore(code: string): RateLimitStore {
  return {
    async hit() {
      const error = new Error('relation "public.public_discover_rate_limits" does not exist');
      (error as Error & { code: string }).code = code;
      throw error;
    },
  };
}

test('photo falls back to memory when the rate-limit relation is missing and keeps the same cap', async () => {
  const fallback = new MemoryRateLimitStore();
  const nowMs = 1_700_001_400_000;
  const ip = '203.0.113.91';
  for (let i = 0; i < PHOTO_LIMITS.ipPerMinute; i += 1) {
    const ok = await enforcePhotoRateLimit({
      ip,
      nowMs,
      store: relationStore('42P01'),
      fallbackStore: fallback,
      env: PRODUCTION_ENV,
    });
    assert.equal(ok.headers['RateLimit-Remaining'], String(PHOTO_LIMITS.ipPerMinute - (i + 1)));
  }
  await assert.rejects(
    () => enforcePhotoRateLimit({
      ip,
      nowMs,
      store: relationStore('42P01'),
      fallbackStore: fallback,
      env: PRODUCTION_ENV,
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMITED' && error.status === 429,
  );
});

test('the photo missing-relation log is a static event name', () => {
  const source = readFileSync(fileURLToPath(new URL('./rate-limit.ts', import.meta.url)), 'utf8');
  const start = source.indexOf('function logPhotoMissingRelation');
  const end = source.indexOf('type LimitWindow');
  const fn = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /event: 'photo_rate_limit_missing_relation'/);
  assert.equal(fn.includes('${'), false);
  assert.equal(fn.includes('code'), false);
});

test('photo accepts each missing-relation code and rejects other store errors', async () => {
  const nowMs = 1_700_001_460_000;
  for (const code of ['42883', 'PGRST202', 'PGRST205']) {
    const ok = await enforcePhotoRateLimit({
      ip: `192.0.2.${code.length + 20}`,
      nowMs,
      store: relationStore(code),
      fallbackStore: new MemoryRateLimitStore(),
      env: PRODUCTION_ENV,
    });
    assert.equal(ok.headers['RateLimit-Limit'], String(PHOTO_LIMITS.ipPerMinute));
  }

  let fallbackHits = 0;
  const fallback = new MemoryRateLimitStore();
  const counting: RateLimitStore = {
    async hit(bucket, windowStartMs, windowMs, limit, nowMs) {
      fallbackHits += 1;
      return fallback.hit(bucket, windowStartMs, windowMs, limit, nowMs);
    },
  };
  await assert.rejects(
    () => enforcePhotoRateLimit({
      ip: '203.0.113.92',
      nowMs,
      store: relationStore('08006'),
      fallbackStore: counting,
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

test('photo stays 503 when Supabase env is missing in production', async () => {
  let fallbackHits = 0;
  const fallback = new MemoryRateLimitStore();
  const counting: RateLimitStore = {
    async hit(bucket, windowStartMs, windowMs, limit, nowMs) {
      fallbackHits += 1;
      return fallback.hit(bucket, windowStartMs, windowMs, limit, nowMs);
    },
  };
  await assert.rejects(
    () => enforcePhotoRateLimit({
      ip: '203.0.113.94',
      nowMs: 1_700_001_580_000,
      fallbackStore: counting,
      env: PRODUCTION_ENV,
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'RATE_LIMIT_UNAVAILABLE' && error.status === 503,
  );
  assert.equal(fallbackHits, 0);
});

test('discover stays 503 when the rate-limit table is missing', async () => {
  let fallbackHits = 0;
  const fallback = new MemoryRateLimitStore();
  const counting: RateLimitStore = {
    async hit(bucket, windowStartMs, windowMs, limit, nowMs) {
      fallbackHits += 1;
      return fallback.hit(bucket, windowStartMs, windowMs, limit, nowMs);
    },
  };
  await assert.rejects(
    () => enforceDiscoverRateLimit({
      ip: '203.0.113.93',
      route: 'search',
      nowMs: 1_700_001_520_000,
      store: relationStore('42P01'),
      fallbackStore: counting,
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

test('photo limits are per IP and fail closed without calling a later window', async () => {
  const store = new MemoryRateLimitStore();
  const hits: string[] = [];
  const wrapped: RateLimitStore = {
    async hit(bucket, windowStartMs, windowMs, limit, nowMs) {
      hits.push(bucket);
      return store.hit(bucket, windowStartMs, windowMs, limit, nowMs);
    },
  };
  const nowMs = 1_700_001_120_000;
  for (let i = 0; i < PHOTO_LIMITS.ipPerMinute; i += 1) {
    await enforcePhotoRateLimit({ ip: '198.51.100.8', nowMs, store: wrapped });
  }
  await assert.rejects(
    () => enforcePhotoRateLimit({ ip: '198.51.100.8', nowMs, store: wrapped }),
    (error: unknown) => error instanceof DiscoverApiError && error.status === 429,
  );
  assert.equal(hits.filter((bucket) => bucket.endsWith(':d')).length, PHOTO_LIMITS.ipPerMinute);
  await assert.rejects(
    () => enforcePhotoRateLimit({
      ip: '198.51.100.9',
      nowMs,
      env: { NODE_ENV: 'production', VERCEL_ENV: 'production' },
      store: throwingStore(),
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.status === 503,
  );
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
