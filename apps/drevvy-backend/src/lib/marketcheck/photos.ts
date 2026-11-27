import { createHmac, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';

import { discoverClientIp } from '../public-discover/client-ip';
import { DiscoverApiError } from '../public-discover/errors';
import { enforcePhotoRateLimit, type RateLimitStore } from '../public-discover/rate-limit';

import { currentPhotoOrigin } from './context';
import { redactSecrets } from './secrets';

/**
 * MarketCheck-hosted images that require our API key are rewritten to
 * /api/inventory/photo. The route adds the key server-side. Public dealer
 * CDNs and the public MarketCheck image CDN are returned with any key removed.
 *
 * The proxy allowlist is MarketCheck API hosts only. Other hosts are rejected.
 */

export const PHOTO_LINK_TTL_MS = 24 * 60 * 60 * 1000;
const PHOTO_LINK_MAX_TTL_MS = PHOTO_LINK_TTL_MS;
const PHOTO_QUERY_KEYS = new Set(['u', 'e', 's']);
const MAX_PHOTO_BYTES = 8_000_000;

export const PHOTO_CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400';

const CREDENTIALED_EXACT = new Set([
  'api.marketcheck.com',
  'mc-api.marketcheck.com',
  'marketcheck-prod.apigee.net',
]);

const PUBLIC_CDN = new Set(['images.marketcheck.com']);

/**
 * Presentation query names a shopper photo URL may keep.
 * `u`, `e`, and `s` are the signed proxy link, not a MarketCheck secret.
 * Cache-busters live in BENIGN_QUERY_NAMES and are kept intact.
 */
export const PHOTO_QUERY_ALLOWLIST = new Set([
  'w',
  'h',
  'width',
  'height',
  'fit',
  'crop',
  'quality',
  'q',
  'format',
  'auto',
  'dpr',
  'u',
  'e',
  's',
]);

/**
 * Version and cache-buster names. DealerSync vehicle photos use `_` (a content
 * hash) plus sometimes `width`. These stay on the URL. They are not signatures.
 */
const BENIGN_QUERY_NAMES = new Set(['v', 'ver', 'version', 'ts', 't', 'cb', '_']);

const QUERY_NAME_RE = /^[a-z0-9_-]{1,32}$/;
const IMAGE_PATH_RE = /\.(?:jpe?g|png|gif|webp|avif)$/i;
const MAX_LOGGED_QUERY_NAMES = 5;

/** Case-insensitive. Matches the path as well as the query. */
const SECRET_URL_PATTERN = /key|token|secret|auth/i;

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

export function photoUrlCarriesSecret(value: string): boolean {
  return SECRET_URL_PATTERN.test(value);
}

function queryNameKept(name: string): boolean {
  const lower = name.toLowerCase();
  return PHOTO_QUERY_ALLOWLIST.has(lower) || BENIGN_QUERY_NAMES.has(lower);
}

export function photoQueryAllowed(names: Iterable<string>): boolean {
  for (const name of names) {
    if (!queryNameKept(name)) return false;
  }
  return true;
}

/** Signed or credential query names. Logged as secret_like, never the raw name. */
export function isSecretLikeQueryName(name: string): boolean {
  const n = name.toLowerCase();
  if (photoUrlCarriesSecret(n)) return true;
  if (n === 'sig' || n.includes('signature')) return true;
  if (n.includes('expires') || n.includes('expiry') || n.includes('expiration')) return true;
  if (n.includes('policy')) return true;
  if (n.includes('credential')) return true;
  if (n.startsWith('x-amz-') || n.startsWith('x-goog-')) return true;
  return false;
}

/** A name safe to log: secret_like, or a short lowercase token. Never a value. */
export function loggableQueryName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower === 'secret_like' || isSecretLikeQueryName(lower)) return 'secret_like';
  if (QUERY_NAME_RE.test(lower)) return lower;
  return null;
}

export function capQueryNames(names: Iterable<string>): string[] {
  const unique = [...new Set(
    [...names].map((name) => loggableQueryName(name)).filter((name): name is string => !!name),
  )];
  unique.sort((a, b) => {
    if (a === 'secret_like' && b !== 'secret_like') return -1;
    if (b === 'secret_like' && a !== 'secret_like') return 1;
    return a.localeCompare(b);
  });
  return unique.slice(0, MAX_LOGGED_QUERY_NAMES);
}

