/**
 * POST /api/consumer/ask
 *
 * Shopper JWT only. requireConsumerAuth checks the bearer token with
 * Supabase auth.getUser. The shared inventory key is rejected there.
 * A user_dealerships row is a dealer account, the same membership check as
 * delete_consumer_account, and this route answers 403 dealer_account.
 *
 * conversationId is `<uuid>.<hmac>`. The hmac is HMAC-SHA256 of
 * `${userId}.${uuid}`. The key is HKDF-SHA256 of SUPABASE_JWT_SECRET, or
 * CRON_SECRET when that is unset, with info
 * `drevvy-consumer-ask-conversation-v1`. Those are the same server-only
 * secrets that already sign demo desk sessions. Nothing is written to the
 * database. A missing or malformed id is replaced with a new one. A
 * well-formed id signed for a different shopper is 403 conversation_forbidden.
 *
 * After auth, the checks run in this order: Content-Length, rate limit,
 * dealer membership, then the model calls.
 *
 * Ask does not spend shopper keys or call the market intel routes.
 */

import { createHash, createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { ConsumerAuthError, requireConsumerAuth } from '@/lib/consumer/auth';
import { searchActiveCarsMcp, type LiveSearchFilters, type LiveVehicle } from '@/lib/marketcheck/mcp-adapter';
import { payloadContainsSecret } from '@/lib/marketcheck/secrets';
import { assertPublicListing, publicListingFromSearchVehicle, type PublicListing } from '@/lib/public-discover/allowlist';
import { discoverClientIp } from '@/lib/public-discover/client-ip';
import { DISCOVER_BODY_TYPES, DISCOVER_DAY_MS, DISCOVER_MINUTE_MS, DISCOVER_SEARCH_MAX_PAGE_SIZE } from '@/lib/public-discover/constants';
import type { RateLimitStore } from '@/lib/public-discover/rate-limit';
import { discoverFiltersSchema, type DiscoverFiltersInput } from '@/lib/public-discover/schema';
import { searchResolvedInventory, type InventorySearchFailure } from '@/lib/query/inventory-search';
import { parseAskQuery } from '@/lib/query/deterministic-parse';
import { geocodeLocation, toMapboxPlace, type LocationData, type ParseOpenAIResult } from '@/lib/query/parse-inventory-query';
import type { CanonicalFilters } from '@/lib/query/resolve-canonical-filters';
import { createAdminClient } from '@/lib/supabase/admin';

import { callAskModel, type AskModelContext, type AskModelResult } from './ask-model';
import { DurableRateLimitUnavailable, takeDurableLimits, type DurableWindow } from './durable-rate-limit';
import { hashShopperIp } from './market-lookup-guard';
import { redactShopperDealerIdentity } from './redact-dealer';

export const ASK_MESSAGE_MAX = 500;
export const ASK_PER_HOUR = 20;
export const ASK_PER_DAY = 100;
export const ASK_PER_IP_HOUR = 60;
export const ASK_HOUR_MS = DISCOVER_MINUTE_MS * 60;
export const ASK_BODY_MAX_BYTES = 8192;
export const ASK_UPSTREAM_TIMEOUT_MS = 8_000;
export const ASK_LOCATION_MAX = 80;

const HOUR_COPY = 'Slow down a little. Try again in an hour.';
const DAY_COPY = 'Slow down a little. Try again tomorrow.';
const UNAVAILABLE = 'Ask is unavailable right now. Try again in a minute.';
const DEALER_COPY = 'Dealer accounts can\'t use Ask.';
const SIGN_IN = 'Sign in is required.';

const ASK_KEYS = new Set(['message', 'conversationId', 'lat', 'lng', 'zip']);

export const ASK_ERROR_CODES = [
  'invalid_request',
  'unauthorized',
  'dealer_account',
  'conversation_forbidden',
  'rate_limited',
  'ask_unavailable',
] as const;

export type AskErrorCode = (typeof ASK_ERROR_CODES)[number];

export class AskError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: AskErrorCode,
  ) {
    super(message);
    this.name = 'AskError';
  }
}

export type AskRequest = {
  message: string;
  /** Presented thread id. Verified, then echoed or replaced. Not stored. */
  conversationId?: string;
  lat?: number;
  lng?: number;
  zip?: string;
};

