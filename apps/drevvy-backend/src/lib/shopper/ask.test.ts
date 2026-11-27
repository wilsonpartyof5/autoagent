import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ConsumerAuthError } from '@/lib/consumer/auth';
import type { LiveSearchFilters, LiveVehicle } from '@/lib/marketcheck/mcp-adapter';
import { DiscoverApiError } from '@/lib/public-discover/errors';
import { MemoryRateLimitStore } from '@/lib/public-discover/rate-limit';
import { publicListingsContainForbiddenKey } from '@/lib/public-discover/allowlist';
import { parseDiscoverSearchBody } from '@/lib/public-discover/schema';
import { deterministicParse, parseAskQuery } from '@/lib/query/deterministic-parse';
import type { CanonicalFilters } from '@/lib/query/resolve-canonical-filters';

import {
  ASK_PER_DAY,
  ASK_PER_HOUR,
  askLimitWindows,
  handleConsumerAsk,
  shopperHasDealerMembership,
  type AskHandlerDeps,
} from './ask';

const HERE = dirname(fileURLToPath(import.meta.url));
const USER = '11111111-2222-4333-8444-555555555555';
const FORT_MILL = '150s under $45k in fort mill South Carolina';
const GENERATED = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ECHO = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

function vehicle(): LiveVehicle {
  return {
    id: 'listing-f150',
    vin: '1FTEW1EP5MFA00001',
    year: 2022,
    make: 'Ford',
    model: 'F-150',
    trim: 'XLT',
    condition: 'used',
    price: 42995,
    miles: 21000,
    bodyType: 'Pickup',
    primaryPhotoUrl: 'https://cdn.example.com/f150.jpg',
    photoUrls: ['https://cdn.example.com/f150.jpg'],
    location: {
      latitude: 35.01,
      longitude: -80.95,
      dealerName: 'Secret Motors',
      dealerCity: 'Fort Mill',
      dealerState: 'SC',
      dealerPhone: '803-555-0199',
      email: 'sales@secret.test',
    } as LiveVehicle['location'],
  };
}

function askRequest(body: unknown, authorization = 'Bearer shopper-jwt'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorization) headers.authorization = authorization;
  return new Request('https://api.drevvy.com/api/consumer/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function harness(overrides: AskHandlerDeps = {}) {
  const calls: LiveSearchFilters[] = [];
  const lines: string[] = [];
  const deps: AskHandlerDeps = {
    requireAuth: async () => ({ userId: USER }),
    dealerLookup: async () => false,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' },
    nowMs: 1_700_000_000_000,
    uuid: () => GENERATED,
    geocode: async (text: string) => ({ raw: text, lat: 35.0076, lng: -80.945, source: 'geocode' }),
    resolveCanonical: async (filters: CanonicalFilters) => ({ canonicalFilters: filters }),
    search: async (params) => {
      calls.push(params.filters ?? {});
      return { vehicles: [vehicle()], numFound: 3 };
    },
    log: (line) => { lines.push(line); },
    origin: 'https://api.drevvy.com',
    ...overrides,
  };
  return { calls, lines, deps };
}

async function errorBody(response: Response) {
  const body = await response.json() as {
    success?: boolean;
    error?: { code?: string; message?: string };
  };
  return body;
}

function assertConsumerError(body: Awaited<ReturnType<typeof errorBody>>, code: string) {
  assert.deepEqual(Object.keys(body).sort(), ['error', 'success']);
  assert.equal(body.success, false);
  assert.ok(body.error);
  assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  assert.ok((body.error.message ?? '').length > 0);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('stack'), false);
  assert.equal(serialized.includes('Bearer'), false);
}

