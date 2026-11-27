import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type OpenAI from 'openai';

import { ConsumerAuthError } from '@/lib/consumer/auth';
import type { LiveSearchFilters, LiveVehicle } from '@/lib/marketcheck/mcp-adapter';
import { DiscoverApiError } from '@/lib/public-discover/errors';
import { MemoryRateLimitStore } from '@/lib/public-discover/rate-limit';
import { publicListingsContainForbiddenKey } from '@/lib/public-discover/allowlist';
import { parseDiscoverSearchBody } from '@/lib/public-discover/schema';
import { deterministicParse, parseAskQuery } from '@/lib/query/deterministic-parse';
import { geocodeLocation, scrubShopperMessage, toMapboxPlace } from '@/lib/query/parse-inventory-query';
import { canonicalResolveLogRecord, upstreamErrorLog } from '@/lib/query/resolve-canonical-filters';
import { SHOPPING_GATEWAY_BASE_URL, SHOPPING_MODEL } from '@/lib/query/shopping-llm';
import type { CanonicalFilters } from '@/lib/query/resolve-canonical-filters';

import {
  ASK_CONVERSATION_INFO,
  ASK_PER_DAY,
  ASK_PER_HOUR,
  ASK_PER_IP_HOUR,
  askLimitWindows,
  allowAskFilterFields,
  handleConsumerAsk,
  issueAskConversationId,
  roundAskCoordinate,
  shopperHasDealerMembership,
  type AskHandlerDeps,
} from './ask';
import {
  ASK_OPENAI_BASE_URL,
  ASK_PARSE_MAX_TOKENS,
  askNativeModel,
  callAskModel,
  type AskModelContext,
  type AskModelResult,
} from './ask-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const USER = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-8888-4777-8666-555555555555';
const FORT_MILL = '150s under $45k in fort mill South Carolina';
const GENERATED = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const SIGNING = 'test-signing-secret-value';
const PEPPER = 'test-ip-pepper';

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

function askRequest(
  body: unknown,
  authorization = 'Bearer shopper-jwt',
  ip = '203.0.113.10',
  forwardedFor = ip,
): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-vercel-forwarded-for': ip,
    'x-forwarded-for': forwardedFor,
  };
  if (authorization) headers.authorization = authorization;
  return new Request('https://api.drevvy.com/api/consumer/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function testEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    SUPABASE_JWT_SECRET: SIGNING,
    DREVVY_IP_HASH_PEPPER: PEPPER,
    ...extra,
  };
}

