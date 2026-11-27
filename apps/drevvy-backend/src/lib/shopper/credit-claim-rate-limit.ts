import { MemoryRateLimitStore, type RateLimitStore } from '../public-discover/rate-limit';

/**
 * Per-user cap for POST /api/consumer/credits and POST /api/consumer/credits/restore.
 * Uses the in-memory store from the public Discover limiter. It is not durable
 * and not shared across instances. No database table is required.
 */
export const CREDIT_CLAIM_LIMIT = 10;
export const CREDIT_CLAIM_WINDOW_MS = 60_000;

export type CreditClaimLimiter = {
  allow(userId: string, nowMs?: number): Promise<boolean>;
};

export function createCreditClaimLimiter(
  store: RateLimitStore = new MemoryRateLimitStore(),
  limit = CREDIT_CLAIM_LIMIT,
): CreditClaimLimiter {
  return {
    async allow(userId, nowMs = Date.now()) {
      const windowStartMs = nowMs - (nowMs % CREDIT_CLAIM_WINDOW_MS);
      const hit = await store.hit(
        `credit-claim:${userId}`,
        windowStartMs,
        CREDIT_CLAIM_WINDOW_MS,
        limit,
        nowMs,
      );
      return hit.allowed;
    },
  };
}

const sharedLimiter = createCreditClaimLimiter();

export function creditClaimLimiter(): CreditClaimLimiter {
  return sharedLimiter;
}
