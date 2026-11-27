import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MARKET_LOOKUP_IP_LIMIT,
  MARKET_LOOKUP_USER_LIMIT,
  MARKET_REFUND_CAP,
  claimDurableMarketLookup,
  createMemoryMarketLookupGuard,
  durableMarketLookupGuard,
  hashShopperIp,
  marketLookupFailsClosed,
  resetMarketIpPepperWarningForTests,
  resetProcessShopperMissesForTests,
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
    await guard.releaseRefundSlot('shopper-1', `mc-rate-${index}`);
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

test('an open refund slot blocks the next listing and a timeout stays on that shopper', async () => {
  const guard = createMemoryMarketLookupGuard();
  const now = 1_700_000_000_000;
  for (let index = 0; index < 5; index += 1) {
    const claim = await guard.claim({
      userId: 'shopper-1',
      ipHash: hashShopperIp(`198.51.100.${index}`, { NODE_ENV: 'test' }),
      listingId: `mc-slot-${index}`,
      now,
    });
    assert.equal(claim.action, 'proceed');
  }
  const blocked = await guard.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('198.51.100.20', { NODE_ENV: 'test' }),
    listingId: 'mc-slot-next',
    now,
  });
  assert.equal(blocked.action, 'refund_cap');
  await guard.releaseRefundSlot('shopper-1', 'mc-slot-0');
  const again = await guard.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('198.51.100.21', { NODE_ENV: 'test' }),
    listingId: 'mc-slot-next',
    now,
  });
  assert.equal(again.action, 'proceed');
  const duplicate = await guard.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('198.51.100.22', { NODE_ENV: 'test' }),
    listingId: 'mc-slot-next',
    now,
  });
  assert.equal(duplicate.action, 'rate_limited');

  const burst = createMemoryMarketLookupGuard();
  await burst.rememberUpstreamAttempt('shopper-1', 'mc-timeout', now);
  const retry = await burst.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('198.51.100.30', { NODE_ENV: 'test' }),
    listingId: 'mc-timeout',
    now: now + 1_000,
  });
  assert.equal(retry.action, 'rate_limited');
  const otherShopper = await burst.claim({
    userId: 'shopper-2',
    ipHash: hashShopperIp('198.51.100.31', { NODE_ENV: 'test' }),
    listingId: 'mc-timeout',
    now: now + 1_000,
  });
  assert.equal(otherShopper.action, 'proceed');
  const later = await burst.claim({
    userId: 'shopper-1',
    ipHash: hashShopperIp('198.51.100.32', { NODE_ENV: 'test' }),
    listingId: 'mc-timeout',
    now: now + (2 * 60 * 1000) + 1,
  });
  assert.equal(later.action, 'proceed');
});

test('IPv6 /64 addresses share one hash and a pepper is optional', () => {
  resetMarketIpPepperWarningForTests();
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  try {
    const env = { NODE_ENV: 'test' } as NodeJS.ProcessEnv;
    const prefix = hashShopperIp('2001:db8:85a3::1', env);
    assert.equal(prefix, hashShopperIp('2001:DB8:85a3:0:ffff:ffff:ffff:ffff', env));
    assert.notEqual(prefix, hashShopperIp('2001:db8:85a4::1', env));
    assert.equal(hashShopperIp('::ffff:203.0.113.10', env), hashShopperIp('203.0.113.10', env));
    assert.equal(prefix.includes('2001'), false);
    const peppered = hashShopperIp('203.0.113.10', { NODE_ENV: 'test', DREVVY_IP_HASH_PEPPER: 'dev-pepper' });
    assert.notEqual(peppered, hashShopperIp('203.0.113.10', env));
    assert.equal(peppered.length, 64);
    assert.equal(errors.filter((line) => line.includes('market_ip_hash_pepper_unset')).length, 1);
    hashShopperIp('198.51.100.40', env);
    assert.equal(errors.filter((line) => line.includes('market_ip_hash_pepper_unset')).length, 1);
  } finally {
    console.error = original;
  }
});

test('every environment fails closed and the client IP is hashed before it is stored', () => {
  assert.equal(marketLookupFailsClosed({ NODE_ENV: 'production' }), true);
  assert.equal(marketLookupFailsClosed({ VERCEL_ENV: 'production', NODE_ENV: 'production' }), true);
  assert.equal(marketLookupFailsClosed({ NODE_ENV: 'test' }), true);
  assert.equal(marketLookupFailsClosed({ NODE_ENV: 'development' }), true);
  const headers = { get: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.10, 10.0.0.1' : null) };
  assert.equal(shopperClientIp(headers), '203.0.113.10');
  assert.equal(hashShopperIp('203.0.113.10').includes('203.0.113.10'), false);
  assert.equal(hashShopperIp('203.0.113.10').length, 64);
});

test('a limiter error stays closed and a short miss does not call it again', async () => {
  const claim = await claimDurableMarketLookup({
    rpc: async () => ({ data: null, error: { message: 'unknown rpc' } }),
  } as never, { userId: 'u', ipHash: 'h', listingId: 'l' }, { failClosed: false });
  assert.deepEqual(claim, { action: 'unavailable', scope: null, hold: false });

  const calls: string[] = [];
  const guard = durableMarketLookupGuard({
    rpc: async (name: string) => {
      calls.push(name);
      return { data: null, error: { message: 'down' } };
    },
  } as never, { failClosed: false });
  await guard.rememberShopperMiss?.('shopper', 'listing-1', 1_000);
  const again = await guard.claim({ userId: 'shopper', ipHash: 'h', listingId: 'listing-1', now: 2_000 });
  assert.equal(again.action, 'cached_miss');
  assert.equal(again.hold, false);
  assert.deepEqual(calls, []);
  resetProcessShopperMissesForTests();
});
