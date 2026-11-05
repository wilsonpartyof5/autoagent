import { createAdminClient } from '../supabase/admin';

import { DISCOVER_DAY_MS, DISCOVER_LIMITS, DISCOVER_MINUTE_MS, RATE_LIMIT_POLICY, type DiscoverRouteName } from './constants';
import { DiscoverApiError } from './errors';

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
let loggedFallback = false;

export function setDiscoverRateLimitStoreForTests(store: RateLimitStore | null): void {
  storeOverride = store;
}

export function resetDiscoverRateLimitFallbackForTests(): void {
  memoryFallback.reset();
  loggedFallback = false;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

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

/**
 * Durable store is Supabase (already in this repo). Preview/local without the
 * migration or service role falls back to process-local counts so a smoke test
 * can still reach MarketCheck. That fallback is not multi-instance durable.
 */
export async function resolveDiscoverRateLimitStore(): Promise<RateLimitStore> {
  if (storeOverride) return storeOverride;
  if (!supabaseConfigured()) return memoryFallback;
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
}): Promise<DiscoverRateLimitResult> {
  const nowMs = input.nowMs ?? Date.now();
  const limits = DISCOVER_LIMITS[input.route];
  const ip = input.ip.replace(/[^A-Za-z0-9.:_-]/g, '').slice(0, 64) || 'unknown';
  const store = input.store ?? (await resolveDiscoverRateLimitStore());

  const windows: Array<{ bucket: string; windowMs: number; limit: number; label: string }> = [
    { bucket: `disc:${input.route}:ip:${ip}:m`, windowMs: DISCOVER_MINUTE_MS, limit: limits.ipPerMinute, label: 'ip' },
    { bucket: `disc:${input.route}:g:m`, windowMs: DISCOVER_MINUTE_MS, limit: limits.globalPerMinute, label: 'global' },
    { bucket: `disc:${input.route}:ip:${ip}:d`, windowMs: DISCOVER_DAY_MS, limit: limits.ipPerDay, label: 'ip-day' },
    { bucket: `disc:${input.route}:g:d`, windowMs: DISCOVER_DAY_MS, limit: limits.globalPerDay, label: 'global-day' },
  ];

  const hits: RateLimitHit[] = [];
  try {
    for (const window of windows) {
      hits.push(await hitStore(store, window.bucket, window.windowMs, window.limit, nowMs));
    }
  } catch (error) {
    if (storeOverride) throw error;
    if (!loggedFallback) {
      loggedFallback = true;
      console.error(JSON.stringify({
        event: 'discover_rate_limit_fallback_memory',
        message: error instanceof Error ? error.message : 'store_failed',
      }));
    }
    for (const window of windows) {
      hits.push(await hitStore(memoryFallback, window.bucket, window.windowMs, window.limit, nowMs));
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
