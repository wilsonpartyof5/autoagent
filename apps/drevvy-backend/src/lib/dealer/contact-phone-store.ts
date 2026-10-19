import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizePhone } from '../brain/telnyx';
import {
  contactPhoneE164,
  inboundHitsContactPhone,
  matchContactPhoneDisclosure,
  type ContactPhoneDisclosure,
  type ContactPhoneMatch,
} from './contact-phone';

export async function saveContactPhoneDisclosure(
  supabase: SupabaseClient,
  input: {
    dealId: string;
    dealerId?: string | null;
    contactPhone: string;
    dealerPhone?: string | null;
    vehiclePageUrl?: string | null;
  },
): Promise<void> {
  const phone = normalizePhone(input.contactPhone);
  if (!phone) return;
  const { error } = await supabase.from('contact_phone_disclosures').insert({
    deal_id: input.dealId,
    dealer_id: input.dealerId ?? null,
    contact_phone_e164: phone,
    dealer_phone_e164: normalizePhone(input.dealerPhone),
    vehicle_page_url: input.vehiclePageUrl ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function findDealForContactPhone(
  supabase: SupabaseClient,
  input: ContactPhoneMatch,
  env: Record<string, string | undefined> = process.env,
): Promise<{ dealId: string; dealerId: string | null } | null> {
  const contactPhone = contactPhoneE164(env);
  if (!inboundHitsContactPhone(input, contactPhone) || !contactPhone) return null;
  try {
    const { data, error } = await supabase
      .from('contact_phone_disclosures')
      .select('deal_id, dealer_id, dealer_phone_e164, created_at')
      .eq('contact_phone_e164', contactPhone)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !data) return null;
    const disclosures: ContactPhoneDisclosure[] = data.flatMap((row) => {
      if (!row.deal_id) return [];
      return [{
        dealId: row.deal_id,
        dealerId: row.dealer_id ?? null,
        dealerPhone: row.dealer_phone_e164 ?? null,
        disclosedAt: row.created_at ?? '',
      }];
    });
    return matchContactPhoneDisclosure(input.from, disclosures);
  } catch {
    return null;
  }
}
