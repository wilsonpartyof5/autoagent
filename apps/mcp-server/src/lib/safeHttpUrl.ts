import { isIP } from 'net';

function isPrivateIpv4(hostname: string): boolean {
  if (!isIP(hostname) || hostname.includes(':')) return false;
  if (hostname === '127.0.0.1') return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('169.254.')) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    host === '0.0.0.0'
  ) {
    return true;
  }
  return isPrivateIpv4(host);
}

/**
 * CRM / webhook endpoints must be public HTTPS. Blocks private IPs and cleartext.
 */
export function assertSafeHttpsUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'URL must use HTTPS' };
  }

  if (isPrivateHost(url.hostname)) {
    return { ok: false, error: 'URL host is not allowed' };
  }

  return { ok: true, url };
}

export function stripSensitiveQueryParams(raw: string): string {
  try {
    const url = new URL(raw);
    url.searchParams.delete('api_key');
    url.searchParams.delete('apikey');
    url.searchParams.delete('token');
    url.searchParams.delete('access_token');
    return url.toString();
  } catch {
    return raw;
  }
}