test('colloquial trucks, prices, and places parse without a model', () => {
  const fortMill = deterministicParse(FORT_MILL);
  assert.equal(fortMill.filters.make, 'Ford');
  assert.equal(fortMill.filters.model, 'F-150');
  assert.equal(fortMill.filters.maxPrice, 45000);
  assert.equal(fortMill.filters.locationText, 'Fort Mill, SC');

  assert.equal(deterministicParse('f150s').filters.model, 'F-150');
  assert.equal(deterministicParse('f-150s').filters.model, 'F-150');
  assert.equal(deterministicParse('250s').filters.model, 'F-250');
  assert.equal(deterministicParse('f250s').filters.model, 'F-250');
  assert.equal(deterministicParse('350s').filters.model, 'F-350');
  assert.equal(deterministicParse('f350s').filters.make, 'Ford');

  const silverado = deterministicParse('silverados under 45k');
  assert.equal(silverado.filters.make, 'Chevrolet');
  assert.equal(silverado.filters.model, 'Silverado');
  assert.equal(silverado.filters.maxPrice, 45000);

  const ram = deterministicParse('rams near 29708');
  assert.equal(ram.filters.make, 'RAM');
  assert.equal(ram.filters.model, '1500');
  assert.equal(ram.filters.locationText, '29708');

  const tundra = deterministicParse('tundras under 45,000');
  assert.equal(tundra.filters.make, 'Toyota');
  assert.equal(tundra.filters.model, 'Tundra');
  assert.equal(tundra.filters.maxPrice, 45000);

  assert.equal(deterministicParse('under $45k').filters.maxPrice, 45000);
  assert.equal(deterministicParse('a truck for 45k').filters.maxPrice, 45000);
  assert.equal(deterministicParse('in charlotte north carolina').filters.locationText, 'Charlotte, NC');
});

test('a missing model credential and a failed model call keep the pre-parse', async () => {
  const missing = await parseAskQuery(FORT_MILL, { env: {} });
  assert.equal(missing?.filters.make, 'Ford');
  assert.equal(missing?.filters.model, 'F-150');
  assert.equal(missing?.filters.maxPrice, 45000);

  let called = false;
  const failed = await parseAskQuery(FORT_MILL, {
    env: { AI_GATEWAY_API_KEY: 'gw-test' },
    parseWithModel: async () => {
      called = true;
      throw new Error('model down jane@example.com');
    },
  });
  assert.equal(called, true);
  assert.equal(failed?.filters.model, 'F-150');
  assert.equal(failed?.filters.locationText, 'Fort Mill, SC');

  const overridden = await parseAskQuery('150s under $45k', {
    env: { AI_GATEWAY_API_KEY: 'gw-test' },
    parseWithModel: async () => ({
      filters: { model: '150s', maxPrice: 1 },
      explicitFields: ['model', 'maxPrice'],
      confidence: 0.4,
    }),
  });
  assert.equal(overridden?.filters.make, 'Ford');
  assert.equal(overridden?.filters.model, 'F-150');
  assert.equal(overridden?.filters.maxPrice, 45000);
});

test('discover rejects a dollar sign in a name and Ask sends parsed filters', async () => {
  assert.throws(
    () => parseDiscoverSearchBody({
      latitude: 35.0076,
      longitude: -80.945,
      filters: { make: '$45k' },
    }),
    (error: unknown) => error instanceof DiscoverApiError && error.code === 'INVALID_FILTERS',
  );

  const { calls, deps } = harness();
  const response = await handleConsumerAsk(askRequest({ message: FORT_MILL }), deps);
  assert.equal(response.status, 200);
  const body = await response.json() as {
    filters: { make: string; model: string; maxPrice: number; location: string };
    listings: Array<Record<string, unknown>>;
    total: number;
    reply: string;
    conversationId: string;
  };
  assert.equal(body.filters.make, 'Ford');
  assert.equal(body.filters.model, 'F-150');
  assert.equal(body.filters.maxPrice, 45000);
  assert.equal(body.filters.location, 'Fort Mill, SC');
  assert.equal(JSON.stringify(body.filters).includes('$'), false);
  assert.equal(JSON.stringify(calls[0]).includes(FORT_MILL), false);
  assert.equal(calls[0]?.make, 'Ford');
  assert.equal(calls[0]?.model, 'F-150');
  assert.equal(calls[0]?.maxPrice, 45000);
  assert.equal(body.total, 3);
  assert.equal(body.conversationId, GENERATED);
  const listing = JSON.stringify(body.listings);
  assert.equal(listing.includes('Secret Motors'), false);
  assert.equal(listing.includes('803-555-0199'), false);
  assert.equal(listing.includes('sales@secret.test'), false);
  assert.equal(listing.includes('dealerName'), false);
  assert.equal(listing.includes('dealer_name'), false);
  assert.equal(publicListingsContainForbiddenKey(body.listings), false);
  assert.equal(typeof body.listings[0]?.dist, 'number');
  assert.equal(body.reply.includes('803-555-0199'), false);
  assert.equal(body.reply.includes('sales@secret.test'), false);
});

