/**
 * Key-pack purchases. The client may send a key count; the server ignores it
 * and maps productId to the pack. A production purchase grants when
 * is_sandbox is false, or when a webhook environment is exactly PRODUCTION,
 * and only after the subscriber API confirms that transaction. Sandbox
 * grants require DREVVY_SANDBOX_GRANT_USER_IDS and stay under the daily cap.
 * Test Store and promotional purchases never grant. One store transaction,
 * including every alias, grants one shopper. TRANSFER does not move keys.
 * Retired car packs (drevvy_pack_1/3/5/10 and pack_1/3/5/10) grant nothing.
 */

import { tokensEqual } from '@/lib/auth/tokens';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  purchaseCredits,
  reversePurchaseCredits,
  type ShopperCredits,
} from './credits';
import {
  isBlockedPurchaseSource,
  isRefundCancelReason,
  sandboxGrantCap,
  sandboxUserAllowed,
  type SandboxGrantCap,
  type SandboxGrantEnv,
} from './sandbox-grant-policy';

export const CREDIT_PRODUCTS = {
  drevvy_keys_1: { size: 1, priceUsd: 4.99 },
  drevvy_keys_5: { size: 5, priceUsd: 19.99 },
  drevvy_keys_10: { size: 10, priceUsd: 34.99 },
  drevvy_keys_25: { size: 25, priceUsd: 74.99 },
} as const;

/** RevenueCat package identifier → store product. Grants are 1/5/10/25 generic keys. */
export const CREDIT_PACKAGES = {
  keys_1: 'drevvy_keys_1',
  keys_5: 'drevvy_keys_5',
  keys_10: 'drevvy_keys_10',
  keys_25: 'drevvy_keys_25',
  drevvy_key_1: 'drevvy_keys_1',
  drevvy_key_5: 'drevvy_keys_5',
  drevvy_key_10: 'drevvy_keys_10',
  drevvy_key_25: 'drevvy_keys_25',
} as const satisfies Record<string, CreditProductId>;

export type CreditProductId = keyof typeof CREDIT_PRODUCTS;

export type CreditBalanceData = {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
  lifetimeRefunded: number;
};

export type RevenueCatPurchaseRecord = {
  id?: string | null;
  store_transaction_id?: string | null;
  transaction_id?: string | null;
  /** Boolean true is sandbox. Boolean false is production. Anything else is not a purchase. */
  is_sandbox?: unknown;
  store?: unknown;
  period_type?: unknown;
};

export type RevenueCatSubscriber = {
  non_subscriptions?: Record<string, RevenueCatPurchaseRecord[] | null> | null;
};

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function packForProductId(productId: string): { productId: CreditProductId; size: number; priceUsd: number } | null {
  const storeId = Object.prototype.hasOwnProperty.call(CREDIT_PACKAGES, productId)
    ? CREDIT_PACKAGES[productId as keyof typeof CREDIT_PACKAGES]
    : productId;
  if (Object.prototype.hasOwnProperty.call(CREDIT_PRODUCTS, storeId)) {
    const id = storeId as CreditProductId;
    return { productId: id, ...CREDIT_PRODUCTS[id] };
  }
  return null;
}

export function creditBalanceData(credits: ShopperCredits): CreditBalanceData {
  return {
    balance: credits.balance,
    lifetimePurchased: credits.lifetimePurchased,
    lifetimeUsed: credits.lifetimeUsed,
    lifetimeRefunded: credits.lifetimeRefunded,
  };
}

export function purchasesConfigured(apiKey: string | undefined): boolean {
  return typeof apiKey === 'string' && apiKey.trim() !== '';
}

export function webhookAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (tokensEqual(authorization, secret)) return true;
  return tokensEqual(authorization, `Bearer ${secret}`);
}

export type VerifiedCreditPurchase = {
  productId: CreditProductId;
  size: number;
  priceUsd: number;
  transactionId: string;
  sandbox: boolean;
  aliases: string[];
  store: string | null;
  periodType: string | null;
};

