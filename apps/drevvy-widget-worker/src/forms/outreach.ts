export const DEFAULT_LEAD_LAST_NAME = 'via Drevvy';

export type OutreachIdentity = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zip: string | null;
};

export type OutreachFieldKind = 'first_name' | 'last_name' | 'full_name' | 'phone' | 'email' | 'zip' | 'message';

export type OutreachFill = {
  kind: OutreachFieldKind;
  name: string | null;
  id: string | null;
  value: string;
};

export type OutreachRunConfig = {
  dryRun: boolean;
  allowlist: string[];
  drevvyTextNumber: string;
  drevvyEmail: string;
  shopperFirst: string;
  leadLastName?: string;
  leadZip?: string | null;
};

export function buildIdentity(input: {
  firstName: string;
  lastName?: string | null;
  phone: string;
  email: string;
  zip?: string | null;
}): OutreachIdentity {
  return {
    firstName: input.firstName,
    lastName: assertLeadLastName(input.lastName?.trim() || DEFAULT_LEAD_LAST_NAME),
    phone: input.phone,
    email: input.email,
    zip: normalizeZip(input.zip),
  };
}

export function assertLeadLastName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40 || /[@\d]/.test(trimmed)) {
    throw new Error('LEAD_LAST_NAME must be a short label such as "via Drevvy", with no phone number or email.');
  }
  return trimmed;
}

export function normalizeZip(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{5}(?:-\d{4})?$/.test(trimmed)) return null;
  return trimmed;
}

export function leadMessage(input: { stockNumber: string | null; phone: string; email: string }): string {
  const stock = input.stockNumber?.trim();
  const stockPart = stock ? ` Stock #${stock}.` : '';
  return `Is this unit still available?${stockPart} What's the price on it? Please text or email us at ${input.phone} / ${input.email}.`;
}

export function outreachValue(
  kind: OutreachFieldKind,
  identity: OutreachIdentity,
  stockNumber: string | null,
  channel: 'lead_form' | 'prechat',
): string | null {
  if (kind === 'first_name') return identity.firstName;
  if (kind === 'last_name') return identity.lastName;
  if (kind === 'full_name') {
    return channel === 'prechat' ? identity.firstName : `${identity.firstName} ${identity.lastName}`;
  }
  if (kind === 'phone') return identity.phone;
  if (kind === 'email') return identity.email;
  if (kind === 'zip') return identity.zip;
  return leadMessage({ stockNumber, phone: identity.phone, email: identity.email });
}

export function isApprovedFill(
  fill: OutreachFill,
  identity: OutreachIdentity,
  stockNumber: string | null,
  channel: 'lead_form' | 'prechat',
): boolean {
  if (isPrivateFieldHint(`${fill.name ?? ''} ${fill.id ?? ''}`)) return false;
  const expected = outreachValue(fill.kind, identity, stockNumber, channel);
  return expected != null && fill.value === expected;
}

export function isPrivateFieldHint(value: string): boolean {
  return /ssn|social security|\bdob\b|date of birth|birth ?date|birthday|driver'?s? licen[cs]e|street address|mailing address|home address|address line|\bstreet\b|\bapt\b|apartment|\bcity\b|trade[-_ ]?(?:in|payoff|allowance|vin)|\bpayoff\b|\blien\b|\bincome\b|\bemployer\b|\bsalary\b/i.test(
    value,
  );
}

export function isBotBlockedPage(html: string): boolean {
  if (/\bsokal\b/i.test(html)) return true;
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/access restricted/i.test(text)) return true;
  if (/automated access to this (?:page|site|website)/i.test(text)) return true;
  if (/you have been blocked/i.test(text)) return true;
  if (/access denied/i.test(text) && text.length < 800) return true;
  if (/\b(datadome|perimeterx)\b/i.test(text) && text.length < 500) return true;
  return false;
}