test('ask errors use the consumer error object', async () => {
  const missing = await handleConsumerAsk(new Request('https://api.drevvy.com/api/consumer/ask', { method: 'POST' }));
  assert.equal(missing.status, 401);
  assertConsumerError(await errorBody(missing), 'unauthorized');

  const dealer = harness({ dealerLookup: async () => true });
  const rejected = await handleConsumerAsk(askRequest({ message: FORT_MILL }), dealer.deps);
  assert.equal(rejected.status, 403);
  assertConsumerError(await errorBody(rejected), 'dealer_account');
  assert.equal(dealer.calls.length, 0);

  const shared = harness({
    requireAuth: async () => {
      throw new ConsumerAuthError('The inventory search key is not a consumer sign-in.', 401, 'shared_key_rejected');
    },
  });
  const sharedResponse = await handleConsumerAsk(askRequest({ message: FORT_MILL }, 'Bearer shared-key'), shared.deps);
  assert.equal(sharedResponse.status, 401);
  assertConsumerError(await errorBody(sharedResponse), 'unauthorized');

  const invalid = harness();
  const bad = await handleConsumerAsk(askRequest({ message: '' }), invalid.deps);
  assert.equal(bad.status, 400);
  assertConsumerError(await errorBody(bad), 'invalid_request');

  const long = harness();
  const tooLong = await handleConsumerAsk(askRequest({ message: 'a'.repeat(501) }), long.deps);
  assert.equal(tooLong.status, 400);
  assertConsumerError(await errorBody(tooLong), 'invalid_request');

  const coords = harness();
  const half = await handleConsumerAsk(askRequest({ message: 'trucks', lat: 35.1 }), coords.deps);
  assert.equal(half.status, 400);
  assertConsumerError(await errorBody(half), 'invalid_request');

  const zip = harness();
  const badZip = await handleConsumerAsk(askRequest({ message: 'trucks', zip: 'abc' }), zip.deps);
  assert.equal(badZip.status, 400);
  assertConsumerError(await errorBody(badZip), 'invalid_request');

  const thread = harness();
  const badThread = await handleConsumerAsk(askRequest({ message: FORT_MILL, conversationId: 'not-a-uuid' }), thread.deps);
  assert.equal(badThread.status, 400);
  assertConsumerError(await errorBody(badThread), 'invalid_request');

  const unavailable = harness({
    parse: async () => null,
  });
  const hello = await handleConsumerAsk(askRequest({ message: 'hello there' }), unavailable.deps);
  assert.equal(hello.status, 503);
  assertConsumerError(await errorBody(hello), 'ask_unavailable');
  assert.equal(unavailable.calls.length, 0);
});

test('a shopper conversation id is echoed or generated and is not stored', async () => {
  const generated = harness();
  const first = await handleConsumerAsk(askRequest({ message: FORT_MILL }), generated.deps);
  const firstBody = await first.json() as { conversationId: string };
  assert.equal(first.status, 200);
  assert.equal(firstBody.conversationId, GENERATED);

  const echoed = harness();
  const second = await handleConsumerAsk(
    askRequest({ message: FORT_MILL, conversationId: ECHO }),
    echoed.deps,
  );
  const secondBody = await second.json() as { conversationId: string };
  assert.equal(secondBody.conversationId, ECHO);

  const source = readFileSync(join(HERE, 'ask.ts'), 'utf8');
  const route = readFileSync(join(HERE, '../../app/api/consumer/ask/route.ts'), 'utf8');
  assert.match(source, /client-side thread id/);
  assert.match(route, /not written to the database/);
  assert.equal(source.includes('.insert('), false);
  assert.equal(source.includes('.upsert('), false);
  assert.equal(source.includes('.delete('), false);
  assert.equal(route.includes('.insert('), false);
});

