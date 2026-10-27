/**
 * Key balance. Packs are generic keys (1/$4.99, 5/$19.99, 10/$34.99, 25/$74.99).
 * Spend kind is assigned at use:
 * - market_save: unlock market details and save a listing. Never refunded.
 * - dealer_conversation: open in-app chat only when the listing URL / domain /
 *   MarketCheck dealer id matches an onboarded rooftop. Refunded once via
 *   refund:<deal id> when the car is sold, the dealer declines or opts out, or
 *   Day 7 after confirmed delivery ends with no reply.
 * Off-network OTD requests spend nothing. Removing a deal before outreach
 * does not return a key.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { isShopperListingId } from './deals';

export const KEY_PACKS = [
  { size: 1, priceUsd: 4.99, productId: 'drevvy_keys_1', packageId: 'keys_1', recommended: false },
  { size: 5, priceUsd: 19.99, productId: 'drevvy_keys_5', packageId: 'keys_5', recommended: false },
  { size: 10, priceUsd: 34.99, productId: 'drevvy_keys_10', packageId: 'keys_10', recommended: true },
  { size: 25, priceUsd: 74.99, productId: 'drevvy_keys_25', packageId: 'keys_25', recommended: false },
] as const;

export type KeySpendKind = 'market_save' | 'dealer_conversation';

/** App-level spend kind mapped onto Analytics `key_kind`. */
export type AnalyticsKeyKind = 'market_intel' | 'conversation';

/** App-level refund cause. Mapped onto Analytics `refund_reason` at write time. */
export type DealerKeyRefundReason =
  | 'sold'
  | 'ended_no_response'
  | 'dealer_declined'
  | 'dealer_opted_out'
  | 'admin';

/** Values allowed on `shopper_credit_events.refund_reason`. */
export type AnalyticsRefundReason =
  | 'no_reply_7d'
  | 'sold'
  | 'dealer_declined'
  | 'dealer_opted_out'
  | 'admin';

export function analyticsKeyKind(spend: KeySpendKind): AnalyticsKeyKind {
  return spend === 'market_save' ? 'market_intel' : 'conversation';
}

export function analyticsRefundReason(reason: DealerKeyRefundReason): AnalyticsRefundReason {
  if (reason === 'ended_no_response') return 'no_reply_7d';
  return reason;
}

export function usdToCents(priceUsd: number): number {
  return Math.round(priceUsd * 100);
}

export function marketSaveIdempotencyKey(listingId: string): string {
  return `use:market_save:${listingId}`;
}

export function dealerConversationIdempotencyKey(dealId: string): string {
  return `use:dealer_conversation:${dealId}`;
}

export function dealerConversationRefundKey(dealId: string): string {
  return `refund:${dealId}`;
}

export type CreditEventType = 'purchase' | 'use' | 'refund';

export type ShopperCredits = {
  userId: string;
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
  lifetimeRefunded: number;
};

export type CreditEvent = {
  id: string;
  userId: string;
  eventType: CreditEventType;
  amount: number;
  dealId: string | null;
  packSize: number | null;
  packPriceUsd: number | null;
  idempotencyKey: string;
  createdAt: string;
};

export type CreditCheckResult =
  | { canAdd: true; balance: number }
  | { canAdd: false; balance: number; reason: 'no_credits' };

export async function getShopperCredits(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShopperCredits> {
  const { data, error } = await supabase
    .from('shopper_credits')
    .select('user_id, balance, lifetime_purchased, lifetime_used, lifetime_refunded')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[credits] Error fetching credits:', error.message);
  }

  if (!data) {
    return {
      userId,
      balance: 0,
      lifetimePurchased: 0,
      lifetimeUsed: 0,
      lifetimeRefunded: 0,
    };
  }

  return {
    userId: data.user_id,
    balance: data.balance,
    lifetimePurchased: data.lifetime_purchased,
    lifetimeUsed: data.lifetime_used,
    lifetimeRefunded: data.lifetime_refunded,
  };
}