const SIGNED_CONVERSATION = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{64})$/i;

/** Domain-separates the conversation mac from other uses of the same secret. */
export const ASK_CONVERSATION_INFO = 'drevvy-consumer-ask-conversation-v1';

/**
 * Same secret demo desk sessions already use.
 * SUPABASE_JWT_SECRET, then CRON_SECRET. No new env var.
 * The HMAC key is derived; the raw secret is not the key.
 */
export function askConversationSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.SUPABASE_JWT_SECRET || env.CRON_SECRET || '';
  return value.length >= 16 ? value : null;
}

function conversationKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, '', ASK_CONVERSATION_INFO, 32));
}

function conversationMac(userId: string, id: string, secret: string): string {
  return createHmac('sha256', conversationKey(secret)).update(`${userId}.${id}`).digest('hex');
}

export function issueAskConversationId(userId: string, secret: string, uuid: () => string = randomUUID): string {
  const id = uuid().toLowerCase();
  return `${id}.${conversationMac(userId, id, secret)}`;
}

export function resolveAskConversation(input: {
  userId: string;
  presented?: string;
  secret: string | null;
  uuid?: () => string;
}): { ok: true; conversationId: string } | { ok: false; reason: 'mismatch' | 'unconfigured' } {
  if (!input.secret) return { ok: false, reason: 'unconfigured' };
  const presented = input.presented?.trim() ?? '';
  if (!presented) {
    return { ok: true, conversationId: issueAskConversationId(input.userId, input.secret, input.uuid) };
  }
  const match = presented.match(SIGNED_CONVERSATION);
  if (!match) {
    return { ok: true, conversationId: issueAskConversationId(input.userId, input.secret, input.uuid) };
  }
  const id = match[1].toLowerCase();
  const given = Buffer.from(match[2], 'hex');
  const expected = conversationMac(input.userId, id, input.secret);
  const right = Buffer.from(expected, 'hex');
  if (given.length !== right.length || !timingSafeEqual(given, right)) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true, conversationId: `${id}.${expected}` };
}

export type AskProvider = 'gateway' | 'openai' | 'parser';

export type AskLogRecord = {
  event: 'consumer_ask';
  user: string;
  status: number;
  latencyMs: number;
  provider: AskProvider;
};

export function askLogRecord(input: {
  userId?: string | null;
  status: number;
  latencyMs: number;
  provider?: AskProvider;
}): AskLogRecord {
  const user = input.userId
    ? createHash('sha256').update(input.userId).digest('hex').slice(0, 12)
    : 'anonymous';
  return {
    event: 'consumer_ask',
    user,
    status: input.status,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    provider: input.provider ?? 'parser',
  };
}

export function askErrorBody(code: AskErrorCode, message: string) {
  return { success: false as const, error: { code, message } };
}

export function askErrorResponse(error: AskError): NextResponse {
  return NextResponse.json(askErrorBody(error.code, error.message), { status: error.status });
}

export function askLimitWindows(userId: string, ip: string, env?: NodeJS.ProcessEnv): DurableWindow[] {
  const user = createHash('sha256').update(userId).digest('hex');
  const ipHash = hashShopperIp(ip, env);
  return [
    { bucket: `ask:u:${user}:h`, windowMs: ASK_HOUR_MS, limit: ASK_PER_HOUR },
    { bucket: `ask:u:${user}:d`, windowMs: DISCOVER_DAY_MS, limit: ASK_PER_DAY },
    { bucket: `ask:ip:${ipHash}:h`, windowMs: ASK_HOUR_MS, limit: ASK_PER_IP_HOUR },
  ];
}