function trimmedId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  const ids: string[] = [];
  for (const value of values) {
    const id = typeof value === 'string' ? trimmedId(value) : null;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function canonicalTransactionId(purchase: RevenueCatPurchaseRecord): string | null {
  return trimmedId(purchase.store_transaction_id)
    ?? trimmedId(purchase.transaction_id)
    ?? trimmedId(purchase.id);
}

export function findVerifiedPurchase(
  subscriber: RevenueCatSubscriber,
  transactionId: string,
  expectedProductId?: string,
): VerifiedCreditPurchase | null {
  const needle = transactionId.trim();
  if (!needle) return null;
  const expected = expectedProductId ? packForProductId(expectedProductId) : null;
  if (expectedProductId && !expected) return null;
  const groups = subscriber.non_subscriptions ?? {};
  for (const [productId, purchases] of Object.entries(groups)) {
    const pack = packForProductId(productId);
    if (!pack) continue;
    if (expected && expected.productId !== pack.productId) continue;
    for (const purchase of purchases ?? []) {
      const canonical = canonicalTransactionId(purchase);
      if (!canonical) continue;
      if (purchase.is_sandbox !== true && purchase.is_sandbox !== false) continue;
      const aliases = uniqueIds([
        canonical,
        purchase.id,
        purchase.store_transaction_id,
        purchase.transaction_id,
      ]);
      if (!aliases.includes(needle)) continue;
      return {
        ...pack,
        transactionId: canonical,
        sandbox: purchase.is_sandbox === true,
        aliases,
        store: typeof purchase.store === 'string' ? purchase.store : null,
        periodType: typeof purchase.period_type === 'string' ? purchase.period_type : null,
      };
    }
  }
  return null;
}

export type ClaimGrantDecision =
  | { ok: true; sandbox: boolean }
  | { ok: false; status: number; code: string; message: string };

export function decideClaimGrant(
  userId: string,
  verified: VerifiedCreditPurchase,
  env: SandboxGrantEnv,
  cap: SandboxGrantCap,
  now: Date,
): ClaimGrantDecision {
  if (isBlockedPurchaseSource({ store: verified.store, periodType: verified.periodType })) {
    return {
      ok: false,
      status: 402,
      code: 'purchase_not_eligible',
      message: 'This purchase cannot add keys.',
    };
  }
  if (verified.sandbox) {
    if (!sandboxUserAllowed(userId, env)) {
      return {
        ok: false,
        status: 403,
        code: 'sandbox_not_allowed',
        message: 'Sandbox purchases are not enabled for this account.',
      };
    }
    if (!cap.allows(userId, verified.transactionId, now)) {
      return {
        ok: false,
        status: 429,
        code: 'sandbox_daily_cap',
        message: 'Sandbox purchase limit reached for today.',
      };
    }
    return { ok: true, sandbox: true };
  }
  return { ok: true, sandbox: false };
}

export async function grantVerifiedPurchase(
  supabase: SupabaseClient,
  userId: string,
  verified: VerifiedCreditPurchase,
  options?: { allowLegacyRpc?: boolean },
) {
  return purchaseCredits(
    supabase,
    userId,
    verified.size,
    verified.priceUsd,
    verified.transactionId,
    verified.productId,
    verified.aliases,
    options?.allowLegacyRpc === true,
  );
}

export async function fetchRevenueCatSubscriber(
  appUserId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; subscriber: RevenueCatSubscriber } | { ok: false; status: number }> {
  const response = await fetchImpl(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    },
  );
  if (response.status === 404) return { ok: true, subscriber: { non_subscriptions: {} } };
  if (!response.ok) return { ok: false, status: response.status };
  const body = await response.json() as { subscriber?: RevenueCatSubscriber };
  return { ok: true, subscriber: body.subscriber ?? { non_subscriptions: {} } };
}

export function isConsumerUserId(value: string): boolean {
  return USER_ID.test(value);
}

export type RevenueCatWebhookEvent = {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  store_transaction_id?: string;
  transaction_id?: string;
  id?: string;
  /** Grant path accepts only the exact strings SANDBOX and PRODUCTION. */
  environment?: unknown;
  store?: unknown;
  period_type?: unknown;
  cancel_reason?: unknown;
};

export type RevenueCatApplyDeps = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  env?: SandboxGrantEnv;
  sandboxCap?: SandboxGrantCap;
  now?: () => Date;
};

export type RevenueCatApplyResult = {
  applied: 'granted' | 'reversed' | 'ignored';
  credits: ShopperCredits | null;
  retryable: boolean;
};

const IGNORED: RevenueCatApplyResult = { applied: 'ignored', credits: null, retryable: false };

type ConfirmResult =
  | { ok: true; verified: VerifiedCreditPurchase }
  | { ok: false; retryable: boolean };

let confirmFailureCount = 0;

function logConfirmFailure(reason: string, status: number | null) {
  confirmFailureCount += 1;
  console.error(JSON.stringify({
    event: 'revenuecat_confirm_failed',
    reason,
    status,
    repeat: confirmFailureCount,
  }));
}

async function confirmSubscriberPurchase(
  appUserId: string,
  transactionId: string,
  productId: string | undefined,
  deps: RevenueCatApplyDeps,
): Promise<ConfirmResult> {
  const apiKey = deps.apiKey ?? process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey || !purchasesConfigured(apiKey)) {
    logConfirmFailure('missing_key', null);
    return { ok: false, retryable: true };
  }
  try {
    const lookup = await fetchRevenueCatSubscriber(appUserId, apiKey, deps.fetchImpl ?? fetch);
    if (!lookup.ok) {
      if (lookup.status === 401 || lookup.status >= 500) {
        logConfirmFailure(lookup.status === 401 ? 'unauthorized' : 'upstream', lookup.status);
        return { ok: false, retryable: true };
      }
      return { ok: false, retryable: false };
    }
    const verified = findVerifiedPurchase(lookup.subscriber, transactionId, productId);
    if (!verified) return { ok: false, retryable: false };
    return { ok: true, verified };
  } catch {
    logConfirmFailure('transport', null);
    return { ok: false, retryable: true };
  }
}

