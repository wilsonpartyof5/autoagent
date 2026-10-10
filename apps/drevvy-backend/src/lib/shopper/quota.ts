/**
 * Monthly car quota. $97 includes 10 cars in the RevenueCat billing period.
 * A removed car refunds its slot only inside 30 minutes and only when no
 * email, text, or call has gone out yet. Sold and ended_no_response refund
 * the slot whenever they happen. Canceling the subscription blocks new adds
 * and leaves cars already started on their current end state.
 */

export const MONTHLY_CAR_CAP = 10;
export const MONTHLY_PRICE_USD = 97;
export const REMOVE_REFUND_WINDOW_MS = 30 * 60 * 1000;
export const NO_RESPONSE_MS = 5 * 24 * 60 * 60 * 1000;

export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'none';
export type BillingSource = 'revenuecat' | 'demo';
export type QuotaReason = 'ok' | 'monthly_quota' | 'subscription_inactive';
export type QuotaEndState = 'open' | 'sold' | 'ended_no_response' | 'removed';

export type BillingPeriod = {
  status: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  source: BillingSource;
};

export type QuotaDeal = {
  id: string;
  addedAt: string;
  removedAt: string | null;
  outreachSentAt: string | null;
  endState: QuotaEndState;
  endedAt: string | null;
};

export type QuotaSummary = {
  priceUsd: number;
  cap: number;
  used: number;
  remaining: number;
  canAdd: boolean;
  reason: QuotaReason;
  periodStart: string;
  periodEnd: string;
  subscriptionStatus: SubscriptionStatus;
  source: BillingSource;
};

type BillingEnv = {
  REVENUECAT_SECRET_API_KEY?: string;
  [key: string]: string | undefined;
};

type FetchLike = (input: string, init?: { headers?: Record<string, string>; cache?: 'no-store' }) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export function dealCountsTowardQuota(deal: QuotaDeal, period: Pick<BillingPeriod, 'periodStart' | 'periodEnd'>): boolean {
  if (!addedInPeriod(deal.addedAt, period)) return false;
  if (deal.endState === 'sold' || deal.endState === 'ended_no_response') return false;
  if (refundsRemoval(deal)) return false;
  return true;
}

export function quotaUsage(period: BillingPeriod, deals: readonly QuotaDeal[]): QuotaSummary {
  const used = deals.reduce((count, deal) => count + (dealCountsTowardQuota(deal, period) ? 1 : 0), 0);
  const remaining = Math.max(0, MONTHLY_CAR_CAP - used);
  const reason: QuotaReason = period.status !== 'active'
    ? 'subscription_inactive'
    : used >= MONTHLY_CAR_CAP
      ? 'monthly_quota'
      : 'ok';
  return {
    priceUsd: MONTHLY_PRICE_USD,
    cap: MONTHLY_CAR_CAP,
    used,
    remaining,
    canAdd: reason === 'ok',
    reason,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    subscriptionStatus: period.status,
    source: period.source,
  };
}

export function demoBillingPeriod(now: Date): BillingPeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    status: 'active',
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    source: 'demo',
  };
}

export function billingPeriodFromRevenueCat(body: unknown, now: Date): BillingPeriod {
  const subscriptions = readSubscriptions(body);
  const picked = pickSubscription(subscriptions, now.getTime());
  if (!picked) return inactiveBillingPeriod(now, 'revenuecat');

  const starts = Date.parse(picked.starts);
  const expires = Date.parse(picked.expires);
  if (!Number.isFinite(starts) || !Number.isFinite(expires) || expires <= starts) {
    return inactiveBillingPeriod(now, 'revenuecat');
  }

  let status: SubscriptionStatus = 'active';
  if (expires <= now.getTime()) status = 'expired';
  else if (picked.unsubscribed) status = 'canceled';

  return {
    status,
    periodStart: new Date(starts).toISOString(),
    periodEnd: new Date(expires).toISOString(),
    source: 'revenuecat',
  };
}

export async function loadBillingPeriod(
  userId: string,
  env: BillingEnv,
  fetchFn: FetchLike,
  now: Date,
): Promise<BillingPeriod> {
  const key = env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!key) return demoBillingPeriod(now);

  try {
    const response = await fetchFn(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) return inactiveBillingPeriod(now, 'revenuecat');
    return billingPeriodFromRevenueCat(await response.json(), now);
  } catch {
    return inactiveBillingPeriod(now, 'revenuecat');
  }
}

function refundsRemoval(deal: QuotaDeal): boolean {
  if (!deal.removedAt) return false;
  const added = Date.parse(deal.addedAt);
  const removed = Date.parse(deal.removedAt);
  if (!Number.isFinite(added) || !Number.isFinite(removed)) return false;
  const elapsed = removed - added;
  if (elapsed < 0 || elapsed > REMOVE_REFUND_WINDOW_MS) return false;
  if (!deal.outreachSentAt) return true;
  const outreach = Date.parse(deal.outreachSentAt);
  if (!Number.isFinite(outreach)) return true;
  return outreach > removed;
}

function addedInPeriod(addedAt: string, period: Pick<BillingPeriod, 'periodStart' | 'periodEnd'>): boolean {
  const added = Date.parse(addedAt);
  const start = Date.parse(period.periodStart);
  const end = Date.parse(period.periodEnd);
  if (!Number.isFinite(added) || !Number.isFinite(start) || !Number.isFinite(end)) return true;
  return added >= start && added < end;
}

function inactiveBillingPeriod(now: Date, source: BillingSource): BillingPeriod {
  const demo = demoBillingPeriod(now);
  return { ...demo, status: 'none', source };
}

type SubscriptionWindow = {
  starts: string;
  expires: string;
  unsubscribed: boolean;
};

function readSubscriptions(body: unknown): SubscriptionWindow[] {
  if (!body || typeof body !== 'object') return [];
  const subscriber = (body as { subscriber?: { subscriptions?: unknown } }).subscriber;
  const subscriptions = subscriber?.subscriptions;
  if (!subscriptions || typeof subscriptions !== 'object') return [];

  const windows: SubscriptionWindow[] = [];
  for (const key of Object.keys(subscriptions)) {
    const value = (subscriptions as Record<string, unknown>)[key];
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    if (typeof row.expires_date !== 'string' || typeof row.purchase_date !== 'string') continue;
    windows.push({
      starts: row.purchase_date,
      expires: row.expires_date,
      unsubscribed: typeof row.unsubscribe_detected_at === 'string' && row.unsubscribe_detected_at.length > 0,
    });
  }
  return windows;
}

function pickSubscription(windows: SubscriptionWindow[], nowMs: number): SubscriptionWindow | null {
  const parsed = windows
    .map((window) => ({ window, expires: Date.parse(window.expires) }))
    .filter((item) => Number.isFinite(item.expires))
    .sort((a, b) => b.expires - a.expires);
  if (parsed.length === 0) return null;
  const current = parsed.find((item) => item.expires > nowMs);
  return (current ?? parsed[0]).window;
}
