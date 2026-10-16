import { normalizeEmail, normalizePhone } from '../research/validate';

const CAPTCHA_PATTERNS = [
  /google\.com\/recaptcha\/api2/i,
  /hcaptcha\.com\/captcha/i,
  /challenges\.cloudflare\.com\/turnstile/i,
  /class=["'][^"']*\b(?:g-recaptcha|h-captcha|cf-turnstile)\b/i,
  /i['’]?m not a robot/i,
  /verify you are human/i,
  /complete the captcha/i,
];

export function hasCaptchaChallenge(html: string): boolean {
  if (!html) return false;
  return CAPTCHA_PATTERNS.some((pattern) => pattern.test(html));
}

export function asksForShopperContact(html: string): boolean {
  if (!html) return false;
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const labels = html.match(/<label\b[^>]*>[\s\S]*?<\/label>/gi) ?? [];
  const blob = [...inputs, ...labels].join('\n');
  if (!blob) return false;
  const asksName = /your[\s_-]?name|full[\s_-]?name|first[\s_-]?name|name=["']name["']/i.test(blob);
  const asksPhone = /type=["']tel["']|your[\s_-]?phone|phone[\s_-]?number|\bmobile\b/i.test(blob);
  const asksEmail = /type=["']email["']|your[\s_-]?email|e-mail/i.test(blob);
  return asksName || asksPhone || asksEmail;
}

export function dealerAskedIfBot(text: string): boolean {
  return /\b(are you|is this|am i (talking|speaking|chatting) (to|with))\b[\s\S]{0,48}\b(a\s+|an\s+)?(bot|robot|human|real person|ai|a\.i\.|artificial)\b/i.test(
    text,
  );
}

export function dealerAskedForShopperContact(text: string): boolean {
  const patterns = [
    /\b(your|the (shopper|buyer|customer)'s)\s+(name|phone|number|email|e-mail|contact)\b/i,
    /\b(can|could|may)\s+i\s+(get|have)\s+your\b/i,
    /\bwho am i (speaking|talking) (to|with)\b/i,
    /\b(first|last|full)\s+name\b/i,
    /\bwhat(?:'s| is) your (name|number|phone|email)\b/i,
    /\b(send|give|share) (?:me )?(?:your )?(?:contact|number|phone|email|name)\b/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

export type FieldAttrs = {
  type?: string | null;
  name?: string | null;
  id?: string | null;
  placeholder?: string | null;
  ariaLabel?: string | null;
};

export function isContactField(attrs: FieldAttrs): boolean {
  const blob = [attrs.type, attrs.name, attrs.id, attrs.placeholder, attrs.ariaLabel]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  if (!blob) return false;
  return (
    /\b(email|e-mail|tel|phone|mobile)\b/i.test(blob) ||
    /\b(your name|full name|first name|last name)\b/i.test(blob)
  );
}

export function isForbiddenContactSelector(selector: string): boolean {
  return (
    /type\s*[~|^$*]?=\s*["']?(email|tel)\b/i.test(selector) ||
    /your[\s_-]?(name|phone|email)|full[\s_-]?name|first[\s_-]?name|last[\s_-]?name|phone[\s_-]?number/i.test(
      selector,
    ) ||
    /\bname\s*[~|^$*]?=\s*["']?(your[_-]?name|name|full[_-]?name|phone|email|tel|mobile)\b/i.test(selector) ||
    /#(email|phone|tel|mobile|fullname|full-name|firstname|first-name)\b/i.test(selector)
  );
}

export function sharesDisallowedContact(
  message: string,
  allowed: { drevvyTextNumber: string; drevvyEmail: string },
): boolean {
  const allowedEmail = normalizeEmail(allowed.drevvyEmail);
  const allowedPhone = normalizePhone(allowed.drevvyTextNumber);
  const emails = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const email of emails) {
    if (!allowedEmail || normalizeEmail(email) !== allowedEmail) return true;
  }
  const withoutStock = message.replace(/stock\s*#\s*[A-Z0-9-]+/gi, ' ');
  const phones = withoutStock.match(/\+?\d[\d\s().-]{8,}\d/g) ?? [];
  for (const phone of phones) {
    const normalized = normalizePhone(phone);
    if (!normalized) continue;
    if (!allowedPhone || normalized !== allowedPhone) return true;
  }
  return /\blast\s+name\b/i.test(message);
}