export async function enforceAskLimit(input: {
  userId: string;
  ip: string;
  nowMs?: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const windows = askLimitWindows(input.userId, input.ip, input.env);
  for (const window of windows) {
    if (window.bucket.length < 8 || window.bucket.length > 180) {
      throw new AskError(UNAVAILABLE, 503, 'ask_unavailable');
    }
  }
  let blocked: DurableWindow | null;
  try {
    blocked = await takeDurableLimits({
      windows,
      nowMs: input.nowMs ?? Date.now(),
      store: input.store,
      env: input.env,
    });
  } catch (error) {
    if (error instanceof DurableRateLimitUnavailable) {
      throw new AskError(UNAVAILABLE, 503, 'ask_unavailable');
    }
    throw error;
  }
  if (!blocked) return;
  const copy = blocked.windowMs >= DISCOVER_DAY_MS ? DAY_COPY : HOUR_COPY;
  throw new AskError(copy, 429, 'rate_limited');
}

/**
 * True when this Supabase user has a rooftop membership.
 * Same predicate as delete_consumer_account's dealer_account guard.
 */
export async function shopperHasDealerMembership(
  userId: string,
  lookup: (userId: string) => Promise<boolean> = defaultDealerLookup,
): Promise<boolean> {
  return lookup(userId);
}

async function defaultDealerLookup(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_dealerships')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  } catch {
    throw new AskError(UNAVAILABLE, 503, 'ask_unavailable');
  }
}

export function readAskRequest(body: unknown): AskRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AskError('Send a message.', 400, 'invalid_request');
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ASK_KEYS.has(key)) {
      throw new AskError('Send a message, and optionally a conversation id, location, or ZIP.', 400, 'invalid_request');
    }
  }
  if (typeof record.message !== 'string' || !record.message.trim()) {
    throw new AskError('Send a message.', 400, 'invalid_request');
  }
  const message = record.message.trim();
  if (message.length > ASK_MESSAGE_MAX) {
    throw new AskError('Keep the message under 500 characters.', 400, 'invalid_request');
  }

  let conversationId: string | undefined;
  if (record.conversationId == null || record.conversationId === '') {
    conversationId = undefined;
  } else if (typeof record.conversationId !== 'string') {
    throw new AskError('Send a conversation id as text, or leave it out.', 400, 'invalid_request');
  } else {
    conversationId = record.conversationId.trim() || undefined;
  }

  const lat = optionalCoord(record.lat, -90, 90, 'lat');
  const lng = optionalCoord(record.lng, -180, 180, 'lng');
  if ((lat == null) !== (lng == null)) {
    throw new AskError('Send a latitude and longitude together.', 400, 'invalid_request');
  }
  if (lat != null && lng != null && Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) {
    throw new AskError('Send a real latitude and longitude.', 400, 'invalid_request');
  }

  const request: AskRequest = { message };
  if (conversationId) request.conversationId = conversationId;
  if (lat != null && lng != null) {
    request.lat = lat;
    request.lng = lng;
  }
  if ('zip' in record && record.zip != null && record.zip !== '') {
    request.zip = parseZip(record.zip);
  }
  return request;
}

function optionalCoord(value: unknown, min: number, max: number, _name: string): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new AskError('Send a real latitude and longitude.', 400, 'invalid_request');
  }
  return value;
}

function parseZip(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AskError('Enter a 5-digit ZIP.', 400, 'invalid_request');
  }
  const match = value.trim().match(/^(\d{5})(?:-\d{4})?$/);
  if (!match) throw new AskError('Enter a 5-digit ZIP.', 400, 'invalid_request');
  return match[1];
}

const ASK_FILTER_TEXT = /^[A-Za-z0-9][A-Za-z0-9 .,'-]{0,79}$/;
const ASK_TEXT_FIELDS = [
  'make', 'model', 'trim', 'bodyType', 'exteriorColor', 'interiorColor',
  'drivetrain', 'fuelType', 'powertrainType', 'condition',
] as const;

/** A string that is not a vehicle name is dropped. Other fields stay. */
export function allowAskFilterFields(parsed: ParseOpenAIResult): ParseOpenAIResult {
  const filters: ParseOpenAIResult['filters'] = { ...parsed.filters };
  const dropped = new Set<string>();
  for (const field of ASK_TEXT_FIELDS) {
    const value = filters[field];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || !ASK_FILTER_TEXT.test(value.trim())) {
      delete filters[field];
      dropped.add(field);
    } else {
      filters[field] = value.trim() as never;
    }
  }
  if (filters.locationText) {
    const place = toMapboxPlace(filters.locationText);
    if (!place) {
      delete filters.locationText;
      dropped.add('locationText');
    } else {
      filters.locationText = place;
    }
  }
  return {
    ...parsed,
    filters,
    explicitFields: parsed.explicitFields.filter((field) => !dropped.has(field)),
  };
}

