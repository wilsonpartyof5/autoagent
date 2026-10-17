import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { withMarketCheckContext } from './context';
import {
  PHOTO_CACHE_CONTROL,
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

test('photo URLs built inside a request use that origin', async () => {
  process.env.MARKETCHECK_API_KEY = SECRET;
  delete process.env.DREVVY_PUBLIC_ORIGIN;
  const url = await withMarketCheckContext({ origin: 'https://shop.example' }, async () => (
    toClientPhotoUrl('https://api.marketcheck.com/v2/image/cache/car/abc')
  ));
  assert.equal(url?.startsWith('https://shop.example/api/inventory/photo?'), true);
  assert.equal(containsSecret(url ?? ''), false);
});
