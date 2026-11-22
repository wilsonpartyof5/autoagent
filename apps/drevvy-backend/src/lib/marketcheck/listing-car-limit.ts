import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

import { DISCOVER_DAY_MS } from '@/lib/public-discover/constants';
import { rateLimitIpKey } from '@/lib/public-discover/client-ip';
import { discoverLimiterFailsClosed, type RateLimitStore } from '@/lib/public-discover/rate-limit';
import { DurableRateLimitUnavailable, takeDurableLimits } from '@/lib/shopper/durable-rate-limit';

/**
 * Paid GET /v2/listing/car calls from deal start and out-the-door only.
 * Discover detail, inventory detail, and the network lookup do not enter
 * this context, so they keep their own limits. Buckets are separate from
 * those routes. No new table or RPC.
 *
 * 2,000 shopper calls is about $4 at $0.002. 100 per IP is about $0.20.
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
    { bucket: 'mc:car:shop:g:d', windowMs: DISCOVER_DAY_MS, limit: LISTING_CAR_GLOBAL_PER_DAY },
  ];
  if (ip && ip.trim()) {
    const hashed = createHash('sha256').update(rateLimitIpKey(ip)).digest('hex');
    windows.push({
      bucket: `mc:car:shop:ip:${hashed}:d`,
      windowMs: DISCOVER_DAY_MS,
      limit: LISTING_CAR_IP_PER_DAY,
    });
  }
  return windows;
}

/**
 * No context means this call is not a deal or OTD lookup.
 * Those calls return before any bucket is touched.
 */
export async function enforceListingCarDailyCap(): Promise<void> {
  const context = contexts.getStore();
  if (!context) return;
  const env = context.env ?? process.env;
  if (!context.store && !discoverLimiterFailsClosed(env)) return;

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
