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
  clientPhotoUrlDropped,
  capQueryNames,
  inspectClientPhoto,
  isSecretLikeQueryName,
  photoPathname,
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
  assert.equal(dealer, undefined);

  const sized = toClientPhotoUrl('https://cdn.dealer.example/tahoe.jpg?width=640');
  assert.equal(sized, 'https://cdn.dealer.example/tahoe.jpg?width=640');

  const publicCdn = toClientPhotoUrl(`https://images.marketcheck.com/vehicles/tahoe.jpg?api_key=${SECRET}`);
  assert.equal(publicCdn, undefined);
  assert.equal(marketCheckPhotoHostKind('images.marketcheck.com'), 'public');
  assert.equal(marketCheckPhotoHostKind('api.marketcheck.com.evil.example'), 'other');
  assert.equal(marketCheckPhotoHostKind('evilmarketcheck.com'), 'other');
  assert.equal(marketCheckPhotoHostKind('cdn.marketcheck.com'), 'credentialed');
});

test('photo URLs with a secret-looking query or path are dropped', () => {
  const samples = [
    'https://cdn.dealer.example/a.jpg?x-api-key=abc',
    'https://cdn.dealer.example/a.jpg?key=abc',
    'https://cdn.dealer.example/a.jpg?auth=1',
    'https://cdn.dealer.example/a.jpg?client_secret=abc',
    'https://cdn.dealer.example/a.jpg?access_key=abc',
    'https://cdn.dealer.example/a.jpg?width=1;API_KEY=abc',
    'https://cdn.dealer.example/API_KEY/abc.jpg',
    'https://cdn.dealer.example/a.jpg?X-Amz-Signature=abc',
    'https://cdn.dealer.example/a.jpg?token=abc',
    'https://cdn.dealer.example/a.jpg?SIG=abc',
  ];
  for (const sample of samples) {
    assert.equal(clientPhotoUrlDropped(sample), true, sample);
    assert.equal(toClientPhotoUrl(sample), undefined, sample);
  }
  assert.equal(clientPhotoUrlDropped('https://cdn.dealer.example/a.jpg?width=640'), false);
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

test('a missing photo rate-limit table falls back and still serves the image', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  const canonical = 'https://api.marketcheck.com/v2/image/cache/car/abc';
  let fetched = 0;
  const fetchImpl: typeof fetch = async () => {
    fetched += 1;
    return new Response(Uint8Array.from([7]), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  };
  const missing: RateLimitStore = {
    async hit() {
      const error = new Error('relation "public.public_discover_rate_limits" does not exist');
      (error as Error & { code: string }).code = '42P01';
      throw error;
    },
  };
  const nowMs = 1_700_001_640_000;
  const deps = {
    nowMs,
    rateLimitStore: missing,
    rateLimitEnv: { NODE_ENV: 'production', VERCEL_ENV: 'production' } as NodeJS.ProcessEnv,
    lookup: async () => ['8.8.8.8'],
    fetchImpl,
  };
  const served = await handleInventoryPhoto(photoRequest(canonical, '203.0.113.77', '', nowMs), deps);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
  assert.equal(fetched, 1);

  for (let i = 1; i < PHOTO_LIMITS.ipPerMinute; i += 1) {
    const ok = await handleInventoryPhoto(photoRequest(canonical, '203.0.113.77', '', nowMs), deps);
    assert.equal(ok.status, 200);
  }
  const blocked = await handleInventoryPhoto(photoRequest(canonical, '203.0.113.77', '', nowMs), deps);
  assert.equal(blocked.status, 429);
  assert.equal(fetched, PHOTO_LIMITS.ipPerMinute);
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

test('http photo URLs upgrade to https only when the host rules allow them', () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  process.env.DREVVY_PUBLIC_ORIGIN = 'https://app.example';
  assert.equal(
    toClientPhotoUrl('http://images.carsforsale.com/nv200/1.jpg?width=640'),
    'https://images.carsforsale.com/nv200/1.jpg?width=640',
  );
  assert.equal(
    toClientPhotoUrl('http://images.autodealersdigital.com/nv200/1.jpg'),
    'https://images.autodealersdigital.com/nv200/1.jpg',
  );
  assert.equal(
    toClientPhotoUrl('http://images.inventoryrsc.com:80/nv200/1.jpg'),
    'https://images.inventoryrsc.com/nv200/1.jpg',
  );
  assert.equal(
    toClientPhotoUrl('http://images.marketcheck.com/vehicles/nv200.jpg'),
    'https://images.marketcheck.com/vehicles/nv200.jpg',
  );
  const proxied = toClientPhotoUrl('http://api.marketcheck.com/v2/image/cache/car/nv200');
  assert.match(proxied ?? '', /^https:\/\/app\.example\/api\/inventory\/photo\?/);
  assert.equal(containsSecret(proxied ?? ''), false);
  assert.equal(toClientPhotoUrl(`http://cdn.dealer.example/a.jpg?api_key=${SECRET}`), undefined);
  assert.equal(toClientPhotoUrl('http://cdn.dealer.example/a.jpg?token=abc'), undefined);
  assert.equal(toClientPhotoUrl('http://user:pass@cdn.dealer.example/a.jpg'), undefined);
  assert.equal(toClientPhotoUrl('http://cdn.dealer.example:8080/a.jpg'), undefined);
  assert.equal(
    toClientPhotoUrl('http://cdn.dealer.example/a.jpg?utm_source=lot'),
    'https://cdn.dealer.example/a.jpg',
  );
  assert.equal(toClientPhotoUrl('javascript:alert(1)'), undefined);
});

test('photo reject reasons stay scheme, host, query, or other, and a coming-soon file is not a photo', () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  process.env.DREVVY_PUBLIC_ORIGIN = 'https://app.example';
  const cases: Array<{ raw: string; reason: 'scheme' | 'host' | 'query' | 'other' | null }> = [
    { raw: 'javascript:alert(1)', reason: 'scheme' },
    { raw: 'https://user:pass@cdn.example.test/a.jpg', reason: 'host' },
    { raw: 'https://cdn.example.test:8080/a.jpg', reason: 'host' },
    { raw: `https://cdn.example.test/a.jpg?api_key=${SECRET}`, reason: 'query' },
    { raw: 'https://cdn.example.test/a.jpg?X-Amz-Signature=abc', reason: 'query' },
    { raw: 'https://cdn.example.test/a.jpg?utm_source=lot', reason: null },
    { raw: 'https://cdn.example.test/API_KEY/a.jpg', reason: 'other' },
    { raw: 'https://cdn.example.test/comingsoon.jpg', reason: 'other' },
    { raw: 'http://cdn.example.test/coming-soon.png', reason: 'other' },
    { raw: 'https://cdn.example.test/ComingSoon.JPEG', reason: 'other' },
    { raw: 'https://cdn.example.test/coming_soon.webp', reason: 'other' },
    { raw: 'https://cdn.example.test/comingsoon/1.jpg', reason: 'other' },
    { raw: 'https://cdn.example.test/inventory/coming-soon/2.png', reason: 'other' },
    { raw: 'https://cdn.example.test/photos/1.jpg', reason: null },
    { raw: 'https://images.carsforsale.com/nv200/1.jpg?width=640', reason: null },
    { raw: 'http://api.marketcheck.com/v2/image/cache/car/abc', reason: null },
    { raw: `https://api.marketcheck.com/v2/image/cache/car/abc?api_key=${SECRET}`, reason: null },
  ];
  const now = 1_700_000_000_000;
  cases.forEach((sample, index) => {
    const inspected = inspectClientPhoto(sample.raw, now);
    assert.equal(inspected.reason, sample.reason, String(index));
    assert.equal(toClientPhotoUrl(sample.raw, now), inspected.url, String(index));
    if (sample.reason) assert.equal(inspected.url, undefined, String(index));
    else assert.equal(typeof inspected.url, 'string', String(index));
  });
  const proxied = inspectClientPhoto(`https://api.marketcheck.com/v2/image/cache/car/abc?api_key=${SECRET}`, now);
  assert.match(proxied.url ?? '', /^https:\/\/app\.example\/api\/inventory\/photo\?/);
  assert.equal(containsSecret(proxied.url ?? ''), false);
  assert.equal((proxied.url ?? '').includes('api.marketcheck.com'), false);
});

test('dealer cache params stay, unknown image params are stripped, and secrets still drop', () => {
  const hash = 'abc123';
  const dealersync = `http://images.example-cdn.test/3229/Photos/1/car.jpg?_=${hash}&width=450`;
  assert.equal(
    toClientPhotoUrl(dealersync),
    `https://images.example-cdn.test/3229/Photos/1/car.jpg?_=${hash}&width=450`,
  );
  assert.equal(
    toClientPhotoUrl('https://cdn.example.test/a.jpg?v=1711647378&ver=2&ts=3&t=4&cb=5'),
    'https://cdn.example.test/a.jpg?cb=5&t=4&ts=3&v=1711647378&ver=2',
  );
  assert.equal(
    toClientPhotoUrl('https://cdn.example.test/a.jpg?width=640&utm_source=lot'),
    'https://cdn.example.test/a.jpg?width=640',
  );
  const secretAndUnknown = toClientPhotoUrl(`https://cdn.example.test/a.jpg?utm_source=lot&api_key=${SECRET}`);
  assert.equal(secretAndUnknown, undefined);

  const nonImage = inspectClientPhoto('https://cdn.example.test/render?utm_source=lot&foo=1');
  assert.equal(nonImage.reason, 'query');
  assert.equal(nonImage.url, undefined);
  assert.deepEqual(nonImage.queryNames, ['foo', 'utm_source']);

  const signed = inspectClientPhoto('https://cdn.example.test/a.jpg?X-Amz-Signature=abc&SIG=abc');
  assert.equal(signed.reason, 'query');
  assert.deepEqual(signed.queryNames, ['secret_like']);
  assert.equal(JSON.stringify(signed).includes('X-Amz'), false);
  assert.equal(JSON.stringify(signed).includes('SIG'), false);
  assert.equal(isSecretLikeQueryName('sig'), true);
  assert.equal(isSecretLikeQueryName('expires'), true);
  assert.equal(isSecretLikeQueryName('policy'), true);
  assert.equal(isSecretLikeQueryName('_'), false);

  const many = inspectClientPhoto(
    'https://cdn.example.test/render?aa=1&bb=1&cc=1&dd=1&ee=1&ff=1&bad.name=1',
  );
  assert.equal(many.reason, 'query');
  assert.deepEqual(many.queryNames, ['aa', 'bb', 'cc', 'dd', 'ee']);
  assert.deepEqual(capQueryNames(['sig', 'utm_source', 'a.b', 'X-Amz-Credential']), ['secret_like', 'utm_source']);

  assert.equal(photoPathname('https://cdn.example.test/photos/1.jpg'), '/photos/1.jpg');
  assert.equal(photoPathname('not a url'), null);
  assert.equal(photoPathname('http://['), null);
  assert.doesNotThrow(() => inspectClientPhoto('https://cdn.example.test/%'));
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
