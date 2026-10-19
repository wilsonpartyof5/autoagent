import { normalizePhone } from '../brain/telnyx';

/**
 * Drevvy's Telnyx number for a dealer form that requires a phone.
 * Outbound texts stay off until 10DLC is approved. Inbound calls and texts
 * to this number are logged on the deal that disclosed it.
 */

export type ContactPhoneDisclosure = {
  dealId: string;
  dealerId: string | null;
  dealerPhone: string | null;
  disclosedAt: string;
};

export type ContactPhoneMatch = {
  to: string | null;
  from: string | null;
  direction: 'inbound' | 'outbound' | null;
  eventType: string;
  channel: 'call' | 'sms' | 'email' | 'voicemail' | null;
};

export function tenDlcApproved(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.TELNYX_10DLC_APPROVED ?? env.DREVVY_10DLC_APPROVED;
  return value === 'true' || value === '1';
}

export function outboundSmsHoldReason(
  input: { testMode?: boolean; tenDlcApproved?: boolean } = {},
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (input.testMode === true) return null;
  const approved = input.tenDlcApproved ?? tenDlcApproved(env);
  if (approved) return null;
  return 'Outbound texts stay off until 10DLC is approved.';
}

export function contactPhoneE164(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return normalizePhone(env.DREVVY_CONTACT_PHONE);
}

export function inboundHitsContactPhone(
  input: ContactPhoneMatch,
  contactPhone: string | null,
): boolean {
  const ours = normalizePhone(contactPhone);
  const to = normalizePhone(input.to);
  if (!ours || !to || ours !== to) return false;
  if (input.direction === 'outbound') return false;
  if (input.direction === 'inbound') return true;
  return input.eventType === 'message.received' || input.eventType.startsWith('call.');
}

/**
 * Attach an inbound call or text to the deal that gave the dealer this number.
 * A known dealer phone wins. One open disclosure is enough when the caller
 * is new. Several deals never share one inbound at random.
 */
export function matchContactPhoneDisclosure(
  from: string | null,
  disclosures: ContactPhoneDisclosure[],
): { dealId: string; dealerId: string | null } | null {
  if (disclosures.length === 0) return null;
  const caller = normalizePhone(from);
  if (caller) {
    const byDealer = disclosures.filter((row) => normalizePhone(row.dealerPhone) === caller);
    const hit = latest(byDealer);
    if (hit) return { dealId: hit.dealId, dealerId: hit.dealerId };
  }
  if (disclosures.length === 1) {
    const only = disclosures[0];
    if (!only) return null;
    return { dealId: only.dealId, dealerId: only.dealerId };
  }
  return null;
}

function latest(rows: ContactPhoneDisclosure[]): ContactPhoneDisclosure | null {
  if (rows.length === 0) return null;
  return [...rows].sort((left, right) => right.disclosedAt.localeCompare(left.disclosedAt))[0] ?? null;
}
