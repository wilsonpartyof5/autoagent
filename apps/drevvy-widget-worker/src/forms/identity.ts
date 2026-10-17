import type { SupabaseClient } from '@supabase/supabase-js';

export type ConversationContact = {
  shopperFirst: string;
  emailAlias: string;
  smsNumber: string;
};

export function preferConversationContact(input: {
  contact: ConversationContact | null;
  testMode: boolean;
  env: { shopperFirst: string | null; email: string | null; textNumber: string | null };
}): { shopperFirst: string; email: string; textNumber: string } | { error: string } {
  if (input.contact) {
    return {
      shopperFirst: input.contact.shopperFirst,
      email: input.contact.emailAlias,
      textNumber: presentPhone(input.contact.smsNumber),
    };
  }
  if (!input.testMode) {
    return { error: 'A conversation identity is required. Pass --deal and --dealer.' };
  }
  if (!input.env.shopperFirst || !input.env.email || !input.env.textNumber) {
    return { error: 'Test mode needs SHOPPER_FIRST_NAME, DREVVY_EMAIL, and DREVVY_TEXT_NUMBER.' };
  }
  return {
    shopperFirst: input.env.shopperFirst,
    email: input.env.email,
    textNumber: input.env.textNumber.trim(),
  };
}

export async function loadConversationContact(
  client: SupabaseClient,
  dealId: string,
  dealerId: string,
): Promise<ConversationContact | null> {
  const { data, error } = await client
    .from('conversation_identities')
    .select('shopper_first_name, email_alias, sms_number_e164')
    .eq('deal_id', dealId)
    .eq('dealer_id', dealerId)
    .maybeSingle();
  if (error || !data?.shopper_first_name || !data.email_alias || !data.sms_number_e164) return null;
  return {
    shopperFirst: data.shopper_first_name,
    emailAlias: data.email_alias,
    smsNumber: data.sms_number_e164,
  };
}

function presentPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) return value.trim();
  return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}
