import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

import { DISCOVER_DAY_MS } from '@/lib/public-discover/constants';
import { rateLimitIpKey } from '@/lib/public-discover/client-ip';
import { discoverLimiterFailsClosed, type RateLimitStore } from '@/lib/public-discover/rate-limit';
import { DurableRateLimitUnavailable, takeDurableLimits } from '@/lib/shopper/durable-rate-limit';

/**
 * Paid GET /v2/listing/car calls share one process only for the identity cache.
 * These buckets use the existing Discover counter so a second instance cannot
 * keep paying after the daily caps. No new table or RPC.
 *
 * 2,000 global calls is about $4 at $0.002. 100 per IP is about $0.20.
 */
export const LISTING_CAR_GLOBAL_PER_DAY = 2_000;
export const LISTING_CAR_IP_PER_DAY = 100;

export class ListingCarRateLimited extends Error {
  constructor() {
    super('listing car daily cap');
    this.name = 'ListingCarRateLimited';
  }
}

export class ListingCarLimitUnavailable extends Error {
  constructor() {
    super('listing car cap unavailable');
    this.name = 'ListingCarLimitUnavailable';
  }
}

export type ListingCarLimitContext = {
  ip?: string | null;
  nowMs?: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
};

const contexts = new AsyncLocalStorage<ListingCarLimitContext>();

export function withListingCarLimits<T>(
  context: ListingCarLimitContext,
  run: () => Promise<T>,
): Promise<T> {
  return contexts.run(context, run);
}

export function listingCarLimitWindows(ip: string | null | undefined): { bucket: string; windowMs: number; limit: number }[] {
  const windows = [
    { bucket: 'mc:car:g:d', windowMs: DISCOVER_DAY_MS, limit: LISTING_CAR_GLOBAL_PER_DAY },
  ];
  if (ip && ip.trim()) {
    const hashed = createHash('sha256').update(rateLimitIpKey(ip)).digest('hex');
    windows.push({
      bucket: `mc:car:ip:${hashed}:d`,
      windowMs: DISCOVER_DAY_MS,
      limit: LISTING_CAR_IP_PER_DAY,
    });
  }
  return windows;
}

/**
 * Runs only when a store is passed or production fail-closed is on.
 * Tests that do not opt in do not share a global counter with this cap.
 */
export async function enforceListingCarDailyCap(): Promise<void> {
  const context = contexts.getStore();
  const env = context?.env ?? process.env;
  if (!context?.store && !discoverLimiterFailsClosed(env)) return;

  const windows = listingCarLimitWindows(context?.ip);
  try {
    const blocked = await takeDurableLimits({
      windows,
      nowMs: context?.nowMs ?? Date.now(),
      store: context?.store,
      env,
    });
    if (blocked) throw new ListingCarRateLimited();
  } catch (error) {
    if (error instanceof ListingCarRateLimited) throw error;
    if (error instanceof DurableRateLimitUnavailable || context?.store || discoverLimiterFailsClosed(env)) {
      throw new ListingCarLimitUnavailable();
    }
  }
}
