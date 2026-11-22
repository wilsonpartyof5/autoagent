import { createHash } from 'node:crypto';

import { DISCOVER_DAY_MS, DISCOVER_MINUTE_MS } from '@/lib/public-discover/constants';
import type { RateLimitStore } from '@/lib/public-discover/rate-limit';

import { ShopperDealError } from './deals';
import { DurableRateLimitUnavailable, takeDurableLimits, type DurableWindow } from './durable-rate-limit';

/**
 * POST /api/consumer/deals attempts for one shopper.
 * An open deal that is already on the list does not spend this.
 * Over the limit, no MarketCheck listing lookup runs.
 */
export const DEAL_POST_USER_PER_MINUTE = 10;
export const DEAL_POST_USER_PER_DAY = 60;

const MINUTE_COPY = 'Slow down a little. Try again in a minute.';
const DAY_COPY = 'Slow down a little. Try again tomorrow.';
const UNAVAILABLE_COPY = 'Drevvy could not check that dealership. Try again in a minute.';

function subjectKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function dealPostLimitWindows(userId: string): DurableWindow[] {
  const user = subjectKey(userId);
  return [
    { bucket: `deal:u:${user}:m`, windowMs: DISCOVER_MINUTE_MS, limit: DEAL_POST_USER_PER_MINUTE },
    { bucket: `deal:u:${user}:d`, windowMs: DISCOVER_DAY_MS, limit: DEAL_POST_USER_PER_DAY },
  ];
}

export async function enforceDealPostLimit(input: {
  userId: string;
  nowMs?: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const windows = dealPostLimitWindows(input.userId);
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
      throw new ShopperDealError(UNAVAILABLE_COPY, 503, 'rate_limit_unavailable');
    }
    throw error;
  }
  if (!blocked) return;
  const copy = blocked.windowMs >= DISCOVER_DAY_MS ? DAY_COPY : MINUTE_COPY;
  throw new ShopperDealError(copy, 429, 'rate_limited');
}