export async function checkCanAddCar(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreditCheckResult> {
  const credits = await getShopperCredits(supabase, userId);

  if (credits.balance <= 0) {
    return { canAdd: false, balance: credits.balance, reason: 'no_credits' };
  }

  return { canAdd: true, balance: credits.balance };
}

type KeySpendResult = {
  success: boolean;
  newBalance: number;
  alreadyConsumed: boolean;
  error?: 'no_credits' | 'credit_failed';
};

function readSpendRow(data: unknown): KeySpendResult {
  const row = (Array.isArray(data) ? data[0] : data) as {
    consumed?: boolean;
    already_consumed?: boolean;
    balance?: number;
  } | null | undefined;
  const consumed = row?.consumed === true;
  const alreadyConsumed = row?.already_consumed === true;
  const newBalance = row?.balance ?? 0;
  if (!consumed && !alreadyConsumed) {
    return { success: false, newBalance, alreadyConsumed: false, error: 'no_credits' };
  }
  return { success: true, newBalance, alreadyConsumed };
}

export type ConsumeCreditOptions = {
  /** In-network `drevvy_vdp_matches.id`. Required on prod for conversation spends. */
  vdpMatchId?: string | null;
};

/** Spend the dealer-conversation key. Idempotent per deal. Does not spend the market+save key. */
export async function consumeCredit(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
  options?: ConsumeCreditOptions,
): Promise<KeySpendResult> {
  const { data, error } = await supabase.rpc('consume_credit_atomic', {
    p_user_id: userId,
    p_deal_id: dealId,
    p_vdp_match_id: options?.vdpMatchId ?? null,
  });

  if (error) {
    console.error('[credits] Error calling consume_credit_atomic:', error.message);
    return { success: false, newBalance: 0, alreadyConsumed: false, error: 'credit_failed' };
  }

  return readSpendRow(data);
}

/** Spend the market+save key. Idempotent per listing. This key is never refunded. */
export async function spendMarketSaveKey(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<KeySpendResult> {
  if (!isShopperListingId(listingId)) {
    return { success: false, newBalance: 0, alreadyConsumed: false, error: 'credit_failed' };
  }

  const { data, error } = await supabase.rpc('consume_market_save_atomic', {
    p_user_id: userId,
    p_listing_id: listingId,
  });

  if (error) {
    console.error('[credits] Error calling consume_market_save_atomic:', error.message);
    return { success: false, newBalance: 0, alreadyConsumed: false, error: 'credit_failed' };
  }

  return readSpendRow(data);
}

export async function refundCredit(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
  reason: DealerKeyRefundReason,
): Promise<{ refunded: boolean; newBalance: number; alreadyRefunded: boolean }> {
  const idempotencyKey = dealerConversationRefundKey(dealId);

  const { data, error } = await supabase.rpc('refund_credit_atomic', {
    p_user_id: userId,
    p_deal_id: dealId,
    p_idempotency_key: idempotencyKey,
    p_refund_reason: analyticsRefundReason(reason),
  });

  if (error) {
    console.error('[credits] Error calling refund_credit_atomic:', error.message);
    const credits = await getShopperCredits(supabase, userId);
    return { refunded: false, newBalance: credits.balance, alreadyRefunded: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const refunded = row?.refunded ?? false;
  const alreadyRefunded = row?.already_refunded ?? false;
  const newBalance = row?.new_balance ?? 0;

  if (refunded) {
    console.log(JSON.stringify({
      event: 'credit_refunded',
      userId,
      dealId,
      reason,
      newBalance,
    }));
  }

  return { refunded, newBalance, alreadyRefunded };
}

export function purchaseIdempotencyKey(transactionId: string): string {
  return `purchase:${transactionId}`;
}

export function purchaseReversalKey(transactionId: string): string {
  return `purchase_reversal:${transactionId}`;
}

type AtomicCreditRow = {
  granted?: boolean;
  already_granted?: boolean;
  reversed?: boolean;
  already_reversed?: boolean;
  balance?: number;
  lifetime_purchased?: number;
  lifetime_used?: number;
  lifetime_refunded?: number;
};

function atomicCreditRow(data: unknown): AtomicCreditRow {
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? {}) as AtomicCreditRow;
}

function creditsFromAtomicRow(userId: string, row: AtomicCreditRow): ShopperCredits {
  return {
    userId,
    balance: row.balance ?? 0,
    lifetimePurchased: row.lifetime_purchased ?? 0,
    lifetimeUsed: row.lifetime_used ?? 0,
    lifetimeRefunded: row.lifetime_refunded ?? 0,
  };
}

export async function purchaseCredits(
  supabase: SupabaseClient,
  userId: string,
  packSize: number,
  packPriceUsd: number,
  transactionId: string,
): Promise<{ success: boolean; credits: ShopperCredits; granted: boolean; alreadyGranted: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('purchase_credits_atomic', {
    p_user_id: userId,
    p_pack_size: packSize,
    p_pack_price_usd: usdToCents(packPriceUsd),
    p_idempotency_key: purchaseIdempotencyKey(transactionId),
    p_reversal_key: purchaseReversalKey(transactionId),
  });

  if (error) {
    const credits = await getShopperCredits(supabase, userId);
    return { success: false, credits, granted: false, alreadyGranted: false, error: error.message };
  }

  const row = atomicCreditRow(data);
  return {
    success: true,
    credits: creditsFromAtomicRow(userId, row),
    granted: row.granted === true,
    alreadyGranted: row.already_granted === true,
  };
}

export async function reversePurchaseCredits(
  supabase: SupabaseClient,
  userId: string,
  packSize: number,
  transactionId: string,
): Promise<{ success: boolean; credits: ShopperCredits; reversed: boolean; alreadyReversed: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('reverse_purchase_atomic', {
    p_user_id: userId,
    p_amount: packSize,
    p_purchase_key: purchaseIdempotencyKey(transactionId),
    p_reversal_key: purchaseReversalKey(transactionId),
  });

  if (error) {
    const credits = await getShopperCredits(supabase, userId);
    return { success: false, credits, reversed: false, alreadyReversed: false, error: error.message };
  }

  const row = atomicCreditRow(data);
  return {
    success: true,
    credits: creditsFromAtomicRow(userId, row),
    reversed: row.reversed === true,
    alreadyReversed: row.already_reversed === true,
  };
}

export async function getCreditEvents(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<CreditEvent[]> {
  const { data, error } = await supabase
    .from('shopper_credit_events')
    .select('id, user_id, event_type, amount, deal_id, pack_size, pack_price_usd, pack_price_cents, idempotency_key, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[credits] Error fetching credit events:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type as CreditEventType,
    amount: row.amount,
    dealId: row.deal_id,
    packSize: row.pack_size,
    packPriceUsd: row.pack_price_cents != null ? row.pack_price_cents / 100 : row.pack_price_usd,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  }));
}
