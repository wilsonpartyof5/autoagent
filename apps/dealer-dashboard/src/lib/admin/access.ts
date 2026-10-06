/**
 * Owner allowlist for the shopper admin console.
 * Set ADMIN_EMAILS to a comma-separated list of sign-in emails.
 * Do not hardcode an address in source. Leave the variable empty to hide /admin.
 * ADMIN_PREVIEW=1 renders mock pages without a session only when NODE_ENV is not production.
 */

export function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isAllowlistedAdmin(
  email: string | null | undefined,
  raw: string | undefined | null = process.env.ADMIN_EMAILS,
): boolean {
  if (!email) return false;
  return parseAdminEmails(raw).includes(email.trim().toLowerCase());
}

export function adminPreviewEnabled(
  env: { NODE_ENV?: string; ADMIN_PREVIEW?: string } = process.env,
): boolean {
  return env.NODE_ENV !== 'production' && env.ADMIN_PREVIEW === '1';
}

export function safeAdminNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/admin')) return null;
  if (raw.startsWith('//') || raw.includes('://') || raw.includes('\\') || raw.includes('?') || raw.includes('#')) {
    return null;
  }
  return raw;
}
