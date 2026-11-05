import assert from 'node:assert/strict';
import test from 'node:test';

import { MarketCheckQuotaError } from '../marketcheck/mcp-adapter';
import type { DetailResponse, LiveSearchResult, LiveVehicle } from '../marketcheck/mcp-adapter';

import { handleDiscoverListing, handleDiscoverSearch } from './handlers';
import { MemoryRateLimitStore } from './rate-limit';

const VIN = '4T1B11HK5JU123456';

function vehicle(): LiveVehicle {
  return {
    id: 'listing-live-1',
    vin: VIN,
    year: 2021,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'XLE',
    condition: 'used',
    price: 28990,
    miles: 41200,
    bodyType: 'SUV',
    primaryPhotoUrl: 'https://cdn.dealer.example/rav4.jpg',
    photoUrls: ['https://cdn.dealer.example/rav4.jpg'],
    location: {
      latitude: 35.21,
      longitude: -80.85,
      dealerName: 'Hidden Motors',
      dealerCity: 'Charlotte',
      dealerState: 'NC',
    },
  };
}

function searchResult(): LiveSearchResult {
  return {
    vehicles: [vehicle()],
    numFound: 42,
    returned: 1,
    start: 0,
    rows: 10,
    fromCache: false,
    latencyMs: 12,
  };
}

function detail(): DetailResponse {
  return {
    id: 'listing-live-1',
    vin: VIN,
    year: 2021,
    make: 'Toyota',
    model: 'RAV4',
    condition: 'used',
    price: 28990,
    miles: 41200,
    photoUrls: ['https://cdn.dealer.example/rav4.jpg'],
    location: {
      latitude: 35.21,
      longitude: -80.85,
      dealerName: 'Hidden Motors',
      dealerCity: 'Charlotte',
      dealerState: 'NC',
      dealerPhone: '803-555-0100',
    },
    enrichedAt: new Date().toISOString(),
    partial: false,
  };
}

function searchRequest(body: unknown, ip = '203.0.113.50'): Request {
  return new Request('https://api.drevvy.com/api/public/discover/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function detailRequest(id: string, ip = '203.0.113.50'): Request {
  return new Request(`https://api.drevvy.com/api/public/discover/listings/${id}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

async function readJson(response: Response): Promise<{ status: number; body: Record<string, unknown> }> {
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

test('anonymous search returns allow-listed listings without an API key', async () => {
  const store = new MemoryRateLimitStore();
  let calls = 0;
  const response = await handleDiscoverSearch(
    searchRequest({ latitude: 35.2271, longitude: -80.8431, page_size: 10 }),
    {
      rateLimitStore: store,
      search: async () => {
        calls += 1;
        return searchResult();
      },
    },
  );
  const { status, body } = await readJson(response);
  assert.equal(status, 200);
  assert.equal(calls, 1);
  assert.equal(body.success, true);
  const data = body.data as { listings: Array<Record<string, unknown>> };
  assert.equal(data.listings[0]?.id, 'listing-live-1');
  assert.equal(JSON.stringify(body).includes('Hidden Motors'), false);
  assert.equal(JSON.stringify(body).includes('x-api-key'), false);
  assert.equal(response.headers.get('RateLimit-Limit'), '20');
});

test('validation errors are 400 before MarketCheck is called', async () => {
  const store = new MemoryRateLimitStore();
  let calls = 0;
  const response = await handleDiscoverSearch(
    searchRequest({ latitude: 35.2271 }),
    {
      rateLimitStore: store,
      search: async () => {
        calls += 1;
        return searchResult();
      },
    },
  );
  const { status, body } = await readJson(response);
  assert.equal(status, 400);
  assert.equal(calls, 0);
  const error = body.error as { code: string };
  assert.equal(error.code, 'INVALID_LOCATION');
  assert.equal(body.success, false);
});

test('over-limit search is 429 RATE_LIMITED and skips MarketCheck', async () => {
  const store = new MemoryRateLimitStore();
  const nowMs = 1_700_000_240_000;
  let calls = 0;
  const deps = {
    nowMs,
    rateLimitStore: store,
    search: async () => {
      calls += 1;
      return searchResult();
    },
  };
  for (let i = 0; i < 20; i += 1) {
    const ok = await handleDiscoverSearch(
      searchRequest({ latitude: 35.2271, longitude: -80.8431 }, '198.51.100.9'),
      deps,
    );
    assert.equal(ok.status, 200);
  }
  const blocked = await handleDiscoverSearch(
    searchRequest({ latitude: 35.2271, longitude: -80.8431 }, '198.51.100.9'),
    deps,
  );
  const { status, body } = await readJson(blocked);
  assert.equal(status, 429);
  assert.equal((body.error as { code: string }).code, 'RATE_LIMITED');
  assert.ok(blocked.headers.get('Retry-After'));
  assert.equal(calls, 20);
});

test('missing listing is 404 LISTING_NOT_FOUND', async () => {
  const store = new MemoryRateLimitStore();
  const response = await handleDiscoverListing(detailRequest('no-such-listing-id'), 'no-such-listing-id', {
    rateLimitStore: store,
    detail: async () => null,
  });
  const { status, body } = await readJson(response);
  assert.equal(status, 404);
  assert.equal((body.error as { code: string }).code, 'LISTING_NOT_FOUND');
});

test('detail does not require a shared inventory key and strips dealer fields', async () => {
  const store = new MemoryRateLimitStore();
  const response = await handleDiscoverListing(detailRequest('listing-live-1'), 'listing-live-1', {
    rateLimitStore: store,
    detail: async () => detail(),
  });
  const { status, body } = await readJson(response);
  assert.equal(status, 200);
  const listing = (body.data as Record<string, unknown>);
  assert.equal(listing.id, 'listing-live-1');
  assert.equal(JSON.stringify(body).includes('Hidden Motors'), false);
  assert.equal(JSON.stringify(body).includes('803-555-0100'), false);
  assert.equal(response.headers.get('x-api-key'), null);
});

test('a missing MarketCheck envelope is 502, not an empty demo page', async () => {
  const store = new MemoryRateLimitStore();
  const response = await handleDiscoverSearch(
    searchRequest({ latitude: 35.2271, longitude: -80.8431 }),
    {
      rateLimitStore: store,
      search: async () => ({
        vehicles: [],
        numFound: 0,
        returned: 0,
        start: 0,
        rows: 10,
        fromCache: false,
        latencyMs: 8,
        upstreamFailed: true,
      }),
    },
  );
  const { status, body } = await readJson(response);
  assert.equal(status, 502);
  assert.equal((body.error as { code: string }).code, 'UPSTREAM_ERROR');
  assert.equal('data' in body, false);
});

test('MarketCheck quota becomes 502 UPSTREAM_ERROR with no demo rows', async () => {
  const store = new MemoryRateLimitStore();
  const response = await handleDiscoverSearch(
    searchRequest({ latitude: 35.2271, longitude: -80.8431 }),
    {
      rateLimitStore: store,
      search: async () => {
        throw new MarketCheckQuotaError();
      },
    },
  );
  const { status, body } = await readJson(response);
  assert.equal(status, 502);
  assert.equal((body.error as { code: string }).code, 'UPSTREAM_ERROR');
  assert.equal('data' in body, false);
});

test('invalid listing id is 400 and does not call detail', async () => {
  let calls = 0;
  const response = await handleDiscoverListing(detailRequest('no'), 'no', {
    rateLimitStore: new MemoryRateLimitStore(),
    detail: async () => {
      calls += 1;
      return detail();
    },
  });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, 'INVALID_ID');
});
