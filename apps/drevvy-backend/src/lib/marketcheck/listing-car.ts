import { McpQuotaError, McpRateLimitError } from './mcp-client';
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

export function marketCheckListingFromPayload(payload: unknown): Record<string, unknown> | null {
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
      throw new Error(`MarketCheck listing lookup failed (${response.status}) ${redactSecrets(body).slice(0, 180)}`);
    }
    return marketCheckListingFromPayload(await response.json());
  } catch (error) {
    if (error instanceof McpQuotaError || error instanceof McpRateLimitError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      const timeout = new Error('MarketCheck listing lookup timed out');
      timeout.name = 'TimeoutError';
      throw timeout;
    }
    if (error instanceof Error) {
      throw new Error(redactSecrets(error.message));
    }
    throw new Error('MarketCheck listing lookup failed');
  } finally {
    clearTimeout(timer);
  }
}
