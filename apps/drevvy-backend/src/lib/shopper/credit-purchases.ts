/**
 * Car-pack purchases. The client may send a credit count; the server ignores it
 * and maps productId to the pack. Credits are granted only after RevenueCat
 * confirms the transaction, or from an authenticated RevenueCat webhook.
 */

import { tokensEqual } from '@/lib/auth/tokens';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  purchaseCredits,
  reversePurchaseCredits,
  type ShopperCredits,
} from './credits';

export const CREDIT_PRODUCTS = {
  drevvy_pack_3: { size: 3, priceUsd: 47 },
  drevvy_pack_5: { size: 5, priceUsd: 67 },
  drevvy_pack_10: { size: 10, priceUsd: 97 },
} as const;

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
};

export type RevenueCatSubscriber = {
  non_subscriptions?: Record<string, RevenueCatPurchaseRecord[] | null> | null;
};

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function packForProductId(productId: string): { productId: CreditProductId; size: number; priceUsd: number } | null {
  if (Object.prototype.hasOwnProperty.call(CREDIT_PRODUCTS, productId)) {
    const id = productId as CreditProductId;
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
};

function trimmedId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
      const aliases = [
        trimmedId(purchase.id),
        trimmedId(purchase.store_transaction_id),
        trimmedId(purchase.transaction_id),
      ].filter((id): id is string => id != null);
      if (aliases.includes(needle)) return { ...pack, transactionId: canonical };
    }
  }
  return null;
}

export async function grantVerifiedPurchase(
  supabase: SupabaseClient,
  userId: string,
  verified: VerifiedCreditPurchase,
) {
  return purchaseCredits(supabase, userId, verified.size, verified.priceUsd, verified.transactionId);
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
  transaction_id?: string;
  id?: string;
};

export type RevenueCatApplyResult = {
  applied: 'granted' | 'reversed' | 'ignored';
  credits: ShopperCredits | null;
  retryable: boolean;
};

export async function applyRevenueCatEvent(
  supabase: SupabaseClient,
  event: RevenueCatWebhookEvent,
): Promise<RevenueCatApplyResult> {
  const type = event.type ?? '';
  const userId = (event.app_user_id ?? '').trim();
  const transactionId = (event.transaction_id ?? '').trim();
  const pack = event.product_id ? packForProductId(event.product_id.trim()) : null;
  if (!isConsumerUserId(userId) || !transactionId || !pack) {
    return { applied: 'ignored', credits: null, retryable: false };
  }

  if (type === 'NON_RENEWING_PURCHASE') {
    const result = await purchaseCredits(supabase, userId, pack.size, pack.priceUsd, transactionId);
    if (!result.success) return { applied: 'ignored', credits: result.credits, retryable: true };
    if (!result.granted && !result.alreadyGranted) {
      return { applied: 'ignored', credits: result.credits, retryable: false };
    }
    return { applied: 'granted', credits: result.credits, retryable: false };
  }

  if (type === 'REFUND' || type === 'CANCELLATION') {
    const result = await reversePurchaseCredits(supabase, userId, pack.size, transactionId);
    if (!result.success) return { applied: 'ignored', credits: result.credits, retryable: true };
    if (!result.reversed && !result.alreadyReversed) {
      return { applied: 'ignored', credits: result.credits, retryable: false };
    }
    return { applied: 'reversed', credits: result.credits, retryable: false };
  }

  return { applied: 'ignored', credits: null, retryable: false };
}
