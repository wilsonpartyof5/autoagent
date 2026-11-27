import { MarketCheckUpstreamError, McpQuotaError, McpRateLimitError } from './mcp-client';
import { enforceListingCarDailyCap } from './listing-car-limit';
import { redactSecrets } from './secrets';
import { recordMarketCheckCall } from './usage';

/**
 * One live listing: GET /v2/listing/car/{listing_id}.
 * MarketCheck's search_active_cars tool ignored listing_id in the sandbox
 * and returned a different car. This endpoint is the same $0.002 lookup
 * and addresses that id. The response is not cached: sales terms forbid
 * storing listing detail. Callers may remember that a listing had no
 * market value, which is an id and a timestamp, not the listing body.
 */

export const LISTING_CAR_ENDPOINT = 'listing_detail';

/** Identifiers and URLs stay as MarketCheck sent them. Display text is decoded. */
const OPAQUE_LISTING_KEYS = new Set([
  'id',
  'vin',
  'listing_id',
  'photo_links',
  'photo_links_cached',
  'primary_photo_url',
  'photo_url',
  'url',
  'website',
  'video_url',
  'vdp_url',
  'thumbnail',
]);

/** Percent-encoded display text. A string that is not valid encoding is left as-is. */
export function decodeMarketCheckText(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeListingText(value: unknown, key?: string): unknown {
  if (key && OPAQUE_LISTING_KEYS.has(key)) return value;
  if (typeof value === 'string') return decodeMarketCheckText(value);
  if (Array.isArray(value)) return value.map((item) => decodeListingText(item));
  if (value && typeof value === 'object') {
    const decoded: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      decoded[childKey] = decodeListingText(child, childKey);
    }
    return decoded;
  }
  return value;
}

export function marketCheckListingFromPayload(payload: unknown): Record<string, unknown> | null {
  const listing = listingRecord(payload);
  if (!listing) return null;
  const decoded = decodeListingText(listing);
  return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
    ? decoded as Record<string, unknown>
    : null;
}

function listingRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.listings)) {
      const first = nested.listings[0];
      return first && typeof first === 'object' && !Array.isArray(first)
        ? first as Record<string, unknown>
        : null;
    }
    return nested;
  }
  if (Array.isArray(record.listings)) return null;
  return record;
}

export async function fetchMarketCheckListing(listingId: string): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.MARKETCHECK_API_KEY ?? '';
  if (!apiKey) throw new Error('MARKETCHECK_API_KEY is not configured');
  await enforceListingCarDailyCap();

  recordMarketCheckCall(LISTING_CAR_ENDPOINT);
  const base = (process.env.MARKETCHECK_BASE_URL ?? 'https://api.marketcheck.com').replace(/\/+$/, '');
  const url = `${base}/v2/listing/car/${encodeURIComponent(listingId)}?api_key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.status === 402) throw new McpQuotaError();
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10);
      throw new McpRateLimitError(Number.isNaN(retryAfter) ? 60 : retryAfter);
    }
    if (response.status === 404 || response.status === 422) return null;
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new MarketCheckUpstreamError(
        `MarketCheck listing lookup failed (${response.status}) ${redactSecrets(body).slice(0, 180)}`,
        response.status,
      );
    }
    return marketCheckListingFromPayload(await response.json());
  } catch (error) {
    if (
      error instanceof MarketCheckUpstreamError
      || error instanceof McpQuotaError
      || error instanceof McpRateLimitError
    ) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MarketCheckUpstreamError('MarketCheck listing lookup timed out');
    }
    throw new MarketCheckUpstreamError(
      redactSecrets(error instanceof Error ? error.message : 'MarketCheck listing lookup failed'),
    );
  } finally {
    clearTimeout(timer);
  }
}
