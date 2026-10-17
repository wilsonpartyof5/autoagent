import { createHmac, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';

import { currentPhotoOrigin } from './context';
import { redactSecrets } from './secrets';

/**
 * MarketCheck-hosted images that require our API key are rewritten to
 * /api/inventory/photo. The route adds the key server-side. Public dealer
 * CDNs and the public MarketCheck image CDN are returned with any key removed.
 *
 * The proxy allowlist is MarketCheck API hosts only. Other hosts are rejected.
 */

const PHOTO_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PHOTO_LINK_MAX_TTL_MS = 8 * 24 * 60 * 60 * 1000;
const MAX_PHOTO_BYTES = 8_000_000;

export const PHOTO_CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400';

const CREDENTIALED_EXACT = new Set([
  'api.marketcheck.com',
  'mc-api.marketcheck.com',
  'marketcheck-prod.apigee.net',
]);

const PUBLIC_CDN = new Set(['images.marketcheck.com']);

const SECRET_PARAMS = new Set([
  'api_key',
  'apikey',
  'api-key',
  'api_secret',
  'access_token',
  'auth_token',
  'authorization',
  'token',
  'secret',
]);

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export type HostLookup = (hostname: string) => Promise<string[]>;

export type PhotoProxyFailure = { ok: false; status: number; code: string; message: string };

export type PhotoProxyResult =
  | { ok: true; body: Uint8Array; contentType: string; cacheControl: string }
  | PhotoProxyFailure;

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, '');
}

export function marketCheckPhotoHostKind(hostname: string): 'credentialed' | 'public' | 'other' {
  const host = normalizeHost(hostname);
  if (PUBLIC_CDN.has(host)) return 'public';
  if (CREDENTIALED_EXACT.has(host)) return 'credentialed';
  if (host === 'marketcheck.com' || host.endsWith('.marketcheck.com')) return 'credentialed';
  return 'other';
}

function signingSecret(): string | null {
  return process.env.MARKETCHECK_API_KEY || process.env.INVENTORY_SEARCH_API_KEY || null;
}

function stripSecretParams(url: URL): void {
  const names = [...url.searchParams.keys()];
  for (const name of names) {
    if (SECRET_PARAMS.has(name.toLowerCase())) url.searchParams.delete(name);
  }
}

export function canonicalPhotoUrl(input: URL): string {
  const url = new URL(input.toString());
  url.protocol = 'https:';
  url.hostname = normalizeHost(url.hostname);
  url.port = '';
  url.hash = '';
  url.username = '';
  url.password = '';
  stripSecretParams(url);
  const entries = [...url.searchParams.entries()].sort(
    (left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]),
  );
  url.search = '';
  for (const [key, value] of entries) url.searchParams.append(key, value);
  return url.toString();
}

