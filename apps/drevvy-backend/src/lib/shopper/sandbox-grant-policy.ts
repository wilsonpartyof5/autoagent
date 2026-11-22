/**
 * Sandbox key grants are off unless the shopper is listed in
 * DREVVY_SANDBOX_GRANT_USER_IDS. The value is read at request time and is
 * never logged. An unset or empty value allows no sandbox grants.
 * The daily cap is in-memory, per process, and not shared across instances.
 */

export const SANDBOX_GRANTS_PER_UTC_DAY = 5;

const BLOCKED_SOURCES = new Set(['test_store', 'promotional']);
const REFUND_CANCEL_REASONS = new Set(['CUSTOMER_SUPPORT', 'REFUND']);

function token(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isBlockedPurchaseSource(source: {
  store?: unknown;
  environment?: unknown;
  period_type?: unknown;
  periodType?: unknown;
}): boolean {
  const store = token(source.store);
  const environment = token(source.environment);
  const period = token(source.period_type ?? source.periodType);
  return BLOCKED_SOURCES.has(store) || BLOCKED_SOURCES.has(environment) || BLOCKED_SOURCES.has(period);
}

/** REFUND events always reverse. CANCELLATION reverses only for these reasons. */
export function isRefundCancelReason(cancelReason: unknown): boolean {
  if (typeof cancelReason !== 'string') return false;
  const reason = cancelReason.trim().toUpperCase();
  if (!reason) return false;
  if (REFUND_CANCEL_REASONS.has(reason)) return true;
  return reason.includes('REFUND');
}

export type SandboxGrantEnv = {
  DREVVY_SANDBOX_GRANT_USER_IDS?: string;
  [key: string]: string | undefined;
};

export function sandboxGrantUserIds(env: SandboxGrantEnv = process.env): Set<string> {
  const raw = env.DREVVY_SANDBOX_GRANT_USER_IDS;
  if (typeof raw !== 'string') return new Set();
  const ids = new Set<string>();
  for (const part of raw.split(',')) {
    const id = part.trim().toLowerCase();
    if (id) ids.add(id);
  }
  return ids;
}

export function sandboxUserAllowed(userId: string, env: SandboxGrantEnv = process.env): boolean {
  return sandboxGrantUserIds(env).has(userId.trim().toLowerCase());
}

export type SandboxGrantCap = {
  allows(userId: string, transactionId: string, now: Date): boolean;
  note(userId: string, transactionId: string, now: Date): void;
};

export function createSandboxGrantCap(limit = SANDBOX_GRANTS_PER_UTC_DAY): SandboxGrantCap {
  const days = new Map<string, Set<string>>();
  const keyFor = (userId: string, now: Date) => `${userId}:${now.toISOString().slice(0, 10)}`;
  return {
    allows(userId, transactionId, now) {
      const ids = days.get(keyFor(userId, now));
      if (!ids) return limit > 0;
      if (ids.has(transactionId)) return true;
      return ids.size < limit;
    },
    note(userId, transactionId, now) {
      const key = keyFor(userId, now);
      const ids = days.get(key) ?? new Set<string>();
      if (ids.has(transactionId) || ids.size >= limit) {
        days.set(key, ids);
        return;
      }
      ids.add(transactionId);
      days.set(key, ids);
    },
  };
}

const sharedCap = createSandboxGrantCap();

export function sandboxGrantCap(): SandboxGrantCap {
  return sharedCap;
}
