/**
 * Cars Dealer Inventory Syndication API
 * GET /v2/dealerships/inventory
 *
 * Used for enrolled-dealer onboard and daily refresh. Live shopper search
 * stays on /v2/search/car/active and must not be used to ingest a rooftop.
 */

export const DEALERSHIP_INVENTORY_PATH = '/v2/dealerships/inventory';
export const SYNDICATION_MAX_ROWS = 1500;

export type SyndicationQuery = {
  apiKey: string;
  dealerId?: string | null;
  source?: string | null;
  start?: number;
  rows?: number;
};

export function normalizeSyndicationSource(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.startsWith('www.')
      ? parsed.hostname.slice(4)
      : parsed.hostname;
    return hostname.toLowerCase() || undefined;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      ?.toLowerCase();
  }
}

export function buildDealershipInventoryUrl(
  baseUrl: string,
  query: SyndicationQuery,
): string {
  if (!query.dealerId && !query.source) {
    throw new Error('dealerId or source is required for Dealership Inventory Syndication');
  }

  const rows = Math.min(
    SYNDICATION_MAX_ROWS,
    Math.max(1, Number(query.rows) || SYNDICATION_MAX_ROWS),
  );
  const start = Math.max(0, Number(query.start) || 0);
  const source = normalizeSyndicationSource(query.source);
  const dealerId = query.dealerId?.trim() || undefined;

  const params = new URLSearchParams({
    api_key: query.apiKey,
    start: String(start),
    rows: String(rows),
  });

  // Prefer website-scoped IDs; listing dealer.id matches mc_website_id.
  if (dealerId) {
    params.set('mc_website_id', dealerId);
    params.set('dealer_id', dealerId);
  }
  if (source) {
    params.set('source', source);
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}${DEALERSHIP_INVENTORY_PATH}?${params.toString()}`;
}
