import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PHOTO_LIMITS } from '../public-discover/constants';
import { MemoryRateLimitStore, type RateLimitStore } from '../public-discover/rate-limit';

import { withMarketCheckContext } from './context';
import {
  PHOTO_CACHE_CONTROL,
  PHOTO_LINK_TTL_MS,
  handleInventoryPhoto,
  isPrivateAddress,
  marketCheckPhotoHostKind,
  proxyMarketCheckPhoto,
  toClientPhotoUrl,
} from './photos';
import { containsSecret } from './secrets';

const SECRET = 'test-marketcheck-key-do-not-ship';

function sign(canonical: string, exp: number): string {
  return createHmac('sha256', SECRET).update(`${exp}.${canonical}`).digest('base64url');
}

function proxyInput(canonical: string, exp = Date.now() + 60_000) {
  return {
    payload: Buffer.from(canonical, 'utf8').toString('base64url'),
    exp: String(exp),
    sig: sign(canonical, exp),
  };
}

test('credentialed MarketCheck photos are proxied and the key is stripped', () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  process.env.DREVVY_PUBLIC_ORIGIN = 'https://app.example';
  const raw = `https://api.marketcheck.com/v2/image/cache/car/abc?api_key=${SECRET}&w=800`;
  const client = toClientPhotoUrl(raw);
  assert.ok(client);
  assert.equal(client.startsWith('https://app.example/api/inventory/photo?'), true);
  assert.equal(containsSecret(client), false);
  assert.equal(client.includes('api_key'), false);
  assert.equal(client.length < 500, true);

  const dealer = toClientPhotoUrl(`https://cdn.dealer.example/tahoe.jpg?api_key=${SECRET}&width=640`);
  assert.equal(dealer, 'https://cdn.dealer.example/tahoe.jpg?width=640');
  assert.equal(containsSecret(dealer ?? ''), false);

  const publicCdn = toClientPhotoUrl(`https://images.marketcheck.com/vehicles/tahoe.jpg?api_key=${SECRET}`);
  assert.equal(publicCdn, 'https://images.marketcheck.com/vehicles/tahoe.jpg');
  assert.equal(marketCheckPhotoHostKind('images.marketcheck.com'), 'public');
  assert.equal(marketCheckPhotoHostKind('api.marketcheck.com.evil.example'), 'other');
  assert.equal(marketCheckPhotoHostKind('evilmarketcheck.com'), 'other');
  assert.equal(marketCheckPhotoHostKind('cdn.marketcheck.com'), 'credentialed');
});

test('the photo proxy rejects open hosts, private addresses, redirects, and bad signatures', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };

  try {
    const evil = 'https://evil.example/a.jpg';
    const rejected = await proxyMarketCheckPhoto({
      ...proxyInput(evil),
      lookup: async () => ['8.8.8.8'],
      fetchImpl: async () => {
        throw new Error('fetch should not run');
      },
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.equal(rejected.code, 'PHOTO_FORBIDDEN');

    const canonical = 'https://api.marketcheck.com/v2/image/cache/car/abc';
    const tampered = proxyInput(canonical);
    tampered.sig = `${tampered.sig}x`;
    const badSig = await proxyMarketCheckPhoto({
      ...tampered,
      lookup: async () => ['8.8.8.8'],
      fetchImpl: async () => {
        throw new Error('fetch should not run');
      },
    });
    assert.equal(badSig.ok, false);

    let fetched = 0;
    const privateHost = await proxyMarketCheckPhoto({
      ...proxyInput(canonical),
      lookup: async () => ['127.0.0.1'],
      fetchImpl: async () => {
        fetched += 1;
        throw new Error('fetch should not run');
      },
    });
    assert.equal(privateHost.ok, false);
    if (!privateHost.ok) assert.equal(privateHost.code, 'PHOTO_FORBIDDEN');
    assert.equal(fetched, 0);

    const redirected = await proxyMarketCheckPhoto({
      ...proxyInput(canonical),
      lookup: async () => ['8.8.8.8'],
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
    });
    assert.equal(redirected.ok, false);
    if (!redirected.ok) assert.equal(redirected.status, 502);

    const blown = await proxyMarketCheckPhoto({
      ...proxyInput(canonical),
      lookup: async () => {
        throw new Error(`lookup failed for https://api.marketcheck.com/x?api_key=${SECRET}`);
      },
    });
    assert.equal(blown.ok, false);
    const logged = logs.join('\n');
    assert.equal(containsSecret(logged), false);
    assert.equal(JSON.stringify(redirected).includes(SECRET), false);
    assert.equal(isPrivateAddress('10.1.2.3'), true);
    assert.equal(isPrivateAddress('8.8.8.8'), false);
  } finally {
    console.error = original;
  }
});

