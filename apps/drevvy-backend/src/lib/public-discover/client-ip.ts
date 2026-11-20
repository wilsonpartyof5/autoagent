function firstHop(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  return first ? first.slice(0, 64) : null;
}

/**
 * Client IP for anonymous rate limits.
 * Vercel overwrites x-forwarded-for and sets x-vercel-forwarded-for to the
 * connecting client. Prefer that platform header so a front proxy which
 * rewrites x-forwarded-for cannot mint a fresh per-IP bucket.
 */
export function discoverClientIp(headers: Headers): string {
  const platform = firstHop(headers.get('x-vercel-forwarded-for'));
  if (platform) return platform;
  const forwarded = firstHop(headers.get('x-forwarded-for'));
  if (forwarded) return forwarded;
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 64);
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf.slice(0, 64);
  return 'unknown';
}

export function hashIpForLogs(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i += 1) hash = (hash * 31 + ip.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(16).padStart(8, '0');
}
