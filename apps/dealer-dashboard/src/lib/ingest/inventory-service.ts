import { pickInventoryDealerId } from '@autoagent/shared';
import { fetchAndIngestMarketCheckInventory } from '@/lib/ingest/marketcheck';

const MARKETCHECK_DEFAULT_BASE = 'https://api.marketcheck.com';
const MARKETCHECK_LOOKUP_TIMEOUT_MS = 8000;

export type DealerLookupResult =
  | { status: 'found'; dealerId: string; dealerName?: string | null; numFound?: number }
  | { status: 'no_match'; numFound?: number }
  | { status: 'error'; message: string; statusCode?: number };

export type DealerRooftop = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
};

export function normalizeInventoryUrlHost(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.startsWith('www.') ? parsed.hostname.slice(4) : parsed.hostname;
    return hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
  }
}

/**
 * MarketCheck URL lookup. Not a user-facing server action — call after
 * membership checks and only with a website already stored on the rooftop.
 */
export async function lookupDealerIdByInventoryUrl(inventoryUrl: string): Promise<DealerLookupResult> {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    return { status: 'error', message: 'MarketCheck API key is not configured on the server.' };
  }

  const baseUrl = (process.env.MARKETCHECK_BASE_URL || MARKETCHECK_DEFAULT_BASE).replace(/\/$/, '');
  const params = new URLSearchParams({
    api_key: apiKey,
    inventory_url: inventoryUrl,
    rows: '50',
  });

  const url = `${baseUrl}/v2/dealerships/car?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MARKETCHECK_LOOKUP_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);

    if ([401, 403, 429].includes(response.status)) {
      console.warn('[marketcheck_lookup] Request rejected or rate limited', {
        status: response.status,
      });
      return {
        status: 'error',
        statusCode: response.status,
        message: 'MarketCheck lookup was rejected or rate limited. Please try again shortly.',
      };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[marketcheck_lookup] Request failed', {
        status: response.status,
        body: body?.slice(0, 500),
      });
      return {
        status: 'error',
        statusCode: response.status,
        message: `MarketCheck lookup failed (${response.status}). Please try again.`,
      };
    }

    const payload = await response.json();
    const mcDealerships = Array.isArray(payload?.mc_dealerships) ? payload.mc_dealerships : [];
    const numFound = typeof payload?.num_found === 'number' ? payload.num_found : mcDealerships.length;

    if (numFound === 0 || mcDealerships.length === 0) {
      return { status: 'no_match', numFound: numFound ?? 0 };
    }

    const picked = pickInventoryDealerId(mcDealerships[0]);
    if (!picked) {
      return { status: 'error', message: 'MarketCheck lookup returned a dealership without an ID.' };
    }

    console.log('[marketcheck_lookup] Dealer resolved from inventory URL', {
      inventoryUrl,
      dealerId: picked.inventoryDealerId,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: 'found',
      dealerId: picked.inventoryDealerId,
      dealerName: picked.dealerName,
      numFound,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'error', message: 'MarketCheck lookup timed out. Please try again.' };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'MarketCheck lookup failed unexpectedly.',
    };
  }
}

/**
 * Load rooftop locations for a stored MarketCheck dealer ID.
 */
export async function fetchDealerRooftopsByDealerId(dealerId: string): Promise<DealerRooftop[]> {
  if (!dealerId) return [];

  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    console.error('[rooftops] MarketCheck API key not configured');
    return [];
  }

  const baseUrl = (process.env.MARKETCHECK_BASE_URL || MARKETCHECK_DEFAULT_BASE).replace(/\/$/, '');

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      dealer_id: dealerId,
      mc_website_id: dealerId,
      rows: '50',
      start: '0',
    });
    const url = `${baseUrl}/v2/dealerships/inventory?${params.toString()}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.error(`[rooftops] MarketCheck request failed (${response.status})`);
      return [];
    }

    const payload = await response.json();
    const listings = Array.isArray(payload.listings) ? payload.listings : [];
    const rooftopsMap = new Map<string, DealerRooftop>();

    listings.forEach((listing: Record<string, unknown>) => {
      const dealer = (listing.dealer || listing.mc_dealership) as Record<string, unknown> | undefined;
      if (!dealer || !dealer.zip) return;

      const key = `${dealer.zip}-${dealer.city || ''}-${dealer.state || ''}`;
      if (rooftopsMap.has(key)) return;

      const latitude =
        typeof dealer.latitude === 'string' ? parseFloat(dealer.latitude) : Number(dealer.latitude);
      const longitude =
        typeof dealer.longitude === 'string' ? parseFloat(dealer.longitude) : Number(dealer.longitude);

      rooftopsMap.set(key, {
        name: typeof dealer.name === 'string' ? dealer.name : 'Unknown Location',
        address: String(dealer.street || dealer.address || ''),
        city: String(dealer.city || ''),
        state: String(dealer.state || ''),
        zip: String(dealer.zip),
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
        phone: typeof dealer.phone === 'string' ? dealer.phone : undefined,
        website: typeof dealer.website === 'string' ? dealer.website : undefined,
      });
    });

    return Array.from(rooftopsMap.values());
  } catch (error) {
    console.error('[rooftops] Error fetching dealer rooftops:', error);
    return [];
  }
}

export { fetchAndIngestMarketCheckInventory };