test('the photo proxy adds the key upstream and sets caching headers', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const canonical = 'https://mc-api.marketcheck.com/v2/image/cache/car/abc';
  let upstream = '';
  const result = await proxyMarketCheckPhoto({
    ...proxyInput(canonical),
    lookup: async () => ['8.8.8.8'],
    fetchImpl: async (input) => {
      upstream = String(input);
      return new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.cacheControl, PHOTO_CACHE_CONTROL);
    assert.match(result.cacheControl, /public/);
    assert.match(result.cacheControl, /max-age=/);
    assert.equal(result.contentType, 'image/jpeg');
  }
  assert.match(upstream, /api_key=/);
  assert.equal(containsSecret(JSON.stringify({ cacheControl: PHOTO_CACHE_CONTROL, ok: result.ok })), false);
  assert.equal(upstream.includes(SECRET), true);
});

test('signed photo links last 24 hours and later links are not fetched', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const now = 1_700_000_000_000;
  const client = toClientPhotoUrl('https://api.marketcheck.com/v2/image/cache/car/abc', now);
  const exp = Number(new URL(client ?? 'https://invalid').searchParams.get('e'));
  assert.equal(exp - now, PHOTO_LINK_TTL_MS);
  assert.equal(PHOTO_LINK_TTL_MS, 24 * 60 * 60 * 1000);

  const canonical = 'https://api.marketcheck.com/v2/image/cache/car/abc';
  let fetched = 0;
  const tooLong = await proxyMarketCheckPhoto({
    ...proxyInput(canonical, now + PHOTO_LINK_TTL_MS + 1),
    now,
    lookup: async () => ['8.8.8.8'],
    fetchImpl: async () => {
      fetched += 1;
      return new Response(Uint8Array.from([1]), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    },
  });
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.status, 403);
  assert.equal(fetched, 0);
});

function photoRequest(canonical: string, ip: string, extra = '', now = Date.now()): Request {
  const exp = now + 60_000;
  const payload = Buffer.from(canonical, 'utf8').toString('base64url');
  const sig = sign(canonical, exp);
  return new Request(
    `https://app.example/api/inventory/photo?u=${encodeURIComponent(payload)}&e=${exp}&s=${encodeURIComponent(sig)}${extra}`,
    { headers: { 'x-forwarded-for': ip } },
  );
}

test('extra photo query keys are rejected and do not fetch', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const canonical = 'https://api.marketcheck.com/v2/image/cache/car/abc';
  let fetched = 0;
  const fetchImpl: typeof fetch = async () => {
    fetched += 1;
    return new Response(Uint8Array.from([1]), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  };
  const deps = {
    rateLimitStore: new MemoryRateLimitStore(),
    lookup: async () => ['8.8.8.8'],
    fetchImpl,
  };
  const extra = await handleInventoryPhoto(photoRequest(canonical, '203.0.113.20', '&cb=1'), deps);
  assert.equal(extra.status, 400);
  const duplicate = await handleInventoryPhoto(photoRequest(canonical, '203.0.113.21', `&u=${'abc'}`), deps);
  assert.equal(duplicate.status, 400);
  assert.equal(fetched, 0);
});

test('photo fetches stop at the per-IP cap and fail closed when the store errors', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const canonical = 'https://api.marketcheck.com/v2/image/cache/car/abc';
  let fetched = 0;
  const fetchImpl: typeof fetch = async () => {
    fetched += 1;
    return new Response(Uint8Array.from([9]), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  };
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_001_200_000;
  const deps = {
    nowMs,
    rateLimitStore: store,
    lookup: async () => ['8.8.8.8'],
    fetchImpl,
  };
  for (let i = 0; i < PHOTO_LIMITS.ipPerMinute; i += 1) {
    const ok = await handleInventoryPhoto(photoRequest(canonical, '2001:db8:85a3::1', '', nowMs), deps);
    assert.equal(ok.status, 200);
  }
  const blocked = await handleInventoryPhoto(photoRequest(canonical, '2001:db8:85a3:0:1::2', '', nowMs), deps);
  assert.equal(blocked.status, 429);
  assert.equal(fetched, PHOTO_LIMITS.ipPerMinute);

  const failing: RateLimitStore = {
    async hit() {
      throw new Error('relation does not exist');
    },
  };
  const unavailable = await handleInventoryPhoto(photoRequest(canonical, '203.0.113.30'), {
    rateLimitStore: failing,
    rateLimitEnv: { NODE_ENV: 'production', VERCEL_ENV: 'production' },
    lookup: async () => ['8.8.8.8'],
    fetchImpl,
  });
  assert.equal(unavailable.status, 503);
  const body = await unavailable.json() as { error: { code: string } };
  assert.equal(body.error.code, 'RATE_LIMIT_UNAVAILABLE');
  assert.equal(fetched, PHOTO_LIMITS.ipPerMinute);
});

test('the photo route goes through the rate-limited handler', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../app/api/inventory/photo/route.ts'),
    'utf8',
  );
  assert.match(source, /handleInventoryPhoto/);
  assert.doesNotMatch(source, /proxyMarketCheckPhoto/);
});

test('photo URLs built inside a request use that origin', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  delete process.env.DREVVY_PUBLIC_ORIGIN;
  const url = await withMarketCheckContext({ origin: 'https://shop.example' }, async () => (
    toClientPhotoUrl('https://api.marketcheck.com/v2/image/cache/car/abc')
  ));
  assert.equal(url?.startsWith('https://shop.example/api/inventory/photo?'), true);
  assert.equal(containsSecret(url ?? ''), false);
});