function isImagePath(pathname: string): boolean {
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  return IMAGE_PATH_RE.test(segment);
}

function isPhotoProxyPath(pathname: string): boolean {
  return pathname === '/api/inventory/photo' || pathname.endsWith('/api/inventory/photo');
}

/**
 * Secret-like params drop the whole URL. An unknown non-secret name is stripped
 * when the path is an image file, and drops the URL otherwise. Benign cache
 * names are not a drop.
 */
function dealerQueryDrop(url: URL, raw: string): { drop: boolean; names: string[] } {
  const logged: string[] = [];
  let secret = false;
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const name of url.searchParams.keys()) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (isSecretLikeQueryName(name)) {
      secret = true;
      logged.push(name);
      continue;
    }
    if (!isPhotoProxyPath(url.pathname)) {
      for (const value of url.searchParams.getAll(name)) {
        if (photoUrlCarriesSecret(value)) {
          secret = true;
          logged.push('secret_like');
        }
      }
    }
    if (!queryNameKept(name)) unknown.push(name);
  }
  if (!isPhotoProxyPath(url.pathname) && raw.includes(';') && photoUrlCarriesSecret(raw)) {
    secret = true;
    logged.push('secret_like');
  }
  if (secret) return { drop: true, names: capQueryNames(logged) };
  if (unknown.length === 0) return { drop: false, names: [] };
  if (isImagePath(url.pathname)) return { drop: false, names: [] };
  return { drop: true, names: capQueryNames(unknown) };
}

/**
 * True when a shopper must not see this URL. Secret-like query names and
 * values drop it, including a semicolon param the parser does not split.
 * A path that contains key, token, secret, or auth drops it too.
 */
export function clientPhotoUrlDropped(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw, 'https://photos.invalid');
  } catch {
    return photoUrlCarriesSecret(raw);
  }
  if (photoUrlCarriesSecret(url.pathname) || photoUrlCarriesSecret(url.hash)) return true;
  return dealerQueryDrop(url, raw).drop;
}

