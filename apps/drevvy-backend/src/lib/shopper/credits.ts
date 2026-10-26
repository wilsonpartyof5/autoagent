/**
 * Key credits system. Shoppers buy one-time key packs
 * (1/$4.99, 5/$19.99, 10/$34.99 recommended, 25/$74.99)
 * that never expire and never reset monthly.
 *
 * Product (2026-10-26): two spends from the same balance — 1 key for market
 * intelligence + save, and a separate key to open dealer conversation. If the
 * dealer does not reply within 7 days, refund the conversation key 1:1.
 * See key-spend.ts. consumeCredit still charges one undifferentiated credit
 * per deal; the second spend and 7-day chat refund are stubbed there.
 *
 * Existing refunds (unchanged): early removal before outreach, dealer decline.
 * Buying the car does not return a credit. Refunds are idempotent (exactly
 * once per deal) via the idempotency_key.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const KEY_PACKS = [
  { size: 1, priceUsd: 4.99 },
  { size: 5, priceUsd: 19.99 },
  { size: 10, priceUsd: 34.99 },
  { size: 25, priceUsd: 74.99 },
] as const;

/** @deprecated Use KEY_PACKS. */
export const CAR_PACKS = KEY_PACKS;

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

export async function consumeCredit(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
): Promise<{ success: boolean; newBalance: number; alreadyConsumed: boolean; error?: 'no_credits' | 'credit_failed' }> {
  const { data, error } = await supabase.rpc('consume_credit_atomic', {
    p_user_id: userId,
    p_deal_id: dealId,
  });

  if (error) {
    console.error('[credits] Error calling consume_credit_atomic:', error.message);
    return { success: false, newBalance: 0, alreadyConsumed: false, error: 'credit_failed' };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const consumed = row?.consumed === true;
  const alreadyConsumed = row?.already_consumed === true;
  const newBalance = row?.balance ?? 0;
  if (!consumed && !alreadyConsumed) {
    return { success: false, newBalance, alreadyConsumed: false, error: 'no_credits' };
  }
  return { success: true, newBalance, alreadyConsumed };
}

export async function refundCredit(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
  reason: 'dealer_declined' | 'removed',
): Promise<{ refunded: boolean; newBalance: number; alreadyRefunded: boolean }> {
  const idempotencyKey = `refund:${dealId}`;

  const { data, error } = await supabase.rpc('refund_credit_atomic', {
    p_user_id: userId,
    p_deal_id: dealId,
    p_idempotency_key: idempotencyKey,
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
    p_pack_price_usd: packPriceUsd,
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
    .select('id, user_id, event_type, amount, deal_id, pack_size, pack_price_usd, idempotency_key, created_at')
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
    packPriceUsd: row.pack_price_usd,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  }));
}
