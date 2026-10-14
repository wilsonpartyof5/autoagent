/**
 * Car credits system. Shoppers buy one-time car packs (3/$47, 5/$67, 10/$97)
 * that never expire and never reset monthly. Credits are refunded on:
 * - sold: shopper bought the car
 * - ended_no_response: dealer didn't respond in 5 days
 * - dealer_declined: dealer opted out or marked as spam
 *
 * Refunds are idempotent (exactly once per deal) via the idempotency_key.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const CAR_PACKS = [
  { size: 3, priceUsd: 47 },
  { size: 5, priceUsd: 67 },
  { size: 10, priceUsd: 97 },
] as const;

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
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const idempotencyKey = `use:${dealId}`;

  const { data: existing } = await supabase
    .from('shopper_credit_events')
    .select('id')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing) {
    const credits = await getShopperCredits(supabase, userId);
    return { success: true, newBalance: credits.balance };
  }

  const { error: upsertError } = await supabase
    .from('shopper_credits')
    .upsert(
      {
        user_id: userId,
        balance: 0,
        lifetime_purchased: 0,
        lifetime_used: 0,
        lifetime_refunded: 0,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (upsertError) {
    return { success: false, newBalance: 0, error: upsertError.message };
  }

  const { data: credits, error: selectError } = await supabase
    .from('shopper_credits')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (selectError || !credits) {
    return { success: false, newBalance: 0, error: selectError?.message ?? 'Credits not found' };
  }

  if (credits.balance <= 0) {
    return { success: false, newBalance: 0, error: 'No credits available' };
  }

  const { error: eventError } = await supabase.from('shopper_credit_events').insert({
    user_id: userId,
    event_type: 'use',
    amount: 1,
    deal_id: dealId,
    idempotency_key: idempotencyKey,
  });

  if (eventError) {
    if (eventError.code === '23505') {
      const updatedCredits = await getShopperCredits(supabase, userId);
      return { success: true, newBalance: updatedCredits.balance };
    }
    return { success: false, newBalance: credits.balance, error: eventError.message };
  }

  const { data: currentRow } = await supabase
    .from('shopper_credits')
    .select('balance, lifetime_used')
    .eq('user_id', userId)
    .single();

  const currentBalance = currentRow?.balance ?? credits.balance;
  const currentUsed = currentRow?.lifetime_used ?? 0;

  const { error: updateError } = await supabase
    .from('shopper_credits')
    .update({
      balance: currentBalance - 1,
      lifetime_used: currentUsed + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    return { success: false, newBalance: credits.balance, error: updateError.message };
  }

  const updatedCredits = await getShopperCredits(supabase, userId);
  return { success: true, newBalance: updatedCredits.balance };
}

export async function refundCredit(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
  reason: 'sold' | 'ended_no_response' | 'dealer_declined' | 'removed',
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

export async function purchaseCredits(
  supabase: SupabaseClient,
  userId: string,
  packSize: number,
  packPriceUsd: number,
  transactionId: string,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const idempotencyKey = `purchase:${transactionId}`;

  const { data: existing } = await supabase
    .from('shopper_credit_events')
    .select('id')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing) {
    const credits = await getShopperCredits(supabase, userId);
    return { success: true, newBalance: credits.balance };
  }

  const { error: upsertError } = await supabase
    .from('shopper_credits')
    .upsert(
      {
        user_id: userId,
        balance: 0,
        lifetime_purchased: 0,
        lifetime_used: 0,
        lifetime_refunded: 0,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (upsertError) {
    return { success: false, newBalance: 0, error: upsertError.message };
  }

  const { error: eventError } = await supabase.from('shopper_credit_events').insert({
    user_id: userId,
    event_type: 'purchase',
    amount: packSize,
    pack_size: packSize,
    pack_price_usd: packPriceUsd,
    idempotency_key: idempotencyKey,
  });

  if (eventError) {
    if (eventError.code === '23505') {
      const credits = await getShopperCredits(supabase, userId);
      return { success: true, newBalance: credits.balance };
    }
    return { success: false, newBalance: 0, error: eventError.message };
  }

  const { data: currentCredits } = await supabase
    .from('shopper_credits')
    .select('balance, lifetime_purchased')
    .eq('user_id', userId)
    .single();

  if (currentCredits) {
    await supabase
      .from('shopper_credits')
      .update({
        balance: currentCredits.balance + packSize,
        lifetime_purchased: currentCredits.lifetime_purchased + packSize,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  const updatedCredits = await getShopperCredits(supabase, userId);
  return { success: true, newBalance: updatedCredits.balance };
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
