const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let national = digits;
  if (digits.length === 11 && digits.startsWith('1')) national = digits.slice(1);
  if (national.length !== 10) return null;
  if (national[0] === '0' || national[0] === '1') return null;
  if (national[3] === '0' || national[3] === '1') return null;
  return `+1${national}`;
}

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function phoneAppearsInHtml(e164: string, html: string): boolean {
  const digits = e164.replace(/\D/g, '');
  const national = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  if (national.length !== 10) return false;
  return html.replace(/\D/g, '').includes(national);
}

export function emailAppearsInHtml(email: string, html: string): boolean {
  return html.toLowerCase().includes(email.toLowerCase());
}

export function groundPhones(candidates: string[], html: string): string[] {
  const grounded: string[] = [];
  for (const candidate of candidates) {
    const phone = normalizePhone(candidate);
    if (!phone || !phoneAppearsInHtml(phone, html) || grounded.includes(phone)) continue;
    grounded.push(phone);
    if (grounded.length >= 10) break;
  }
  return grounded;
}

export function groundEmails(candidates: string[], html: string): string[] {
  const grounded: string[] = [];
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate);
    if (!email || !emailAppearsInHtml(email, html) || grounded.includes(email)) continue;
    grounded.push(email);
    if (grounded.length >= 10) break;
  }
  return grounded;
}

export function groundName(name: string | null, html: string): string | null {
  if (!name) return null;
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 120) return null;
  if (/https?:|@|\d{3}/.test(trimmed)) return null;
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();
  if (!visible.includes(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function normalizePrice(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/\$?\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\$\s?\d{2,6}(?:\.\d{2})?/);
  if (!match) return null;
  const digits = match[0].replace(/[^\d.]/g, '');
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount < 100 || amount > 500_000) return null;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}`;
}

export function roundConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}
