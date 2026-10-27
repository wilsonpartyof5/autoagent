/**
 * In-network close fee. The dealer pays $300 when the shopper confirms a purchase.
 * Stripe is not connected; rows stay `due`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const DEALER_CLOSE_FEE_CENTS = 30_000;
export const DEALER_CLOSE_FEE_REASON = 'shopper_confirmed_purchase' as const;

export type CloseFeeStatus = 'due' | 'invoiced' | 'paid' | 'void';

export type DealerCloseFee = {
  dealId: string;
  rooftopId: string | null;
  amountCents: typeof DEALER_CLOSE_FEE_CENTS;
  reason: typeof DEALER_CLOSE_FEE_REASON;
  status: CloseFeeStatus;
  createdAt: string;
};

export function closeFeeForPurchase(input: {
  dealId: string;
  rooftopId: string | null;
  at: string;
}): DealerCloseFee {
  return {
    dealId: input.dealId,
    rooftopId: input.rooftopId,
    amountCents: DEALER_CLOSE_FEE_CENTS,
    reason: DEALER_CLOSE_FEE_REASON,
    status: 'due',
    createdAt: input.at,
  };
}

export async function recordDealerCloseFee(
  supabase: SupabaseClient,
  fee: DealerCloseFee,
): Promise<{ recorded: boolean; alreadyRecorded: boolean }> {
  const { error } = await supabase.from('dealer_close_fees').insert({
    deal_id: fee.dealId,
    rooftop_id: fee.rooftopId,
    amount_cents: fee.amountCents,
    reason: fee.reason,
    status: fee.status,
    created_at: fee.createdAt,
  });
  if (!error) return { recorded: true, alreadyRecorded: false };
  if (error.code === '23505') return { recorded: false, alreadyRecorded: true };
  console.error(JSON.stringify({
    event: 'dealer_close_fee_failed',
    dealId: fee.dealId,
    message: error.message,
  }));
  return { recorded: false, alreadyRecorded: false };
}

export async function rooftopIdForDeal(
  supabase: SupabaseClient,
  dealId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('shopper_dealer_conversations')
    .select('rooftop_id')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (error) {
    console.error(JSON.stringify({
      event: 'close_fee_rooftop_lookup_failed',
      dealId,
      message: error.message,
    }));
    return null;
  }
  return typeof data?.rooftop_id === 'string' ? data.rooftop_id : null;
}
