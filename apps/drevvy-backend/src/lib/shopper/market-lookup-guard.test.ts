import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MARKET_LOOKUP_IP_LIMIT,
  MARKET_LOOKUP_USER_LIMIT,
  MARKET_REFUND_CAP,
  createMemoryMarketLookupGuard,
  hashShopperIp,
  marketLookupFailsClosed,
  shopperClientIp,
} from './market-lookup-guard';

const IP_HASH = hashShopperIp('203.0.113.10');

test('the lookup guard limits users, IPs, refunds, and repeated misses', async () => {
  const guard = createMemoryMarketLookupGuard();
  const now = 1_700_000_000_000;
  for (let index = 0; index < MARKET_LOOKUP_USER_LIMIT; index += 1) {
    const claim = await guard.claim({
      userId: 'shopper-1',
      ipHash: hashShopperIp(`203.0.113.${index}`),
      listingId: `mc-rate-${index}`,
      now,
    });
    assert.equal(claim.action, 'proceed');
  }
  const blocked = await guard.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('203.0.113.50'),
    listingId: 'mc-rate-extra',
    now,
  });
  assert.equal(blocked.action, 'rate_limited');
  assert.equal(blocked.scope, 'user');

  const shared = createMemoryMarketLookupGuard();
  for (let index = 0; index < MARKET_LOOKUP_IP_LIMIT; index += 1) {
    const claim = await shared.claim({
      userId: `shopper-${index}`,
      ipHash: IP_HASH,
      listingId: `mc-ip-${index}`,
      now,
    });
    assert.equal(claim.action, 'proceed');
  }
  const ipBlocked = await shared.claim({
    userId: 'shopper-new',
    ipHash: IP_HASH,
    listingId: 'mc-ip-extra',
    now,
  });
  assert.equal(ipBlocked.action, 'rate_limited');
  assert.equal(ipBlocked.scope, 'ip');

  const refunds = createMemoryMarketLookupGuard();
  for (let index = 0; index < MARKET_REFUND_CAP; index += 1) {
    await refunds.noteRefund('shopper-1', now);
  }
  const capped = await refunds.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('198.51.100.8'),
    listingId: 'mc-capped-1',
    now,
  });
  assert.equal(capped.action, 'refund_cap');

  const misses = createMemoryMarketLookupGuard();
  await misses.rememberMiss('mc-listing-1', now);
  const again = await misses.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('198.51.100.9'),
    listingId: 'mc-listing-1',
    now: now + 60_000,
  });
  assert.equal(again.action, 'cached_miss');
  const later = await misses.claim({
    userId: 'shopper-2',
    ipHash: hashShopperIp('198.51.100.10'),
    listingId: 'mc-listing-1',
    now: now + (24 * 60 * 60 * 1000) + 1,
  });
  assert.equal(later.action, 'proceed');
});

test('production fails closed and the client IP is hashed before it is stored', () => {
  assert.equal(marketLookupFailsClosed({ NODE_ENV: 'production' }), true);
  assert.equal(marketLookupFailsClosed({ VERCEL_ENV: 'production', NODE_ENV: 'production' }), true);
  assert.equal(marketLookupFailsClosed({ NODE_ENV: 'test' }), false);
  assert.equal(marketLookupFailsClosed({ NODE_ENV: 'development' }), false);
  const headers = { get: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.10, 10.0.0.1' : null) };
  assert.equal(shopperClientIp(headers), '203.0.113.10');
  assert.equal(hashShopperIp('203.0.113.10').includes('203.0.113.10'), false);
  assert.equal(hashShopperIp('203.0.113.10').length, 64);
});
