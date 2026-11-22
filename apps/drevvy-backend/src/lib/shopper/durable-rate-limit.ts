import {
  discoverLimiterFailsClosed,
  MemoryRateLimitStore,
  resolveDiscoverRateLimitStore,
  type RateLimitStore,
} from '@/lib/public-discover/rate-limit';

/**
 * Shopper windows on the existing Discover counter
 * (`public.touch_public_discover_rate_limit`). Buckets are text keys.
 * This does not add a table or an RPC.
 *
 * The counter stores a hash of the shopper id, not the id itself.
 * Production and Vercel preview fail closed when the counter is down.
 * Development and tests use the process-local counter unless a store is passed.
 */

export type DurableWindow = {
  bucket: string;
  windowMs: number;
  limit: number;
};

export class DurableRateLimitUnavailable extends Error {
  constructor() {
    super('rate limit store unavailable');
    this.name = 'DurableRateLimitUnavailable';
  }
}

const memoryFallback = new MemoryRateLimitStore();
let loggedUnavailable = false;

export function resetDurableRateLimitFallbackForTests(): void {
  memoryFallback.reset();
  loggedUnavailable = false;
}

function logUnavailable(): void {
  if (loggedUnavailable) return;
  loggedUnavailable = true;
  console.error(JSON.stringify({ event: 'shopper_rate_limit_unavailable' }));
}

async function takeFrom(store: RateLimitStore, windows: readonly DurableWindow[], nowMs: number): Promise<DurableWindow | null> {
  for (const window of windows) {
    const windowStartMs = nowMs - (nowMs % window.windowMs);
    const hit = await store.hit(window.bucket, windowStartMs, window.windowMs, window.limit, nowMs);
    if (!hit.allowed) return window;
  }
  return null;
}

/** Later windows are not touched once one refuses the request. */
export async function takeDurableLimits(input: {
  windows: readonly DurableWindow[];
  nowMs: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<DurableWindow | null> {
  const env = input.env ?? process.env;
  const failClosed = discoverLimiterFailsClosed(env);
  let store: RateLimitStore | undefined;
  try {
    store = input.store ?? (await resolveDiscoverRateLimitStore(env));
    return await takeFrom(store, input.windows, input.nowMs);
  } catch (error) {
    if (error instanceof DurableRateLimitUnavailable) throw error;
    if (input.store || failClosed || store === memoryFallback) {
      logUnavailable();
      throw new DurableRateLimitUnavailable();
    }
    try {
      return await takeFrom(memoryFallback, input.windows, input.nowMs);
    } catch {
      logUnavailable();
      throw new DurableRateLimitUnavailable();
    }
  }
}
