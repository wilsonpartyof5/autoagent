import { createAdminClient } from '../supabase/admin';

import { rateLimitIpKey } from './client-ip';
import { DISCOVER_DAY_MS, DISCOVER_LIMITS, DISCOVER_MINUTE_MS, PHOTO_LIMITS, RATE_LIMIT_POLICY, type DiscoverRouteName } from './constants';
import { DiscoverApiError } from './errors';

const RATE_LIMIT_UNAVAILABLE_MESSAGE = 'Listings are temporarily unavailable. Please try again later.';
const PHOTO_UNAVAILABLE_MESSAGE = 'Photos are temporarily unavailable. Please try again later.';

export type RateLimitHit = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAtMs: number;
};

export interface RateLimitStore {
  hit(bucket: string, windowStartMs: number, windowMs: number, limit: number, nowMs: number): Promise<RateLimitHit>;
}

function alignedWindow(nowMs: number, windowMs: number): number {
  return nowMs - (nowMs % windowMs);
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { windowStartMs: number; count: number }>();

  async hit(bucket: string, windowStartMs: number, windowMs: number, limit: number, _nowMs: number): Promise<RateLimitHit> {
    const existing = this.buckets.get(bucket);
    const count = !existing || existing.windowStartMs !== windowStartMs ? 1 : existing.count + 1;
    this.buckets.set(bucket, { windowStartMs, count });
    return {
      allowed: count <= limit,
      count,
      limit,
      remaining: Math.max(0, limit - count),
      resetAtMs: windowStartMs + windowMs,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

type RpcResult = { allowed: boolean; hit_count: number; window_start: string };

export class SupabaseRateLimitStore implements RateLimitStore {
  constructor(private readonly rpc: (bucket: string, windowStartIso: string, limit: number) => Promise<RpcResult>) {}

  static fromAdmin(): SupabaseRateLimitStore {
    return new SupabaseRateLimitStore(async (bucket, windowStartIso, limit) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('touch_public_discover_rate_limit', {
        p_bucket: bucket,
        p_window_start: windowStartIso,
        p_limit: limit,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row.hit_count !== 'number') {
        throw new Error('rate limit rpc returned no row');
      }
      return row as RpcResult;
    });
  }

  async hit(bucket: string, windowStartMs: number, windowMs: number, limit: number, _nowMs: number): Promise<RateLimitHit> {
    const row = await this.rpc(bucket, new Date(windowStartMs).toISOString(), limit);
    const count = row.hit_count;
    return {
      allowed: row.allowed && count <= limit,
      count,
      limit,
      remaining: Math.max(0, limit - count),
      resetAtMs: windowStartMs + windowMs,
    };
  }
}

const memoryFallback = new MemoryRateLimitStore();
let storeOverride: RateLimitStore | null = null;
let loggedUnavailable = false;
let loggedFallback = false;
let loggedPhotoMissingRelation = false;

/** Postgres and PostgREST codes for a missing rate-limit table or function. */
const MISSING_RATE_LIMIT_RELATION_CODES = new Set(['42P01', '42883', 'PGRST202', 'PGRST205']);

export function setDiscoverRateLimitStoreForTests(store: RateLimitStore | null): void {
  storeOverride = store;
}

export function resetDiscoverRateLimitFallbackForTests(): void {
  memoryFallback.reset();
  loggedUnavailable = false;
  loggedFallback = false;
  loggedPhotoMissingRelation = false;
}

function isMissingRateLimitRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && MISSING_RATE_LIMIT_RELATION_CODES.has(code);
}

export function supabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Production and Vercel preview must not serve paid MarketCheck calls from a
 * per-instance counter. Local `next dev` and the test runner stay on the
 * memory limiter unless they opt into this mode.
 */
export function discoverLimiterFailsClosed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return true;
  return env.NODE_ENV === 'production';
}

function unavailableError(): DiscoverApiError {
  return new DiscoverApiError('RATE_LIMIT_UNAVAILABLE', RATE_LIMIT_UNAVAILABLE_MESSAGE);
}

function logUnavailable(): void {
  if (loggedUnavailable) return;
  loggedUnavailable = true;
  console.error(JSON.stringify({ event: 'discover_rate_limit_unavailable' }));
}

function logPhotoMissingRelation(): void {
  if (loggedPhotoMissingRelation) return;
  loggedPhotoMissingRelation = true;
  console.error(JSON.stringify({ event: 'photo_rate_limit_missing_relation' }));
}

type LimitWindow = { bucket: string; windowMs: number; limit: number };

async function hitStore(
  store: RateLimitStore,
  bucket: string,
  windowMs: number,
  limit: number,
  nowMs: number,
): Promise<RateLimitHit> {
  const windowStartMs = alignedWindow(nowMs, windowMs);
  return store.hit(bucket, windowStartMs, windowMs, limit, nowMs);
}

/** Later windows are not touched once one refuses the request. */
async function consumeUntilBlocked(
  store: RateLimitStore,
  windows: readonly LimitWindow[],
  nowMs: number,
): Promise<RateLimitHit[]> {
  const hits: RateLimitHit[] = [];
  for (const window of windows) {
    const hit = await hitStore(store, window.bucket, window.windowMs, window.limit, nowMs);
    hits.push(hit);
    if (!hit.allowed) break;
  }
  return hits;
}

/**
 * Durable store is the Supabase counter. Production and Vercel preview fail
 * closed when that store is missing or errors. Development and tests may use
 * the process-local counter, which only covers one process.
 */
export async function resolveDiscoverRateLimitStore(
  env: NodeJS.ProcessEnv = process.env,
): Promise<RateLimitStore> {
  if (storeOverride) return storeOverride;
  if (!supabaseConfigured(env)) {
    if (discoverLimiterFailsClosed(env)) {
      logUnavailable();
      throw unavailableError();
    }
    return memoryFallback;
  }
  return SupabaseRateLimitStore.fromAdmin();
}

export type DiscoverRateLimitResult = {
  headers: Record<string, string>;
};

function headersFrom(hit: RateLimitHit): Record<string, string> {
  return {
    'RateLimit-Limit': String(hit.limit),
    'RateLimit-Remaining': String(hit.remaining),
    'RateLimit-Reset': String(Math.ceil(hit.resetAtMs / 1000)),
    'RateLimit-Policy': RATE_LIMIT_POLICY,
  };
}

export async function enforceDiscoverRateLimit(input: {
  ip: string;
  route: DiscoverRouteName;
  nowMs?: number;
  store?: RateLimitStore;
  /** Process-local counter used only when fail-closed is off. Tests pass their own. */
  fallbackStore?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<DiscoverRateLimitResult> {
  const nowMs = input.nowMs ?? Date.now();
  const limits = DISCOVER_LIMITS[input.route];
  const ip = rateLimitIpKey(input.ip);
  const env = input.env ?? process.env;
  const failClosed = discoverLimiterFailsClosed(env);
  const fallback = input.fallbackStore ?? memoryFallback;
  const store = input.store ?? (await resolveDiscoverRateLimitStore(env));

  // Per-IP windows run first. A rejected IP must not increment the global caps.
  const windows: LimitWindow[] = [
    { bucket: `disc:${input.route}:ip:${ip}:m`, windowMs: DISCOVER_MINUTE_MS, limit: limits.ipPerMinute },
    { bucket: `disc:${input.route}:ip:${ip}:d`, windowMs: DISCOVER_DAY_MS, limit: limits.ipPerDay },
    { bucket: `disc:${input.route}:g:m`, windowMs: DISCOVER_MINUTE_MS, limit: limits.globalPerMinute },
    { bucket: `disc:${input.route}:g:d`, windowMs: DISCOVER_DAY_MS, limit: limits.globalPerDay },
  ];

  let hits: RateLimitHit[];
  try {
    hits = await consumeUntilBlocked(store, windows, nowMs);
  } catch {
    if (failClosed || store === fallback) {
      logUnavailable();
      throw unavailableError();
    }
    if (!loggedFallback) {
      loggedFallback = true;
      console.error(JSON.stringify({ event: 'discover_rate_limit_fallback_memory' }));
    }
    try {
      hits = await consumeUntilBlocked(fallback, windows, nowMs);
    } catch {
      logUnavailable();
      throw unavailableError();
    }
  }

  const ipMinute = hits[0]!;
  const blocked = hits.find((hit) => !hit.allowed);
  const resultHeaders = headersFrom(ipMinute);
  if (!blocked) return { headers: resultHeaders };

  const retryAfter = Math.max(1, Math.ceil((blocked.resetAtMs - nowMs) / 1000));
  throw new DiscoverApiError('RATE_LIMITED', 'Too many listing requests. Please wait and try again.', {
    ...headersFrom(blocked.limit === ipMinute.limit ? ipMinute : blocked),
    'Retry-After': String(retryAfter),
  });
}

export async function enforcePhotoRateLimit(input: {
  ip: string;
  nowMs?: number;
  store?: RateLimitStore;
  fallbackStore?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<DiscoverRateLimitResult> {
  const nowMs = input.nowMs ?? Date.now();
  const ip = rateLimitIpKey(input.ip);
  const env = input.env ?? process.env;
  const failClosed = discoverLimiterFailsClosed(env);
  const fallback = input.fallbackStore ?? memoryFallback;
  const store = input.store ?? (await resolveDiscoverRateLimitStore(env));
  const windows: LimitWindow[] = [
    { bucket: `photo:ip:${ip}:m`, windowMs: DISCOVER_MINUTE_MS, limit: PHOTO_LIMITS.ipPerMinute },
    { bucket: `photo:ip:${ip}:d`, windowMs: DISCOVER_DAY_MS, limit: PHOTO_LIMITS.ipPerDay },
  ];

  let hits: RateLimitHit[];
  try {
    hits = await consumeUntilBlocked(store, windows, nowMs);
  } catch (error) {
    // Only a missing table or function may use the per-instance counter.
    // Missing Supabase env throws before this, and every other error stays 503.
    const missingRelation = isMissingRateLimitRelation(error);
    if (store === fallback || (failClosed && !missingRelation)) {
      logUnavailable();
      throw new DiscoverApiError('RATE_LIMIT_UNAVAILABLE', PHOTO_UNAVAILABLE_MESSAGE);
    }
    if (missingRelation) logPhotoMissingRelation();
    else if (!loggedFallback) {
      loggedFallback = true;
      console.error(JSON.stringify({ event: 'discover_rate_limit_fallback_memory' }));
    }
    try {
      hits = await consumeUntilBlocked(fallback, windows, nowMs);
    } catch {
      logUnavailable();
      throw new DiscoverApiError('RATE_LIMIT_UNAVAILABLE', PHOTO_UNAVAILABLE_MESSAGE);
    }
  }

  const minute = hits[0]!;
  const blocked = hits.find((hit) => !hit.allowed);
  if (!blocked) return { headers: headersFrom(minute) };
  const retryAfter = Math.max(1, Math.ceil((blocked.resetAtMs - nowMs) / 1000));
  throw new DiscoverApiError('RATE_LIMITED', 'Too many photo requests. Please wait and try again.', {
    ...headersFrom(blocked),
    'Retry-After': String(retryAfter),
  });
}