const RESOLVER_FIELDS = [
  'make', 'model', 'trim', 'year', 'minYear', 'maxYear',
  'minPrice', 'maxPrice', 'maxMiles', 'condition', 'bodyType',
] as const;

/** Discover schema runs before the resolver. One bad field is dropped. */
function filtersBeforeResolver(parsed: ParseOpenAIResult): ParseOpenAIResult {
  const safe = discoverSafeFilters({
    make: parsed.filters.make,
    model: parsed.filters.model,
    trim: parsed.filters.trim,
    year: parsed.filters.year,
    minYear: parsed.filters.minYear,
    maxYear: parsed.filters.maxYear,
    minPrice: parsed.filters.minPrice,
    maxPrice: parsed.filters.maxPrice,
    maxMiles: parsed.filters.maxMiles,
    condition: parsed.filters.condition,
    bodyType: parsed.filters.bodyType,
  });
  const filters: ParseOpenAIResult['filters'] = { ...parsed.filters };
  const dropped = new Set<string>();
  for (const field of RESOLVER_FIELDS) {
    const next = safe[field];
    if (next == null || next === '') {
      if (filters[field] != null && filters[field] !== '') dropped.add(field);
      delete filters[field];
    } else {
      filters[field] = next as never;
    }
  }
  return {
    ...parsed,
    filters,
    explicitFields: parsed.explicitFields.filter((field) => !dropped.has(field)),
  };
}

/** Two decimals is about 1 km. MarketCheck takes these as floats plus a radius. */
export function roundAskCoordinate(value: number): number {
  return Number(value.toFixed(2));
}

function discoverSafeFilters(filters: LiveSearchFilters | undefined): LiveSearchFilters {
  if (!filters) return {};
  const candidate: Record<string, unknown> = {};
  if (filters.make) candidate.make = filters.make;
  if (filters.model) candidate.model = filters.model;
  if (filters.trim) candidate.trim = filters.trim;
  if (filters.year != null) candidate.year = filters.year;
  if (filters.year == null && filters.minYear != null) candidate.year_min = filters.minYear;
  if (filters.year == null && filters.maxYear != null) candidate.year_max = filters.maxYear;
  if (filters.minPrice != null) candidate.price_min = filters.minPrice;
  if (filters.maxPrice != null) candidate.price_max = filters.maxPrice;
  if (filters.maxMiles != null) candidate.miles_max = filters.maxMiles;
  if (filters.condition) candidate.condition = filters.condition;
  if (filters.bodyType && (DISCOVER_BODY_TYPES as readonly string[]).includes(filters.bodyType)) {
    candidate.body_type = filters.bodyType;
  }
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    const one = discoverFiltersSchema.safeParse({ [key]: value });
    if (one.success) kept[key] = value;
  }
  let parsed = discoverFiltersSchema.safeParse(kept);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string') delete kept[key];
    }
    parsed = discoverFiltersSchema.safeParse(kept);
  }
  if (!parsed.success) return {};
  return liveFiltersFromDiscover(parsed.data);
}

function liveFiltersFromDiscover(input: DiscoverFiltersInput): LiveSearchFilters {
  const filters: LiveSearchFilters = {};
  if (input.make) filters.make = input.make;
  if (input.model) filters.model = input.model;
  if (input.trim) filters.trim = input.trim;
  if (input.year != null) filters.year = input.year;
  if (input.year_min != null) filters.minYear = input.year_min;
  if (input.year_max != null) filters.maxYear = input.year_max;
  if (input.price_min != null) filters.minPrice = input.price_min;
  if (input.price_max != null) filters.maxPrice = input.price_max;
  if (input.miles_max != null) filters.maxMiles = input.miles_max;
  if (input.condition) filters.condition = input.condition;
  if (input.body_type) filters.bodyType = input.body_type;
  return filters;
}