function eventTransactionId(event: RevenueCatWebhookEvent): string {
  return trimmedId(event.store_transaction_id)
    ?? trimmedId(event.transaction_id)
    ?? trimmedId(event.id)
    ?? '';
}

function withEventAliases(
  verified: VerifiedCreditPurchase,
  event: RevenueCatWebhookEvent,
): VerifiedCreditPurchase {
  return {
    ...verified,
    aliases: uniqueIds([
      ...verified.aliases,
      event.store_transaction_id,
      event.transaction_id,
      event.id,
    ]),
  };
}

async function reverseFromWebhook(
  supabase: SupabaseClient,
  event: RevenueCatWebhookEvent,
  deps: RevenueCatApplyDeps,
): Promise<RevenueCatApplyResult> {
  const userId = (event.app_user_id ?? '').trim();
  const transactionId = eventTransactionId(event);
  if (!isConsumerUserId(userId) || !transactionId) return IGNORED;
  const confirmed = await confirmSubscriberPurchase(userId, transactionId, undefined, deps);
  if (!confirmed.ok && confirmed.retryable) {
    return { applied: 'ignored', credits: null, retryable: true };
  }
  const verified = confirmed.ok ? withEventAliases(confirmed.verified, event) : null;
  const tx = verified?.transactionId ?? transactionId;
  const fallback = verified?.size ?? packForProductId((event.product_id ?? '').trim())?.size ?? 1;
  const result = await reversePurchaseCredits(supabase, userId, fallback, tx);
  if (!result.success) return { applied: 'ignored', credits: result.credits, retryable: true };
  if (!result.reversed && !result.alreadyReversed) {
    return { applied: 'ignored', credits: result.credits, retryable: false };
  }
  return { applied: 'reversed', credits: result.credits, retryable: false };
}

export async function applyRevenueCatEvent(
  supabase: SupabaseClient,
  event: RevenueCatWebhookEvent,
  deps: RevenueCatApplyDeps = {},
): Promise<RevenueCatApplyResult> {
  const type = event.type ?? '';
  if (type === 'TRANSFER') {
    console.log(JSON.stringify({ event: 'revenuecat_transfer_ignored' }));
    return IGNORED;
  }

  if (type === 'REFUND' || (type === 'CANCELLATION' && isRefundCancelReason(event.cancel_reason))) {
    return reverseFromWebhook(supabase, event, deps);
  }
  if (type === 'CANCELLATION') return IGNORED;

  const userId = (event.app_user_id ?? '').trim();
  const transactionId = eventTransactionId(event);
  const productId = (event.product_id ?? '').trim();
  const pack = productId ? packForProductId(productId) : null;
  if (!isConsumerUserId(userId) || !transactionId || !pack) return IGNORED;
  if (isBlockedPurchaseSource(event)) return IGNORED;
  if (event.environment !== 'SANDBOX' && event.environment !== 'PRODUCTION') return IGNORED;

  const confirmed = await confirmSubscriberPurchase(userId, transactionId, productId, deps);
  if (!confirmed.ok) {
    return { applied: 'ignored', credits: null, retryable: confirmed.retryable };
  }
  const verified = withEventAliases(confirmed.verified, event);
  if (isBlockedPurchaseSource({ store: verified.store, periodType: verified.periodType })) return IGNORED;

  const production = event.environment === 'PRODUCTION' && verified.sandbox === false;
  const sandbox = event.environment === 'SANDBOX' && verified.sandbox === true;
  if (!production && !sandbox) return IGNORED;

  const env = deps.env ?? process.env;
  const cap = deps.sandboxCap ?? sandboxGrantCap();
  const now = deps.now ? deps.now() : new Date();
  if (sandbox && !sandboxUserAllowed(userId, env)) return IGNORED;
  if (sandbox && !cap.allows(userId, verified.transactionId, now)) return IGNORED;

  const result = await purchaseCredits(
    supabase,
    userId,
    verified.size,
    verified.priceUsd,
    verified.transactionId,
    verified.productId,
    verified.aliases,
    sandbox,
  );
  if (!result.success) return { applied: 'ignored', credits: result.credits, retryable: true };
  if (result.alreadyGrantedElsewhere || (!result.granted && !result.alreadyGranted)) {
    return { applied: 'ignored', credits: result.credits, retryable: false };
  }
  if (sandbox && result.granted && !result.alreadyGranted) {
    cap.note(userId, verified.transactionId, now);
  }
  return { applied: 'granted', credits: result.credits, retryable: false };
}
