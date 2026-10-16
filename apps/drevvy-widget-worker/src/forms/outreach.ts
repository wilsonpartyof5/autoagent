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

export type LeadContactMode = 'full' | 'name_and_phone';

export type OutreachRunConfig = {
  dryRun: boolean;
  allowlist: string[];
  drevvyTextNumber: string;
  drevvyEmail: string;
  shopperFirst: string;
  leadLastName?: string;
  leadZip?: string | null;
  contactMode?: LeadContactMode;
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

export function leadMessage(input: { stockNumber: string | null; phone: string; email?: string | null }): string {
  const stock = input.stockNumber?.trim();
  const stockPart = stock ? ` Stock #${stock}.` : '';
  const reach = input.email
    ? `Please text or email us at ${input.phone} / ${input.email}.`
    : `Please text us at ${input.phone}.`;
  return `Is this unit still available?${stockPart} What's the price on it? ${reach}`;
}

export function outreachValue(
  kind: OutreachFieldKind,
  identity: OutreachIdentity,
  stockNumber: string | null,
  channel: 'lead_form' | 'prechat',
  mode: LeadContactMode = 'full',
): string | null {
  if (kind === 'first_name') return identity.firstName;
  if (kind === 'last_name') return mode === 'name_and_phone' ? null : identity.lastName;
  if (kind === 'full_name') {
    return channel === 'prechat' || mode === 'name_and_phone' ? identity.firstName : `${identity.firstName} ${identity.lastName}`;
  }
  if (kind === 'phone') return identity.phone;
  if (kind === 'email') return mode === 'name_and_phone' ? null : identity.email;
  if (kind === 'zip') return mode === 'name_and_phone' ? null : identity.zip;
  return leadMessage({
    stockNumber,
    phone: identity.phone,
    email: mode === 'name_and_phone' ? null : identity.email,
  });
}

export function isApprovedFill(
  fill: OutreachFill,
  identity: OutreachIdentity,
  stockNumber: string | null,
  channel: 'lead_form' | 'prechat',
  mode: LeadContactMode = 'full',
): boolean {
  if (isPrivateFieldHint(`${fill.name ?? ''} ${fill.id ?? ''}`)) return false;
  const expected = outreachValue(fill.kind, identity, stockNumber, channel, mode);
  return expected != null && fill.value === expected;
}

export function isPrivateFieldHint(value: string): boolean {
  return /ssn|social security|\bdob\b|date of birth|birth ?date|birthday|driver'?s? licen[cs]e|street address|mailing address|home address|address line|\bstreet\b|\bapt\b|apartment|\bcity\b|trade[-_ ]?(?:in|payoff|allowance|vin)|\bpayoff\b|\blien\b|\bincome\b|\bemployer\b|\bsalary\b/i.test(
    value,
  );
}

export const BLOCK_WALLS = ['sokal', 'cloudflare', 'akamai', 'perimeterx', 'datadome', 'http-403', 'http-429'] as const;

export type BlockWall = (typeof BLOCK_WALLS)[number];

export function isBotBlockedPage(html: string, statusCode?: number | null): boolean {
  return blockWallSignature(html, statusCode) != null;
}

export function blockWallSignature(html: string, statusCode?: number | null): BlockWall | null {
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const text = markup
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/<title>[^<]*just a moment/i.test(html) || /attention required!\s*\|\s*cloudflare/i.test(html)) return 'cloudflare';
  if (/checking your browser before accessing|cf-browser-verification|cdn-cgi\/challenge-platform|cf-error-details/i.test(markup)) {
    return 'cloudflare';
  }
  if (/\bcloudflare\b/i.test(text) && /just a moment|attention required|ray id|you have been blocked/i.test(text)) return 'cloudflare';
  if (/\bsokal\b/i.test(text)) return 'sokal';
  if (/access denied|you don't have permission to access/i.test(text) && /reference\s*#\s*\d/i.test(text)) return 'akamai';
  if (/akamaighost|errors\.edgesuite\.net/i.test(markup) && /access denied|forbidden|reference\s*#/i.test(text)) return 'akamai';
  if (/px-captcha|\bperimeterx\b|px-cdn\.net|px-cloud\.net/i.test(markup)) return 'perimeterx';
  if (/captcha-delivery\.com/i.test(markup)) return 'datadome';
  if (/\bdatadome\b/i.test(text) && text.length < 500 && /blocked|captcha|access denied|forbidden/i.test(text)) return 'datadome';
  if ((statusCode === 403 || statusCode === 429) && /access denied|forbidden|you have been blocked|too many requests|request blocked/i.test(text)) {
    return statusCode === 403 ? 'http-403' : 'http-429';
  }
  return null;
}