function harness(overrides: AskHandlerDeps = {}) {
  const calls: LiveSearchFilters[] = [];
  const points: Array<{ latitude: number; longitude: number }> = [];
  const lines: string[] = [];
  const deps: AskHandlerDeps = {
    requireAuth: async () => ({ userId: USER }),
    dealerLookup: async () => false,
    store: new MemoryRateLimitStore(),
    env: testEnv(),
    nowMs: 1_700_000_000_000,
    uuid: () => GENERATED,
    geocode: async (text: string) => ({ raw: text, lat: 35.0076, lng: -80.945, source: 'geocode' }),
    resolveCanonical: async (filters: CanonicalFilters) => ({ canonicalFilters: filters }),
    search: async (params) => {
      calls.push(params.filters ?? {});
      points.push({ latitude: params.latitude, longitude: params.longitude });
      return { vehicles: [vehicle()], numFound: 3 };
    },
    log: (line) => { lines.push(line); },
    origin: 'https://api.drevvy.com',
    ...overrides,
  };
  return { calls, points, lines, deps };
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
  assert.equal(body.conversationId, issueAskConversationId(USER, SIGNING, () => GENERATED));
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
  const badThread = await handleConsumerAsk(askRequest({ message: FORT_MILL, conversationId: 12 }), thread.deps);
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

test('a conversation id is signed for this shopper and is not stored', async () => {
  const expected = issueAskConversationId(USER, SIGNING, () => GENERATED);
  const generated = harness();
  const first = await handleConsumerAsk(askRequest({ message: FORT_MILL }), generated.deps);
  const firstBody = await first.json() as { conversationId: string };
  assert.equal(first.status, 200);
  assert.equal(firstBody.conversationId, expected);
  assert.equal(firstBody.conversationId.startsWith(`${GENERATED}.`), true);
  assert.equal(firstBody.conversationId.includes(USER), false);

  const echoed = harness();
  const second = await handleConsumerAsk(
    askRequest({ message: FORT_MILL, conversationId: firstBody.conversationId }),
    echoed.deps,
  );
  const secondBody = await second.json() as { conversationId: string };
  assert.equal(secondBody.conversationId, firstBody.conversationId);

  const malformed = harness();
  const replaced = await handleConsumerAsk(
    askRequest({ message: FORT_MILL, conversationId: 'not-a-uuid' }),
    malformed.deps,
  );
  const replacedBody = await replaced.json() as { conversationId: string };
  assert.equal(replaced.status, 200);
  assert.equal(replacedBody.conversationId, expected);

  const stolen = issueAskConversationId(OTHER, SIGNING, () => GENERATED);
  const mismatch = harness();
  const forbidden = await handleConsumerAsk(
    askRequest({ message: FORT_MILL, conversationId: stolen }),
    mismatch.deps,
  );
  assert.equal(forbidden.status, 403);
  assertConsumerError(await errorBody(forbidden), 'conversation_forbidden');
  assert.equal(mismatch.calls.length, 0);

  const unsigned = harness({ env: testEnv({ SUPABASE_JWT_SECRET: '', CRON_SECRET: '' }) });
  const down = await handleConsumerAsk(askRequest({ message: FORT_MILL }), unsigned.deps);
  assert.equal(down.status, 503);
  assertConsumerError(await errorBody(down), 'ask_unavailable');

  const source = readFileSync(join(HERE, 'ask.ts'), 'utf8');
  const route = readFileSync(join(HERE, '../../app/api/consumer/ask/route.ts'), 'utf8');
  const rawMac = createHmac('sha256', SIGNING).update(`${USER}.${GENERATED}`).digest('hex');
  const issued = issueAskConversationId(USER, SIGNING, () => GENERATED);
  assert.notEqual(issued.split('.')[1], rawMac);
  const rawKey = harness();
  const rawRejected = await handleConsumerAsk(
    askRequest({ message: FORT_MILL, conversationId: `${GENERATED}.${rawMac}` }),
    rawKey.deps,
  );
  assert.equal(rawRejected.status, 403);
  assertConsumerError(await errorBody(rawRejected), 'conversation_forbidden');

  assert.match(source, /createHmac\('sha256'/);
  assert.match(source, /hkdfSync\('sha256'/);
  assert.match(source, /SUPABASE_JWT_SECRET/);
  assert.match(source, /CRON_SECRET/);
  assert.equal(source.includes(ASK_CONVERSATION_INFO), true);
  assert.match(route, /not written to the database/);
  assert.equal(source.includes('.insert('), false);
  assert.equal(source.includes('.upsert('), false);
  assert.equal(source.includes('.delete('), false);
  assert.equal(route.includes('.insert('), false);
});

test('ask is limited to 20 an hour and 100 a day per shopper', async () => {
  const windows = askLimitWindows(USER, '203.0.113.10', testEnv());
  assert.equal(windows[0]?.limit, ASK_PER_HOUR);
  assert.equal(windows[1]?.limit, ASK_PER_DAY);
  assert.equal(windows[2]?.limit, ASK_PER_IP_HOUR);
  assert.equal(windows[0]?.windowMs, 60 * 60 * 1000);
  assert.equal(windows[2]?.bucket.includes('203.0.113.10'), false);
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
  const leaked: string[] = [];
  const originals = { log: console.log, error: console.error, warn: console.warn };
  console.log = (...args: unknown[]) => { leaked.push(args.map(String).join(' ')); };
  console.error = (...args: unknown[]) => { leaked.push(args.map(String).join(' ')); };
  console.warn = (...args: unknown[]) => { leaked.push(args.map(String).join(' ')); };
  let response: Response;
  try {
    response = await handleConsumerAsk(
      askRequest({ message, lat: 41.40338, lng: -81.90944, zip: '44114' }, 'Bearer eyJhbGciOi-secret-jwt'),
      deps,
    );
  } finally {
    console.log = originals.log;
    console.error = originals.error;
    console.warn = originals.warn;
  }
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
  assert.equal(line.includes('41.40338'), false);
  assert.equal(line.includes('-81.90944'), false);
  assert.equal(line.includes('44114'), false);
  const consoleText = leaked.join('\n');
  assert.equal(consoleText.includes(message), false);
  assert.equal(consoleText.includes('41.40338'), false);
  assert.equal(consoleText.includes('-81.90944'), false);
  assert.equal(consoleText.includes('44114'), false);
  assert.equal(consoleText.includes('jane@example.com'), false);
  const parsed = JSON.parse(line) as {
    event: string;
    user: string;
    status: number;
    latencyMs: number;
    provider: string;
  };
  assert.deepEqual(Object.keys(parsed).sort(), ['event', 'latencyMs', 'provider', 'status', 'user']);
  assert.equal(parsed.event, 'consumer_ask');
  assert.equal(parsed.provider, 'parser');
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
  assert.match(source, /callAskModel|askModel/);
  const askModelSource = readFileSync(join(HERE, 'ask-model.ts'), 'utf8');
  assert.match(askModelSource, /SHOPPING_MODEL/);
  assert.match(askModelSource, /openai\/gpt-6-luna|SHOPPING_MODEL/);
  const model = readFileSync(join(HERE, '../query/shopping-llm.ts'), 'utf8');
  assert.match(model, /openai\/gpt-6-luna/);
  assert.equal(search.includes('getMarketCheckPrice'), false);
  assert.match(search, /searchActiveCarsMcp/);
});

test('ask limits each IP to 60 an hour on the same counter', async () => {
  const ip = '203.0.113.50';
  const windows = askLimitWindows(USER, ip, testEnv());
  assert.equal(windows[2]?.limit, ASK_PER_IP_HOUR);
  assert.equal(windows[2]?.windowMs, 60 * 60 * 1000);
  assert.equal(windows[2]?.bucket.includes(ip), false);
  const store = new MemoryRateLimitStore();
  for (let i = 0; i < ASK_PER_IP_HOUR; i += 1) {
    const userId = `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`;
    const { deps } = harness({ store, requireAuth: async () => ({ userId }) });
    const response = await handleConsumerAsk(askRequest({ message: FORT_MILL }, 'Bearer shopper-jwt', ip), deps);
    assert.equal(response.status, 200);
  }
  const blocked = harness({
    store,
    requireAuth: async () => ({ userId: '33333333-3333-4333-8333-333333333333' }),
  });
  const limited = await handleConsumerAsk(askRequest({ message: FORT_MILL }, 'Bearer shopper-jwt', ip), blocked.deps);
  assert.equal(limited.status, 429);
  assertConsumerError(await errorBody(limited), 'rate_limited');

  const other = harness({
    store,
    requireAuth: async () => ({ userId: '44444444-4444-4444-8444-444444444444' }),
  });
  const allowed = await handleConsumerAsk(
    askRequest({ message: FORT_MILL }, 'Bearer shopper-jwt', '198.51.100.8'),
    other.deps,
  );
  assert.equal(allowed.status, 200);
});

test('the model reply and the listings omit dealer phone, email, and name', async () => {
  const { deps } = harness({
    reply: async () => 'Call Secret Motors at 803-555-0199 or sales@secret.test today.',
  });
  const response = await handleConsumerAsk(askRequest({ message: FORT_MILL }), deps);
  assert.equal(response.status, 200);
  const body = await response.json() as { reply: string; listings: Array<Record<string, unknown>> };
  assert.equal(body.reply.includes('803-555-0199'), false);
  assert.equal(body.reply.includes('sales@secret.test'), false);
  assert.equal(body.reply.includes('Secret Motors'), false);
  const listing = JSON.stringify(body.listings);
  assert.equal(listing.includes('803-555-0199'), false);
  assert.equal(listing.includes('sales@secret.test'), false);
  assert.equal(listing.includes('Secret Motors'), false);
  assert.equal(publicListingsContainForbiddenKey(body.listings), false);
});

test('ask verifies the shopper JWT with Supabase getUser and does not decode it', async () => {
  const auth = readFileSync(join(HERE, '../consumer/auth.ts'), 'utf8');
  const source = readFileSync(join(HERE, 'ask.ts'), 'utf8');
  const route = readFileSync(join(HERE, '../../app/api/consumer/ask/route.ts'), 'utf8');
  assert.match(auth, /auth\.getUser\(/);
  assert.match(source, /requireConsumerAuth/);
  const getUserAt = auth.indexOf('auth.getUser(');
  const decodeAt = auth.search(/jwt\.decode|jsonwebtoken|atob\(/);
  assert.ok(getUserAt >= 0);
  assert.equal(decodeAt, -1);
  assert.equal(/jwt\.decode|jsonwebtoken|atob\(/.test(source), false);
  assert.equal(/jwt\.decode|jsonwebtoken|atob\(/.test(route), false);

  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(req.url ?? '');
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'invalid JWT' }));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test auth server did not bind');
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'attacker-shopper', role: 'authenticated' })).toString('base64url');
  try {
    const response = await handleConsumerAsk(new Request('https://api.drevvy.com/api/consumer/ask', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${header}.${payload}.sig`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: FORT_MILL }),
    }));
    assert.equal(response.status, 401);
    const body = await errorBody(response);
    assertConsumerError(body, 'unauthorized');
    assert.equal(JSON.stringify(body).includes('attacker-shopper'), false);
    assert.ok(hits.some((url) => url.includes('/auth/v1/user')));
  } finally {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
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

test('shopper text is scrubbed before the model and Mapbox sees city, state, or ZIP', async () => {
  const raw = '150s under $45k at 123 Main Street in fort mill South Carolina. Email jane@example.com or call 803-555-0199.';
  const scrubbed = scrubShopperMessage(raw);
  assert.equal(scrubbed.includes('jane@example.com'), false);
  assert.equal(scrubbed.includes('803-555-0199'), false);
  assert.equal(scrubbed.includes('123 Main Street'), false);
  assert.match(scrubbed, /\[redacted\]/);
  assert.match(scrubbed, /fort mill South Carolina/i);
  assert.equal(toMapboxPlace('123 Main Street, Fort Mill, SC'), 'Fort Mill, SC');
  assert.equal(toMapboxPlace('jane@example.com near 29708'), '29708');
  assert.equal(toMapboxPlace('Fort Mill, SC'), 'Fort Mill, SC');
  assert.equal(toMapboxPlace('123 Main Street'), null);

  let seen = '';
  const parsed = await parseAskQuery(raw, {
    env: { AI_GATEWAY_API_KEY: 'gw-test' },
    parseWithModel: async (message) => {
      seen = message;
      return { filters: {}, explicitFields: [], confidence: 0 };
    },
  });
  assert.equal(seen.includes('jane@example.com'), false);
  assert.equal(seen.includes('803-555-0199'), false);
  assert.equal(seen.includes('123 Main Street'), false);
  assert.equal(parsed?.filters.locationText, 'Fort Mill, SC');
  assert.equal(parsed?.filters.make, 'Ford');
});

test('a reply that talks about negotiating or contacting a dealer falls back to the count', async () => {
  const phrases = [
    'We can negotiate with the dealer.',
    'Please contact the dealer for details.',
    'You should call the dealer.',
    'Email the dealer about this truck.',
    'Text the dealer to confirm.',
    'call/email/text the dealer',
  ];
  for (const phrase of phrases) {
    const { deps } = harness({ reply: async () => phrase });
    const response = await handleConsumerAsk(askRequest({ message: FORT_MILL }), deps);
    const body = await response.json() as { reply: string };
    assert.equal(response.status, 200, phrase);
    assert.equal(/negotiat/i.test(body.reply), false, phrase);
    assert.equal(/contact the dealer/i.test(body.reply), false, phrase);
    assert.equal(/\b(?:call|email|text) the dealer\b/i.test(body.reply), false, phrase);
    assert.match(body.reply, /Found 3 vehicles/, phrase);
  }
});

test('a body over 8KB is refused before it is parsed', async () => {
  const { calls, deps } = harness();
  const response = await handleConsumerAsk(new Request('https://api.drevvy.com/api/consumer/ask', {
    method: 'POST',
    headers: {
      authorization: 'Bearer shopper-jwt',
      'content-type': 'application/json',
      'content-length': '9000',
      'x-forwarded-for': '203.0.113.10',
    },
    body: JSON.stringify({ message: FORT_MILL }),
  }), deps);
  assert.equal(response.status, 413);
  assertConsumerError(await errorBody(response), 'invalid_request');
  assert.equal(calls.length, 0);
});

test('one bad filter is dropped and the rest are searched', async () => {
  const { calls, deps } = harness({
    parse: async () => ({
      filters: {
        make: 'jane@example.com',
        model: 'F-150',
        maxPrice: 45000,
        locationText: '123 Main Street, Fort Mill, SC',
      },
      explicitFields: ['make', 'model', 'maxPrice', 'locationText'],
      confidence: 0.8,
    }),
  });
  const response = await handleConsumerAsk(askRequest({ message: 'anything' }), deps);
  assert.equal(response.status, 200);
  const body = await response.json() as { filters: { make?: string; model?: string; location?: string } };
  assert.equal(body.filters.make, undefined);
  assert.equal(body.filters.model, 'F-150');
  assert.equal(body.filters.location, 'Fort Mill, SC');
  assert.equal(calls[0]?.make, undefined);
  assert.equal(calls[0]?.model, 'F-150');
  assert.equal(JSON.stringify(body.filters).includes('Main Street'), false);
  assert.equal(JSON.stringify(body.filters).includes('@'), false);

  const long = 'A'.repeat(90);
  const allowed = allowAskFilterFields({
    filters: { model: 'F-150', locationText: `${long}, SC` },
    explicitFields: ['model', 'locationText'],
    confidence: 1,
  });
  assert.equal((allowed.filters.locationText ?? '').length <= 80, true);
  assert.equal(allowed.filters.model, 'F-150');
});

test('ask rounds coordinates to two decimals before MarketCheck', async () => {
  assert.equal(roundAskCoordinate(35.0076), 35.01);
  assert.equal(roundAskCoordinate(-80.946), -80.95);
  const gps = harness();
  const fromGps = await handleConsumerAsk(
    askRequest({ message: '150s under 45k', lat: 35.0076, lng: -80.946 }),
    gps.deps,
  );
  assert.equal(fromGps.status, 200);
  assert.deepEqual(gps.points[0], { latitude: 35.01, longitude: -80.95 });

  const geocoded = harness({
    geocode: async () => ({ raw: 'Fort Mill, SC', lat: 35.00764, lng: -80.94612, source: 'geocode' }),
  });
  const fromPlace = await handleConsumerAsk(askRequest({ message: FORT_MILL }), geocoded.deps);
  assert.equal(fromPlace.status, 200);
  assert.deepEqual(geocoded.points[0], { latitude: 35.01, longitude: -80.95 });

  const search = readFileSync(join(HERE, '../query/inventory-search.ts'), 'utf8');
  const discover = readFileSync(join(HERE, '../public-discover/handlers.ts'), 'utf8');
  assert.equal(search.includes('roundAskCoordinate'), false);
  assert.equal(discover.includes('roundAskCoordinate'), false);
});

test('mapbox geocoding can be aborted and resolver logs omit shopper text', async () => {
  const previous = process.env.MAPBOX_ACCESS_TOKEN;
  process.env.MAPBOX_ACCESS_TOKEN = 'mapbox-test-token';
  const controller = new AbortController();
  const original = globalThis.fetch;
  let seen: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    seen = init?.signal;
    return new Response(JSON.stringify({ features: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    await geocodeLocation('Fort Mill, SC', { signal: controller.signal });
    assert.equal(seen, controller.signal);
  } finally {
    globalThis.fetch = original;
    if (previous == null) delete process.env.MAPBOX_ACCESS_TOKEN;
    else process.env.MAPBOX_ACCESS_TOKEN = previous;
  }

  const record = canonicalResolveLogRecord({
    latencyMs: 4,
    facetSource: 'mcp',
    fields: {
      make: { intent: 'jane@example.com', resolved: 'jane@example.com', source: 'fallback', confidence: 0.5 },
    },
  });
  assert.equal(JSON.stringify(record).includes('jane@example.com'), false);
  assert.deepEqual(record.fields, [{ field: 'make', source: 'fallback' }]);
  const failure = new Error('shopper said jane@example.com');
  (failure as Error & { code: string }).code = 'E_TEST';
  const logged = upstreamErrorLog('canonical_resolver_error', failure);
  assert.equal(JSON.stringify(logged).includes('jane@example.com'), false);
  assert.equal(logged.name, 'Error');
  assert.equal(logged.code, 'E_TEST');
  const source = readFileSync(join(HERE, '../query/resolve-canonical-filters.ts'), 'utf8');
  assert.equal(source.includes('err.message'), false);
  assert.equal(source.includes('intent: v.intent'), false);
  const search = readFileSync(join(HERE, '../query/inventory-search.ts'), 'utf8');
  assert.match(search, /timeoutMs: input.upstreamTimeoutMs/);
  assert.match(source, /AbortSignal\.timeout\(options\.timeoutMs\)/);
});

test('ask checks content-length, then the rate limit, then the dealer, then the model', async () => {
  const source = readFileSync(join(HERE, 'ask.ts'), 'utf8');
  const handler = source.slice(source.indexOf('export async function handleConsumerAsk'));
  const lengthAt = handler.indexOf("headers.get('content-length')");
  const rateAt = handler.indexOf('enforceAskLimit(');
  const dealerAt = handler.indexOf('shopperHasDealerMembership(');
  const modelAt = handler.indexOf('parseAskQuery(');
  assert.ok(lengthAt >= 0 && rateAt > lengthAt && dealerAt > rateAt && modelAt > dealerAt);

  let lookups = 0;
  const { calls, deps } = harness({
    dealerLookup: async () => {
      lookups += 1;
      return true;
    },
  });
  const oversized = await handleConsumerAsk(new Request('https://api.drevvy.com/api/consumer/ask', {
    method: 'POST',
    headers: {
      authorization: 'Bearer shopper-jwt',
      'content-type': 'application/json',
      'content-length': '9000',
      'x-forwarded-for': '203.0.113.10',
    },
    body: JSON.stringify({ message: FORT_MILL }),
  }), deps);
  assert.equal(oversized.status, 413);
  assert.equal(lookups, 0);
  assert.equal(calls.length, 0);
});

test('a rotated x-forwarded-for does not escape the IP cap', async () => {
  const vercelIp = '203.0.113.77';
  const store = new MemoryRateLimitStore();
  for (let i = 0; i < ASK_PER_IP_HOUR; i += 1) {
    const userId = `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`;
    const { deps } = harness({ store, requireAuth: async () => ({ userId }) });
    const response = await handleConsumerAsk(
      askRequest({ message: FORT_MILL }, 'Bearer shopper-jwt', vercelIp, `198.51.100.${i}`),
      deps,
    );
    assert.equal(response.status, 200, `request ${i}`);
  }
  let lookups = 0;
  const blocked = harness({
    store,
    dealerLookup: async () => {
      lookups += 1;
      return true;
    },
    requireAuth: async () => ({ userId: '66666666-6666-4666-8666-666666666666' }),
  });
  const limited = await handleConsumerAsk(
    askRequest({ message: FORT_MILL }, 'Bearer shopper-jwt', vercelIp, '203.0.113.200'),
    blocked.deps,
  );
  assert.equal(limited.status, 429);
  assertConsumerError(await errorBody(limited), 'rate_limited');
  assert.equal(lookups, 0);

  const other = harness({
    store,
    requireAuth: async () => ({ userId: '77777777-7777-4777-8777-777777777777' }),
  });
  const allowed = await handleConsumerAsk(
    askRequest({ message: FORT_MILL }, 'Bearer shopper-jwt', '198.51.100.9', vercelIp),
    other.deps,
  );
  assert.equal(allowed.status, 200);
});

test('discover schema drops one bad field before the resolver', async () => {
  let seen = '';
  const { deps } = harness({
    parse: async () => ({
      filters: {
        make: 'Ford, Truck',
        model: 'F-150',
        maxPrice: 45000,
        locationText: '123 Main Street, Fort Mill, SC',
      },
      explicitFields: ['make', 'model', 'maxPrice', 'locationText'],
      confidence: 0.8,
    }),
    resolveCanonical: async (filters) => {
      seen = JSON.stringify(filters);
      return { canonicalFilters: filters };
    },
  });
  const response = await handleConsumerAsk(askRequest({ message: 'anything' }), deps);
  assert.equal(response.status, 200);
  assert.equal(seen.includes('Ford, Truck'), false);
  assert.match(seen, /F-150/);
  const body = await response.json() as { filters: { location?: string; model?: string; make?: string } };
  assert.equal(body.filters.make, undefined);
  assert.equal(body.filters.model, 'F-150');
  assert.equal(body.filters.location, 'Fort Mill, SC');
  assert.equal((body.filters.location ?? '').length <= 80, true);
});

type ModelAttempt = { kind: string; model?: string; maxTokens?: number; hasSignal: boolean; baseURL: string };

function trackingClient(calls: ModelAttempt[]): OpenAI {
  return {
    beta: { chat: { completions: { parse: async (
      body: { model?: string; max_tokens?: number },
      opts?: { signal?: AbortSignal },
    ) => {
      calls.push({
        kind: 'parse',
        model: body.model,
        maxTokens: body.max_tokens,
        hasSignal: Boolean(opts?.signal) && opts?.signal?.aborted === false,
        baseURL: '',
      });
      return { choices: [{ message: { parsed: { filters: {}, explicitFields: [] } } }] };
    } } } },
    chat: { completions: { create: async (
      body: { model?: string; max_tokens?: number },
      opts?: { signal?: AbortSignal },
    ) => {
      calls.push({
        kind: 'reply',
        model: body.model,
        maxTokens: body.max_tokens,
        hasSignal: Boolean(opts?.signal) && opts?.signal?.aborted === false,
        baseURL: '',
      });
      return { choices: [{ message: { content: 'Three trucks are listed nearby.' } }] };
    } } },
  } as unknown as OpenAI;
}

function scriptedAskModel(
  steps: Array<'401' | 'ok' | '500' | 'network'>,
  calls: ModelAttempt[],
): NonNullable<AskHandlerDeps['askModel']> {
  const client = trackingClient(calls);
  return (env, run) => callAskModel(env, async (ctx) => {
    const step = steps.shift();
    calls.push({
      kind: 'attempt',
      model: ctx.model,
      hasSignal: ctx.signal.aborted === false,
      baseURL: ctx.baseURL,
    });
    if (step === '401') {
      const error = new Error('unauthorized');
      error.name = 'AuthenticationError';
      (error as Error & { status: number }).status = 401;
      throw error;
    }
    if (step === 'network') throw Object.assign(new TypeError('fetch failed'), { code: 'ECONNRESET' });
    if (step === '500') throw Object.assign(new Error('down'), { status: 500 });
    return run({ ...ctx, client });
  }, { createClient: () => client, timeoutMs: 8_000 });
}

test('ask uses the gateway, then OpenAI, then the parser', async () => {
  assert.equal(askNativeModel({}), 'gpt-6-astra');
  assert.equal(askNativeModel({ OPENAI_MODEL: 'gpt-4o' }), 'gpt-4o');
  assert.equal(ASK_PARSE_MAX_TOKENS, 800);

  const named = await callAskModel({ OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-4o' }, async (ctx) => ctx.model);
  assert.equal(named.ok && named.value, 'gpt-4o');

  const missing = await callAskModel(testEnv(), async () => 'should-not-run');
  assert.equal(missing.ok, false);

  const timeout = new Error('timed out');
  timeout.name = 'TimeoutError';
  let timeoutCalls = 0;
  const timedOut = await callAskModel(
    { AI_GATEWAY_API_KEY: 'gw-test', OPENAI_API_KEY: 'sk-test' },
    async () => {
      timeoutCalls += 1;
      throw timeout;
    },
  );
  assert.equal(timedOut.ok, false);
  assert.equal(timeoutCalls, 1);

  const gatewayCalls: ModelAttempt[] = [];
  const gateway = harness({
    env: testEnv({ AI_GATEWAY_API_KEY: 'gw-test', OPENAI_API_KEY: 'sk-test' }),
    askModel: scriptedAskModel(['ok', 'ok'], gatewayCalls),
  });
  const gatewayResponse = await handleConsumerAsk(askRequest({ message: FORT_MILL }), gateway.deps);
  assert.equal(gatewayResponse.status, 200);
  const gatewayBody = await gatewayResponse.json() as { reply: string };
  assert.match(gatewayBody.reply, /Three trucks are listed nearby/);
  const gatewayLog = JSON.parse(gateway.lines[0] ?? '{}') as { provider: string };
  assert.equal(gatewayLog.provider, 'gateway');
  const gatewayAttempts = gatewayCalls.filter((call) => call.kind === 'attempt');
  assert.deepEqual(gatewayAttempts.map((call) => call.baseURL), [SHOPPING_GATEWAY_BASE_URL, SHOPPING_GATEWAY_BASE_URL]);
  assert.equal(gatewayAttempts[0]?.model, SHOPPING_MODEL);
  const gatewayParse = gatewayCalls.find((call) => call.kind === 'parse');
  assert.equal(gatewayParse?.maxTokens, ASK_PARSE_MAX_TOKENS);
  assert.equal(gatewayParse?.hasSignal, true);
  assert.equal(gatewayCalls.find((call) => call.kind === 'reply')?.hasSignal, true);

  const openaiCalls: ModelAttempt[] = [];
  const openai = harness({
    env: testEnv({ OPENAI_API_KEY: 'sk-test' }),
    askModel: scriptedAskModel(['ok', 'ok'], openaiCalls),
  });
  const openaiResponse = await handleConsumerAsk(askRequest({ message: FORT_MILL }), openai.deps);
  assert.equal(openaiResponse.status, 200);
  assert.equal(JSON.parse(openai.lines[0] ?? '{}').provider, 'openai');
  const openaiAttempts = openaiCalls.filter((call) => call.kind === 'attempt');
  assert.deepEqual(openaiAttempts.map((call) => call.model), ['gpt-6-astra', 'gpt-6-astra']);
  assert.deepEqual(openaiAttempts.map((call) => call.baseURL), [ASK_OPENAI_BASE_URL, ASK_OPENAI_BASE_URL]);
  assert.equal(openaiCalls.find((call) => call.kind === 'parse')?.maxTokens, ASK_PARSE_MAX_TOKENS);

  const fallbackCalls: ModelAttempt[] = [];
  const fallback = harness({
    env: testEnv({ AI_GATEWAY_API_KEY: 'gw-test', OPENAI_API_KEY: 'sk-test' }),
    askModel: scriptedAskModel(['401', 'ok', '401', 'ok'], fallbackCalls),
  });
  const fallbackResponse = await handleConsumerAsk(askRequest({ message: FORT_MILL }), fallback.deps);
  assert.equal(fallbackResponse.status, 200);
  assert.equal(JSON.parse(fallback.lines[0] ?? '{}').provider, 'openai');
  assert.deepEqual(
    fallbackCalls.filter((call) => call.kind === 'attempt').map((call) => call.baseURL),
    [SHOPPING_GATEWAY_BASE_URL, ASK_OPENAI_BASE_URL, SHOPPING_GATEWAY_BASE_URL, ASK_OPENAI_BASE_URL],
  );

  const networkCalls: ModelAttempt[] = [];
  const network = harness({
    env: testEnv({ AI_GATEWAY_API_KEY: 'gw-test', OPENAI_API_KEY: 'sk-test' }),
    askModel: scriptedAskModel(['network', 'ok', 'network', 'ok'], networkCalls),
  });
  const networkResponse = await handleConsumerAsk(askRequest({ message: FORT_MILL }), network.deps);
  assert.equal(networkResponse.status, 200);
  assert.equal(JSON.parse(network.lines[0] ?? '{}').provider, 'openai');

  const failedSteps: Array<'401' | '500'> = ['401', '500', '401', '500'];
  const failed = harness({
    env: testEnv({ AI_GATEWAY_API_KEY: 'gw-test', OPENAI_API_KEY: 'sk-test' }),
    askModel: scriptedAskModel(failedSteps, []),
  });
  const failedResponse = await handleConsumerAsk(askRequest({ message: FORT_MILL }), failed.deps);
  assert.equal(failedResponse.status, 200);
  const failedBody = await failedResponse.json() as { reply: string };
  assert.match(failedBody.reply, /Found 3 vehicles/);
  assert.equal(JSON.parse(failed.lines[0] ?? '{}').provider, 'parser');

  const unavailable = harness({
    env: testEnv({ AI_GATEWAY_API_KEY: 'gw-test', OPENAI_API_KEY: 'sk-test' }),
    askModel: scriptedAskModel(['401', '500'], []),
  });
  const down = await handleConsumerAsk(askRequest({ message: 'hello there' }), unavailable.deps);
  assert.equal(down.status, 503);
  assertConsumerError(await errorBody(down), 'ask_unavailable');
  assert.equal(JSON.parse(unavailable.lines[0] ?? '{}').provider, 'parser');
});
