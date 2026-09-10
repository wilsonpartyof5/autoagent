import { createHash } from 'crypto';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LEADS_PER_WINDOW = 5;

const recentByKey = new Map<string, number[]>();

function fingerprint(ipAddress: string): string {
  return createHash('sha256').update(ipAddress.trim() || 'unknown').digest('hex').slice(0, 16);
}

/**
 * In-process shopper lead cap. Does not persist raw IPs.
 */
export function acceptLeadSubmission(ipAddress?: string): boolean {
  const key = fingerprint(ipAddress || 'unknown');
  const now = Date.now();
  const recent = (recentByKey.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);
  if (recent.length >= MAX_LEADS_PER_WINDOW) {
    recentByKey.set(key, recent);
    return false;
  }
  recent.push(now);
  recentByKey.set(key, recent);
  return true;
}

export function resetLeadRateLimitForTests(): void {
  recentByKey.clear();
}

export const LEAD_RATE_LIMIT = {
  windowMs: WINDOW_MS,
  max: MAX_LEADS_PER_WINDOW,
} as const;
