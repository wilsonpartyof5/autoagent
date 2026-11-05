import assert from 'node:assert/strict';
import test from 'node:test';

import { DISCOVER_LIMITS } from './constants';
import { DiscoverApiError } from './errors';
import {
  MemoryRateLimitStore,
  SupabaseRateLimitStore,
  enforceDiscoverRateLimit,
} from './rate-limit';

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
