import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';

import type { TrimCheck } from './trim-check';

export type StoredTrimCheck = TrimCheck & {
  dealId: string;
  checkedAt: string;
};

export async function saveTrimCheck(
  supabase: SupabaseClient,
  input: { dealId: string; check: TrimCheck; checkedAt?: string },
): Promise<void> {
  const { error } = await supabase.from('deal_trim_checks').upsert({
    deal_id: input.dealId,
    marketcheck_trim: input.check.marketcheckTrim,
    vdp_trim: input.check.vdpTrim,
    vin_decode_trim: input.check.vinDecodeTrim,
    verified_trim: input.check.verifiedTrim,
    mismatch: input.check.mismatch,
    shopper_message: input.check.shopperMessage,
    checked_at: input.checkedAt ?? new Date().toISOString(),
  }, { onConflict: 'deal_id' });
  if (error) throw new Error(error.message);
}

export async function readShopperTrimNotice(dealId: string, supabase?: SupabaseClient): Promise<string | null> {
  try {
    const client = supabase ?? createAdminClient();
    const { data, error } = await client
      .from('deal_trim_checks')
      .select('mismatch, shopper_message')
      .eq('deal_id', dealId)
      .maybeSingle();
    if (error || !data?.mismatch) return null;
    return typeof data.shopper_message === 'string' && data.shopper_message.trim()
      ? data.shopper_message
      : null;
  } catch {
    return null;
  }
}