function dropDisallowedParams(url: URL): void {
  for (const name of [...url.searchParams.keys()]) {
    if (!queryNameKept(name)) url.searchParams.delete(name);
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
  dropDisallowedParams(url);
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

export type PhotoDropReason = 'scheme' | 'host' | 'query' | 'other';

const COMING_SOON_SEGMENT = /^coming[-_]?soon$/i;

/**
 * DealerSync placeholders are a comingsoon file, or an image whose last
 * directory is comingsoon / coming-soon / coming_soon.
 */
export function isComingSoonPlaceholder(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const file = segments.pop() ?? '';
  const base = file.replace(/\.[a-z0-9]{2,5}$/i, '');
  if (COMING_SOON_SEGMENT.test(base)) return true;
  const dir = segments.pop() ?? '';
  return COMING_SOON_SEGMENT.test(dir);
}

/** Path of a canonical photo URL. Null when the string is not a URL. */
export function photoPathname(canonical: string): string | null {
  try {
    return new URL(canonical).pathname;
  } catch {
    return null;
  }
}

/**
 * Same accept/reject decision as toClientPhotoUrl. reason is null when url is set.
 * Counts only: callers must not log the raw string.
 */
export function inspectClientPhoto(
  raw: string | undefined,
  now = Date.now(),
): { url?: string; reason: PhotoDropReason | null; queryNames: string[] } {
  if (!raw || !raw.trim()) return { reason: 'other', queryNames: [] };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { reason: 'scheme', queryNames: [] };
  }
  if (parsed.username || parsed.password) return { reason: 'host', queryNames: [] };
  const http = parsed.protocol === 'http:';
  if (parsed.protocol !== 'https:' && !http) return { reason: 'scheme', queryNames: [] };
  if (parsed.port && parsed.port !== '443' && !(http && parsed.port === '80')) return { reason: 'host', queryNames: [] };
  if (!parsed.hostname) return { reason: 'host', queryNames: [] };
  // Dealer feeds still publish http photo_links. Upgrade first, then apply the
  // same host and query rules. A host is not probed for TLS.
  if (http) {
    parsed.protocol = 'https:';
    parsed.port = '';
  }

  const kind = marketCheckPhotoHostKind(parsed.hostname);
  const query = dealerQueryDrop(parsed, raw);
  const canonical = canonicalPhotoUrl(parsed);
  if (photoUrlCarriesSecret(canonical)) return { reason: 'other', queryNames: [] };
  if (kind !== 'credentialed' && query.drop) {
    return { reason: 'query', queryNames: query.names };
  }
  const pathname = photoPathname(canonical);
  if (!pathname) return { reason: 'other', queryNames: [] };
  if (isComingSoonPlaceholder(pathname)) return { reason: 'other', queryNames: [] };
  if (kind !== 'credentialed') return { url: canonical, reason: null, queryNames: [] };

  const secret = signingSecret();
  if (!secret) return { reason: 'other', queryNames: [] };
  const exp = now + PHOTO_LINK_TTL_MS;
  const signature = sign(canonical, exp, secret);
  const payload = Buffer.from(canonical, 'utf8').toString('base64url');
  const path = `/api/inventory/photo?u=${payload}&e=${exp}&s=${signature}`;
  const origin = currentPhotoOrigin();
  return { url: origin ? `${origin}${path}` : path, reason: null, queryNames: [] };
}

/**
 * Client-facing photo URL. Credentialed MarketCheck hosts become a signed
 * proxy URL. The MarketCheck API key is never included.
 */
export function toClientPhotoUrl(raw: string | undefined, now = Date.now()): string | undefined {
  return inspectClientPhoto(raw, now).url;
}

function fail(status: number, code: string, message: string): PhotoProxyFailure {
  return { ok: false, status, code, message };
}

/** Exactly one u, one e, and one s. Extra or repeated keys are cache-busters. */
export function photoQueryKeysAllowed(keys: Iterable<string>): boolean {
  const seen = new Set<string>();
  for (const key of keys) {
    if (!PHOTO_QUERY_KEYS.has(key) || seen.has(key)) return false;
    seen.add(key);
  }
  return seen.size === PHOTO_QUERY_KEYS.size;
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
  queryKeys?: Iterable<string>;
  lookup?: HostLookup;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<PhotoProxyResult> {
  if (input.queryKeys && !photoQueryKeysAllowed(input.queryKeys)) {
    return fail(400, 'PHOTO_INVALID', 'Photo link is not valid.');
  }
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

export type PhotoHandlerDeps = {
  nowMs?: number;
  rateLimitStore?: RateLimitStore;
  rateLimitEnv?: NodeJS.ProcessEnv;
  lookup?: HostLookup;
  fetchImpl?: typeof fetch;
};

function photoErrorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, string>,
): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  return new Response(JSON.stringify({ success: false, error: { code, message } }), { status, headers });
}

/**
 * GET /api/inventory/photo. Rate limit runs before any upstream fetch.
 * Only the signed u, e, and s query keys are accepted.
 */
export async function handleInventoryPhoto(request: Request, deps: PhotoHandlerDeps = {}): Promise<Response> {
  const url = new URL(request.url);
  let rateHeaders: Record<string, string> | undefined;
  try {
    const limited = await enforcePhotoRateLimit({
      ip: discoverClientIp(request.headers),
      nowMs: deps.nowMs,
      store: deps.rateLimitStore,
      env: deps.rateLimitEnv,
    });
    rateHeaders = limited.headers;
  } catch (error) {
    if (error instanceof DiscoverApiError) {
      return photoErrorResponse(error.status, error.code, error.message, error.extraHeaders);
    }
    return photoErrorResponse(503, 'RATE_LIMIT_UNAVAILABLE', 'Photos are temporarily unavailable. Please try again later.');
  }

  const queryKeys = [...url.searchParams.keys()];
  const result = await proxyMarketCheckPhoto({
    payload: url.searchParams.get('u'),
    exp: url.searchParams.get('e'),
    sig: url.searchParams.get('s'),
    queryKeys,
    lookup: deps.lookup,
    fetchImpl: deps.fetchImpl,
    now: deps.nowMs,
  });
  if (!result.ok) {
    return photoErrorResponse(result.status, result.code, result.message, rateHeaders);
  }
  return new Response(Buffer.from(result.body), {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': result.cacheControl || PHOTO_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