test('ask is limited to 20 an hour and 100 a day per shopper', async () => {
  const windows = askLimitWindows(USER);
  assert.equal(windows[0]?.limit, ASK_PER_HOUR);
  assert.equal(windows[1]?.limit, ASK_PER_DAY);
  assert.equal(windows[0]?.windowMs, 60 * 60 * 1000);
  const store = new MemoryRateLimitStore();
  const { deps } = harness({ store });
  for (let i = 0; i < ASK_PER_HOUR; i += 1) {
    const response = await handleConsumerAsk(askRequest({ message: FORT_MILL }), deps);
    assert.equal(response.status, 200);
  }
  const limited = await handleConsumerAsk(askRequest({ message: FORT_MILL }), deps);
  assert.equal(limited.status, 429);
  assertConsumerError(await errorBody(limited), 'rate_limited');
});

test('ask logs a user hash, status, and latency only', async () => {
  const { lines, deps } = harness();
  const message = `${FORT_MILL} from Dana Blake jane@example.com`;
  const response = await handleConsumerAsk(
    askRequest({ message }, 'Bearer eyJhbGciOi-secret-jwt'),
    deps,
  );
  assert.equal(response.status, 200);
  assert.equal(lines.length, 1);
  const line = lines[0] ?? '';
  assert.equal(line.includes(message), false);
  assert.equal(line.includes('Dana'), false);
  assert.equal(line.includes('jane@example.com'), false);
  assert.equal(line.includes('eyJhbGciOi-secret-jwt'), false);
  assert.equal(line.includes('Bearer'), false);
  assert.equal(line.includes(USER), false);
  assert.equal(line.includes('Secret Motors'), false);
  const parsed = JSON.parse(line) as { event: string; user: string; status: number; latencyMs: number };
  assert.deepEqual(Object.keys(parsed).sort(), ['event', 'latencyMs', 'status', 'user']);
  assert.equal(parsed.event, 'consumer_ask');
  assert.equal(parsed.status, 200);
  assert.equal(typeof parsed.latencyMs, 'number');
  assert.match(parsed.user, /^[0-9a-f]{12}$/);
});

test('a dealer membership is the same user_dealerships check, and ask spends no keys', async () => {
  assert.equal(await shopperHasDealerMembership(USER, async () => true), true);
  assert.equal(await shopperHasDealerMembership(USER, async () => false), false);

  const source = readFileSync(join(HERE, 'ask.ts'), 'utf8');
  const route = readFileSync(join(HERE, '../../app/api/consumer/ask/route.ts'), 'utf8');
  const search = readFileSync(join(HERE, '../query/inventory-search.ts'), 'utf8');
  for (const text of [source, route, search]) {
    assert.equal(text.includes('spendMarketSaveKey'), false);
    assert.equal(text.includes('consume_credit'), false);
    assert.equal(text.includes('getMarketCheckPrice'), false);
    assert.equal(text.includes('market-intel'), false);
  }
  assert.match(source, /user_dealerships/);
  assert.match(source, /requireConsumerAuth/);
  assert.match(source, /SHOPPING_MODEL/);
  assert.equal(search.includes('getMarketCheckPrice'), false);
  assert.match(search, /searchActiveCarsMcp/);
});

test('chat-search still requires the shared key and keeps its shopping model', async () => {
  const route = readFileSync(join(HERE, '../../app/api/query/chat-search/route.ts'), 'utf8');
  assert.match(route, /function validateApiKey/);
  assert.match(route, /INVENTORY_SEARCH_API_KEY/);
  assert.match(route, /parseQueryWithOpenAI\(/);
  assert.match(route, /SHOPPING_MODEL/);
  assert.match(route, /redactShopperDealerIdentity\(/);
  assert.match(route, /searchResolvedInventory\(/);
  const authIndex = route.indexOf('if (!validateApiKey(request))');
  const parseIndex = route.indexOf('parseQueryWithOpenAI(');
  assert.ok(authIndex >= 0 && parseIndex > authIndex);

  const { POST } = await import('../../app/api/query/chat-search/route');
  const response = await POST(new Request('https://api.drevvy.com/api/query/chat-search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'suv near charlotte' }),
  }) as never);
  assert.equal(response.status, 401);
  const body = await response.json() as { success: boolean; error: { code: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'UNAUTHORIZED');
});