function sign(canonical: string, exp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${exp}.${canonical}`).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Client-facing photo URL. Credentialed MarketCheck hosts become a signed
 * proxy URL. The MarketCheck API key is never included.
 */
export function toClientPhotoUrl(raw: string | undefined, now = Date.now()): string | undefined {
  if (!raw) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return undefined;
  if (parsed.port && parsed.port !== '443') return undefined;

  const kind = marketCheckPhotoHostKind(parsed.hostname);
  const canonical = canonicalPhotoUrl(parsed);
  if (kind !== 'credentialed') return canonical;

  const secret = signingSecret();
  if (!secret) return undefined;
  const exp = now + PHOTO_LINK_TTL_MS;
  const signature = sign(canonical, exp, secret);
  const payload = Buffer.from(canonical, 'utf8').toString('base64url');
  const path = `/api/inventory/photo?u=${payload}&e=${exp}&s=${signature}`;
  const origin = currentPhotoOrigin();
  return origin ? `${origin}${path}` : path;
}

function fail(status: number, code: string, message: string): PhotoProxyFailure {
  return { ok: false, status, code, message };
}

function decodePhotoTarget(
  payload: string | null,
  expRaw: string | null,
  sig: string | null,
  now: number,
): { ok: true; url: URL } | PhotoProxyFailure {
  if (!payload || !expRaw || !sig) {
    return fail(400, 'PHOTO_INVALID', 'Photo link is not valid.');
  }
  const secret = signingSecret();
  if (!secret) return fail(503, 'PHOTO_UNAVAILABLE', 'Photo proxy is not configured.');

  const exp = Number(expRaw);
  if (!Number.isSafeInteger(exp) || exp < now || exp > now + PHOTO_LINK_MAX_TTL_MS) {
    return fail(403, 'PHOTO_FORBIDDEN', 'Photo link is not valid.');
  }

  let decoded: string;
  try {
    decoded = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return fail(400, 'PHOTO_INVALID', 'Photo link is not valid.');
  }
  if (!decoded || !safeEqual(sig, sign(decoded, exp, secret))) {
    return fail(403, 'PHOTO_FORBIDDEN', 'Photo link is not valid.');
  }

  let url: URL;
  try {
    url = new URL(decoded);
  } catch {
    return fail(400, 'PHOTO_INVALID', 'Photo link is not valid.');
  }
  if (canonicalPhotoUrl(url) !== decoded) {
    return fail(400, 'PHOTO_INVALID', 'Photo link is not valid.');
  }
  if (marketCheckPhotoHostKind(url.hostname) !== 'credentialed') {
    return fail(403, 'PHOTO_FORBIDDEN', 'Photo host is not allowed.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    return fail(403, 'PHOTO_FORBIDDEN', 'Photo host is not allowed.');
  }
  return { ok: true, url };
}

async function defaultLookup(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '0.0.0.0' || normalized === '::') return true;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const v4 = normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized;
  const parts = v4.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return normalized.includes(':') ? false : true;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function credentialedFetchUrl(url: URL): string {
  const copy = new URL(url.toString());
  const key = process.env.MARKETCHECK_API_KEY;
  if (key && marketCheckPhotoHostKind(copy.hostname) === 'credentialed') {
    copy.searchParams.set('api_key', key);
  }
  return copy.toString();
}

export async function proxyMarketCheckPhoto(input: {
  payload: string | null;
  exp: string | null;
  sig: string | null;
  lookup?: HostLookup;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<PhotoProxyResult> {
  const decoded = decodePhotoTarget(input.payload, input.exp, input.sig, input.now ?? Date.now());
  if (!decoded.ok) return decoded;

  const resolve = input.lookup ?? defaultLookup;
  let addresses: string[];
  try {
    addresses = await resolve(decoded.url.hostname);
  } catch (err) {
    console.error(JSON.stringify({
      event: 'marketcheck_photo_proxy_error',
      host: decoded.url.hostname,
      error: redactSecrets(err instanceof Error ? err.message : String(err)),
    }));
    return fail(502, 'PHOTO_UNAVAILABLE', 'Photo could not be loaded.');
  }
  if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address))) {
    return fail(403, 'PHOTO_FORBIDDEN', 'Photo host is not allowed.');
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = credentialedFetchUrl(decoded.url);
    const res = await fetchImpl(upstream, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' },
    });
    if (res.status >= 300 && res.status < 400) {
      return fail(502, 'PHOTO_UNAVAILABLE', 'Photo could not be loaded.');
    }
    if (!res.ok) return fail(502, 'PHOTO_UNAVAILABLE', 'Photo could not be loaded.');

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!IMAGE_TYPES.has(contentType)) {
      return fail(502, 'PHOTO_UNAVAILABLE', 'Photo could not be loaded.');
    }
    const advertised = Number(res.headers.get('content-length') ?? '0');
    if (Number.isFinite(advertised) && advertised > MAX_PHOTO_BYTES) {
      return fail(413, 'PHOTO_TOO_LARGE', 'Photo is too large.');
    }
    const body = new Uint8Array(await res.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > MAX_PHOTO_BYTES) {
      return fail(413, 'PHOTO_TOO_LARGE', 'Photo is too large.');
    }
    return { ok: true, body, contentType, cacheControl: PHOTO_CACHE_CONTROL };
  } catch (err) {
    console.error(JSON.stringify({
      event: 'marketcheck_photo_proxy_error',
      host: decoded.url.hostname,
      error: redactSecrets(err instanceof Error ? err.message : String(err)),
    }));
    return fail(502, 'PHOTO_UNAVAILABLE', 'Photo could not be loaded.');
  } finally {
    clearTimeout(timer);
  }
}