export function publicAskFilters(canonical: CanonicalFilters, location?: string): Record<string, string | number> {
  const filters: Record<string, string | number> = {};
  const entries: Array<[string, string | number | undefined]> = [
    ['make', canonical.make],
    ['model', canonical.model],
    ['minPrice', canonical.minPrice],
    ['maxPrice', canonical.maxPrice],
    ['year', canonical.year],
    ['minYear', canonical.year == null ? canonical.minYear : undefined],
    ['maxYear', canonical.year == null ? canonical.maxYear : undefined],
    ['maxMiles', canonical.maxMiles],
    ['condition', canonical.condition],
    ['bodyType', canonical.bodyType],
    ['exteriorColor', canonical.exteriorColor],
    ['powertrainType', canonical.powertrainType],
    ['seatingCapacity', canonical.seatingCapacity],
  ];
  for (const [key, value] of entries) {
    if (typeof value === 'number' && Number.isFinite(value)) filters[key] = value;
    if (typeof value === 'string' && value.trim()) filters[key] = value.trim();
  }
  const place = toMapboxPlace(location ?? '');
  if (place) filters.location = place.slice(0, ASK_LOCATION_MAX);
  return filters;
}

function fallbackReply(total: number, location?: string): string {
  const place = location?.replace(/^near\s+/i, '').trim();
  const where = place ? ` near ${place}` : '';
  if (total === 0) {
    return `No vehicles matched${where}. Try a wider budget or a nearby city.`;
  }
  return `Found ${total} vehicle${total === 1 ? '' : 's'}${where}.`;
}

const DEALER_CONTACT_REPLY = /\b(?:contact|call|e-?mail|text)(?:\/(?:call|e-?mail|text)){0,2}\b(?:\s+\w+){0,4}\s+dealers?\b/i;

function replyAllowed(text: string): boolean {
  return !/negotiat/i.test(text) && !DEALER_CONTACT_REPLY.test(text);
}

type AskModelCaller = <T>(
  env: Record<string, string | undefined>,
  run: (ctx: AskModelContext) => Promise<T>,
) => Promise<AskModelResult<T>>;

function defaultAskModel<T>(
  env: Record<string, string | undefined>,
  run: (ctx: AskModelContext) => Promise<T>,
): Promise<AskModelResult<T>> {
  return callAskModel(env, run, { timeoutMs: ASK_UPSTREAM_TIMEOUT_MS });
}

