/**
 * Client IP for anonymous rate limits.
 * On Vercel, x-forwarded-for is set by the platform. The first hop is the client.
 */
export function discoverClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
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
