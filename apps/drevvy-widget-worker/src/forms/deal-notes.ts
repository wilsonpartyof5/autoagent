import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizePhone } from '../research/validate';
import type { TrimCheck } from './trim';

export async function saveTrimFlag(
  client: SupabaseClient,
  input: { dealId: string | null; check: TrimCheck },
): Promise<void> {
  if (!input.dealId || !input.check.mismatch) return;
  const { error } = await client.from('deal_trim_checks').upsert({
    deal_id: input.dealId,
    marketcheck_trim: input.check.marketcheckTrim,
    vdp_trim: input.check.vdpTrim,
    vin_decode_trim: input.check.vinDecodeTrim,
    verified_trim: input.check.verifiedTrim,
    mismatch: true,
    shopper_message: input.check.shopperMessage,
    checked_at: new Date().toISOString(),
  }, { onConflict: 'deal_id' });
  if (error) throw new Error(error.message);
}

export async function saveContactDisclosure(
  client: SupabaseClient,
  input: { dealId: string; phone: string; dealerId?: string | null },
): Promise<void> {
  const phone = normalizePhone(input.phone);
  if (!phone) return;
  const { error } = await client.from('contact_phone_disclosures').insert({
    deal_id: input.dealId,
    dealer_id: input.dealerId ?? null,
    contact_phone_e164: phone,
  });
  if (error) throw new Error(error.message);
}
