/**
 * Deal values for a Telnyx TeXML AI courtesy call.
 * Telnyx injects them through AIAssistantDynamicVariables, which fills
 * {{shopper_first_name}}, {{stock_number}}, {{reply_text_number}}, and
 * {{reply_email}} on the ElevenLabs assistant.
 * The number we call from is never the number a dealer is told to text.
 */

import { vinLastEight } from '../admin/outreach/opener';
import { normalizeEmailAddress, voiceNumberLeaks } from './identity';
import { normalizePhone, type AiAssistantDynamicVariables } from './telnyx';

/** Used when the deal has no alias and DREVVY_EMAIL is unset. */
export const DEFAULT_DREVVY_EMAIL = 'dustin@drevvy.com';

/**
 * Telnyx numbers Drevvy places courtesy calls from.
 * +18039878296 is the current caller. +18392748197 may also be used to call.
 * State caller IDs in voice_numbers are checked as well.
 */
export const DREVVY_CALLER_NUMBERS = ['+18039878296', '+18392748197'] as const;

export const COURTESY_CALL_REFUSED = 'courtesy_call_refused';

export type CourtesyIdentity = {
  shopperFirstName?: string | null;
  smsNumberE164?: string | null;
  emailAlias?: string | null;
};

export type CourtesyVariableInput = {
  testMode: boolean;
  identity?: CourtesyIdentity | null;
  shopperFirstName?: string | null;
  profileFirstName?: string | null;
  stock?: string | null;
  vin?: string | null;
  env?: Record<string, string | undefined>;
};

export type CourtesyVariables = {
  shopperFirstName: string;
  stockNumber: string;
  replyTextNumber: string | null;
  replyEmail: string | null;
};

export function stockNumberForCall(stock?: string | null, vin?: string | null): string {
  const cleaned = stock?.trim().replace(/^#/, '').trim() ?? '';
  if (cleaned) return cleaned;
  return vinLastEight(vin);
}

export function readVehicleCallFields(snapshot: unknown): { stock: string | null; vin: string | null } {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { stock: null, vin: null };
  }
  const record = snapshot as Record<string, unknown>;
  const stock = firstString(record.stock, record.stockNumber, record.stock_number, record.stock_no);
  const vin = firstString(record.vin);
  return { stock, vin };
}

/** Test mode text-back number. Never the caller ID. */
export function testReplyTextNumber(env: Record<string, string | undefined>): string | null {
  return normalizePhone(env.DREVVY_TEST_TEXT_NUMBER) ?? normalizePhone(env.DREVVY_TEXT_NUMBER);
}

/**
 * A set DREVVY_EMAIL wins. An empty value uses dustin@drevvy.com.
 * An invalid value stays invalid so the call is refused instead of silently rewritten.
 */
export function configuredReplyEmail(env: Record<string, string | undefined>): string | null {
  const raw = env.DREVVY_EMAIL?.trim() ?? '';
  if (raw) return normalizeEmailAddress(raw);
  return normalizeEmailAddress(DEFAULT_DREVVY_EMAIL);
}

/**
 * Live reads the deal identity. Test mode reads DREVVY_TEST_TEXT_NUMBER or
 * DREVVY_TEXT_NUMBER, and DREVVY_EMAIL, then both paths use the same guard.
 */
export function resolveCourtesyVariables(input: CourtesyVariableInput): CourtesyVariables {
  const env = input.env ?? process.env;
  const identity = input.identity ?? null;
  const shopperFirstName = firstText(
    input.shopperFirstName,
    identity?.shopperFirstName,
    input.profileFirstName,
    input.testMode ? env.SHOPPER_FIRST_NAME : null,
  );
  const stockNumber = stockNumberForCall(input.stock, input.vin);
  if (input.testMode) {
    return {
      shopperFirstName,
      stockNumber,
      replyTextNumber: testReplyTextNumber(env),
      replyEmail: configuredReplyEmail(env),
    };
  }
  return {
    shopperFirstName,
    stockNumber,
    replyTextNumber: normalizePhone(identity?.smsNumberE164),
    replyEmail: normalizeEmailAddress(identity?.emailAlias) ?? configuredReplyEmail(env),
  };
}

export function guardCourtesyCall(input: {
  from: string;
  callerNumbers?: readonly string[];
  variables: CourtesyVariables;
}): { ok: true; variables: AiAssistantDynamicVariables } | { ok: false; error: string } {
  const replyText = normalizePhone(input.variables.replyTextNumber);
  const replyEmail = normalizeEmailAddress(input.variables.replyEmail);
  if (!replyText) return { ok: false, error: 'A courtesy call needs a reply text number.' };
  if (!replyEmail) return { ok: false, error: 'A courtesy call needs a reply email.' };

  const callers = uniquePhones([input.from, ...DREVVY_CALLER_NUMBERS, ...(input.callerNumbers ?? [])]);
  if (callers.includes(replyText)) {
    return { ok: false, error: 'The reply text number cannot be the caller ID.' };
  }

  const spoken = [
    input.variables.shopperFirstName,
    input.variables.stockNumber,
    replyText,
    replyEmail,
  ];
  for (const caller of callers) {
    for (const value of spoken) {
      if (voiceNumberLeaks(value, caller)) {
        return { ok: false, error: 'The voice agent must not give its caller ID out.' };
      }
    }
  }

  return {
    ok: true,
    variables: {
      shopper_first_name: input.variables.shopperFirstName.trim(),
      stock_number: input.variables.stockNumber.trim(),
      reply_text_number: replyText,
      reply_email: replyEmail,
    },
  };
}

function uniquePhones(values: readonly (string | null | undefined)[]): string[] {
  const phones: string[] = [];
  for (const value of values) {
    const phone = normalizePhone(value);
    if (phone && !phones.includes(phone)) phones.push(phone);
  }
  return phones;
}

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
