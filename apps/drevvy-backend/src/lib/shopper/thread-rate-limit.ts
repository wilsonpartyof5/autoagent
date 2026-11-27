import { createHash } from 'node:crypto';

import { DISCOVER_DAY_MS, DISCOVER_MINUTE_MS } from '@/lib/public-discover/constants';
import type { RateLimitStore } from '@/lib/public-discover/rate-limit';

import { ShopperDealError } from './deals';
import { DurableRateLimitUnavailable, takeDurableLimits, type DurableWindow } from './durable-rate-limit';

export const SHOPPER_MESSAGE_USER_PER_MINUTE = 20;
export const SHOPPER_MESSAGE_USER_PER_DAY = 200;
export const SHOPPER_MESSAGE_DEAL_PER_MINUTE = 10;

export const SHOPPER_MESSAGE_MINUTE_COPY = 'Slow down a little. Try again in a minute.';
export const SHOPPER_MESSAGE_DAY_COPY = 'Slow down a little. Try again tomorrow.';
const SHOPPER_MESSAGE_UNAVAILABLE_COPY = 'Messages are paused. Try again in a minute.';

const BUCKET_MIN = 8;
const BUCKET_MAX = 180;

export type ShopperMessageLimitOptions = {
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
  nowMs?: number;
};

function subjectKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function shopperMessageLimitWindows(userId: string, dealId: string): DurableWindow[] {
  const user = subjectKey(userId);
  const deal = subjectKey(dealId);
  return [
    { bucket: `msg:u:${user}:m`, windowMs: DISCOVER_MINUTE_MS, limit: SHOPPER_MESSAGE_USER_PER_MINUTE },
    { bucket: `msg:u:${user}:d`, windowMs: DISCOVER_DAY_MS, limit: SHOPPER_MESSAGE_USER_PER_DAY },
    { bucket: `msg:d:${deal}:m`, windowMs: DISCOVER_MINUTE_MS, limit: SHOPPER_MESSAGE_DEAL_PER_MINUTE },
  ];
}

export const SHOPPER_READ_PER_MINUTE = 60;

const READ_COPY = 'Slow down a little. Try again in a minute.';

export function shopperReadLimitWindow(userId: string, route: 'messages' | 'chips'): DurableWindow {
  const user = subjectKey(userId);
  const name = route === 'messages' ? 'msg' : 'chip';
  return { bucket: `get:${name}:u:${user}:m`, windowMs: DISCOVER_MINUTE_MS, limit: SHOPPER_READ_PER_MINUTE };
}

export async function enforceShopperReadLimit(input: {
  userId: string;
  route: 'messages' | 'chips';
  nowMs?: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const window = shopperReadLimitWindow(input.userId, input.route);
  if (window.bucket.length < BUCKET_MIN || window.bucket.length > BUCKET_MAX) {
    throw new ShopperDealError(SHOPPER_MESSAGE_UNAVAILABLE_COPY, 503, 'rate_limit_unavailable');
  }
  let blocked: DurableWindow | null;
  try {
    blocked = await takeDurableLimits({
      windows: [window],
      nowMs: input.nowMs ?? Date.now(),
      store: input.store,
      env: input.env,
    });
  } catch (error) {
    if (error instanceof DurableRateLimitUnavailable) {
      throw new ShopperDealError(SHOPPER_MESSAGE_UNAVAILABLE_COPY, 503, 'rate_limit_unavailable');
    }
    throw error;
  }
  if (!blocked) return;
  throw new ShopperDealError(READ_COPY, 429, 'rate_limited');
}

export async function enforceShopperMessageLimit(input: {
  userId: string;
  dealId: string;
  nowMs: number;
  store?: RateLimitStore;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const windows = shopperMessageLimitWindows(input.userId, input.dealId);
  for (const window of windows) {
    if (window.bucket.length < BUCKET_MIN || window.bucket.length > BUCKET_MAX) {
      throw new ShopperDealError(SHOPPER_MESSAGE_UNAVAILABLE_COPY, 503, 'rate_limit_unavailable');
    }
  }
  let blocked: DurableWindow | null;
  try {
    blocked = await takeDurableLimits({
      windows,
      nowMs: input.nowMs,
      store: input.store,
      env: input.env,
    });
  } catch (error) {
    if (error instanceof DurableRateLimitUnavailable) {
      throw new ShopperDealError(SHOPPER_MESSAGE_UNAVAILABLE_COPY, 503, 'rate_limit_unavailable');
    }
    throw error;
  }
  if (!blocked) return;
  const copy = blocked.windowMs >= DISCOVER_DAY_MS ? SHOPPER_MESSAGE_DAY_COPY : SHOPPER_MESSAGE_MINUTE_COPY;
  throw new ShopperDealError(copy, 429, 'rate_limited');
}