async function groundedReply(input: {
  total: number;
  location?: string;
  filters: Record<string, string | number>;
  vehicles: LiveVehicle[];
  env?: Record<string, string | undefined>;
  complete?: (context: string) => Promise<string>;
  askModel?: AskModelCaller;
}): Promise<{ text: string; provider: AskProvider }> {
  const fallback = fallbackReply(input.total, input.location);
  const env = input.env ?? process.env;
  const lines = input.vehicles.slice(0, 3).map((vehicle) => {
    const price = vehicle.price > 0 ? `$${vehicle.price.toLocaleString('en-US')}` : 'price unavailable';
    return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${price}`;
  });
  const context = [
    `Matches: ${input.total}`,
    input.location ? `Place: ${input.location}` : '',
    `Filters: ${JSON.stringify(input.filters)}`,
    lines.length ? `Examples: ${lines.join('; ')}` : '',
  ].filter(Boolean).join('\n');
  try {
    let text = '';
    let provider: AskProvider = 'parser';
    if (input.complete) {
      text = await input.complete(context);
    } else {
      const called = await (input.askModel ?? defaultAskModel)(env, async (ctx) => {
        const completion = await ctx.client.chat.completions.create({
          model: ctx.model,
          messages: [
            {
              role: 'system',
              content: 'You are Drevvy. Write one or two sentences about these inventory matches. Use only the counts and prices given. Do not mention dealership names, phone numbers, email addresses, or websites. Do not tell the shopper to contact, call, email, or text a dealer.',
            },
            { role: 'user', content: context },
          ],
          max_tokens: 800,
        }, { signal: ctx.signal });
        return completion.choices[0]?.message?.content?.trim() ?? '';
      });
      if (!called.ok) return { text: fallback, provider: 'parser' };
      text = called.value;
      provider = called.provider;
    }
    const scrubbed = redactShopperDealerIdentity({
      assistantMessage: text.trim(),
      vehicles: input.vehicles,
    }).assistantMessage?.trim() ?? '';
    if (!scrubbed || !replyAllowed(scrubbed)) return { text: fallback, provider: 'parser' };
    return { text: scrubbed, provider };
  } catch {
    return { text: fallback, provider: 'parser' };
  }
}

function locationLabel(location: LocationData | undefined, zip?: string): string | undefined {
  const raw = location?.raw?.trim();
  if (raw) return raw.replace(/^near\s+/i, '');
  return zip;
}

export type AskHandlerDeps = {
  requireAuth?: (request: Request) => Promise<{ userId: string }>;
  dealerLookup?: (userId: string) => Promise<boolean>;
  nowMs?: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
  uuid?: () => string;
  parse?: (message: string) => Promise<ParseOpenAIResult | null>;
  geocode?: (locationText: string) => Promise<LocationData | null>;
  resolveCanonical?: (filters: CanonicalFilters) => Promise<{ canonicalFilters: CanonicalFilters }>;
  search?: (params: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
    filters?: LiveSearchFilters;
    rows?: number;
    start?: number;
  }) => Promise<{ vehicles: LiveVehicle[]; numFound: number; upstreamFailed?: boolean }>;
  reply?: (context: string) => Promise<string>;
  askModel?: AskModelCaller;
  log?: (line: string) => void;
  origin?: string;
};

export async function handleConsumerAsk(request: Request, deps: AskHandlerDeps = {}): Promise<NextResponse> {
  const started = Date.now();
  let status = 503;
  let userId: string | null = null;
  let provider: AskProvider = 'parser';
  const write = deps.log ?? ((line: string) => {
    console.log(line);
  });
  const finish = (response: NextResponse) => {
    status = response.status;
    write(JSON.stringify(askLogRecord({
      userId,
      status,
      latencyMs: Date.now() - started,
      provider,
    })));
    return response;
  };

  try {
    const requireAuth = deps.requireAuth ?? requireConsumerAuth;
    let auth: { userId: string };
    try {
      auth = await requireAuth(request);
    } catch (error) {
      if (error instanceof ConsumerAuthError && error.status === 401) {
        return finish(askErrorResponse(new AskError(error.message || SIGN_IN, 401, 'unauthorized')));
      }
      if (error instanceof AskError) return finish(askErrorResponse(error));
      return finish(askErrorResponse(new AskError(UNAVAILABLE, 503, 'ask_unavailable')));
    }
    userId = auth.userId;

    const declaredLength = request.headers.get('content-length');
    if (declaredLength != null) {
      const size = Number(declaredLength);
      if (!Number.isInteger(size) || size < 0) {
        return finish(askErrorResponse(new AskError('Send a message.', 400, 'invalid_request')));
      }
      if (size > ASK_BODY_MAX_BYTES) {
        return finish(askErrorResponse(new AskError('Send a smaller message.', 413, 'invalid_request')));
      }
    }

    await enforceAskLimit({
      userId: auth.userId,
      ip: discoverClientIp(request.headers),
      nowMs: deps.nowMs,
      store: deps.store,
      env: deps.env,
    });

    const dealer = await shopperHasDealerMembership(auth.userId, deps.dealerLookup);
    if (dealer) {
      return finish(askErrorResponse(new AskError(DEALER_COPY, 403, 'dealer_account')));
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return finish(askErrorResponse(new AskError('Send a message.', 400, 'invalid_request')));
    }
    const ask = readAskRequest(body);

    const secret = askConversationSecret(deps.env ?? process.env);
    const thread = resolveAskConversation({
      userId: auth.userId,
      presented: ask.conversationId,
      secret,
      uuid: deps.uuid,
    });
    if (!thread.ok) {
      const error = thread.reason === 'mismatch'
        ? new AskError('That conversation belongs to another shopper.', 403, 'conversation_forbidden')
        : new AskError(UNAVAILABLE, 503, 'ask_unavailable');
      return finish(askErrorResponse(error));
    }

    const parsed = filtersBeforeResolver(allowAskFilterFields(
      await (deps.parse ?? ((message: string) => parseAskQuery(message, {
        env: deps.env,
        askModel: deps.askModel,
        onProvider: (next) => {
          provider = next;
        },
      })))(ask.message)
        ?? { filters: {}, explicitFields: [], confidence: 0 },
    ));
    const hasFilters = parsed.explicitFields.length > 0;
    const hasPlace = Boolean(parsed.filters.locationText) || (ask.lat != null && ask.lng != null) || Boolean(ask.zip);
    if (!hasFilters && !hasPlace) {
      return finish(askErrorResponse(new AskError(UNAVAILABLE, 503, 'ask_unavailable')));
    }

    if (ask.zip && !parsed.filters.locationText && !(ask.lat != null && ask.lng != null)) {
      parsed.filters.locationText = ask.zip;
      if (!parsed.explicitFields.includes('locationText')) parsed.explicitFields.push('locationText');
    }

    const searched = await searchResolvedInventory({
      query: '',
      parseResult: parsed,
      userLocation: ask.lat != null && ask.lng != null
        ? { latitude: roundAskCoordinate(ask.lat), longitude: roundAskCoordinate(ask.lng) }
        : undefined,
      origin: deps.origin ?? new URL(request.url).origin,
      subjectHeader: null,
      subjectUserId: auth.userId,
      rows: DISCOVER_SEARCH_MAX_PAGE_SIZE,
      quiet: true,
      upstreamTimeoutMs: ASK_UPSTREAM_TIMEOUT_MS,
      geocode: async (text) => {
        const place = toMapboxPlace(text);
        if (!place) return null;
        const signal = AbortSignal.timeout(ASK_UPSTREAM_TIMEOUT_MS);
        const found = deps.geocode
          ? await deps.geocode(place)
          : await geocodeLocation(place, { signal });
        if (!found) return null;
        return {
          raw: place,
          lat: roundAskCoordinate(found.lat),
          lng: roundAskCoordinate(found.lng),
          source: found.source,
        };
      },
      resolveCanonical: deps.resolveCanonical
        ? async (filters, _context) => ({
          canonicalFilters: (await deps.resolveCanonical?.(filters))?.canonicalFilters ?? filters,
          meta: { fields: {}, facetSource: 'none', latencyMs: 0 },
        })
        : undefined,
      search: async (params) => {
        const safe = discoverSafeFilters(params.filters);
        const result = await (deps.search ?? searchActiveCarsMcp)({ ...params, filters: safe });
        return {
          vehicles: result.vehicles,
          numFound: result.numFound,
          returned: result.vehicles.length,
          start: params.start ?? 0,
          rows: params.rows ?? DISCOVER_SEARCH_MAX_PAGE_SIZE,
          fromCache: false,
          latencyMs: 0,
          upstreamFailed: result.upstreamFailed,
        };
      },
    });

    if (!searched.ok) return finish(askErrorResponse(mapSearchFailure(searched)));
    if (searched.upstreamFailed) {
      return finish(askErrorResponse(new AskError(UNAVAILABLE, 503, 'ask_unavailable')));
    }

    const place = locationLabel(searched.location, ask.zip);
    const filters = publicAskFilters(searched.canonicalFilters, place ?? parsed.filters.locationText);
    let listings: PublicListing[];
    try {
      listings = searched.liveVehicles
        .map((vehicle) => publicListingFromSearchVehicle(vehicle, searched.center))
        .filter((listing): listing is PublicListing => listing != null)
        .map(assertPublicListing);
    } catch {
      return finish(askErrorResponse(new AskError(UNAVAILABLE, 503, 'ask_unavailable')));
    }

    const answered = await groundedReply({
      total: searched.total,
      location: place,
      filters,
      vehicles: searched.liveVehicles,
      env: deps.env,
      complete: deps.reply,
      askModel: deps.askModel,
    });
    provider = answered.provider;
    const reply = answered.text;

    const payload = {
      reply,
      conversationId: thread.conversationId,
      filters,
      listings,
      total: searched.total,
    };
    if (payloadContainsSecret(payload)) {
      return finish(askErrorResponse(new AskError(UNAVAILABLE, 503, 'ask_unavailable')));
    }
    return finish(NextResponse.json(payload));
  } catch (error) {
    if (error instanceof AskError) return finish(askErrorResponse(error));
    return finish(askErrorResponse(new AskError(UNAVAILABLE, 503, 'ask_unavailable')));
  }
}

function mapSearchFailure(failure: InventorySearchFailure): AskError {
  if (failure.code === 'LOCATION_REQUIRED') {
    return new AskError('Add a city, ZIP, or your location.', 400, 'invalid_request');
  }
  return new AskError(UNAVAILABLE, 503, 'ask_unavailable');
}
