import { loadMarketCheck, marketCheckPriceCacheKey, zipArea } from './cache-policy';
import { callMcpTool, MarketCheckUpstreamError, McpQuotaError, McpRateLimitError } from './mcp-client';
import { redactSecrets } from './secrets';
import { recordMarketCheckCall } from './usage';

/**
 * MarketCheck Price (fair price). Cached for 24 hours under VIN + ZIP area
 * + miles. Search, listing detail, VIN decode, and history are not cached.
 * Comps that arrive on the price call are stored with that quote, so a cache
 * hit does not search.
 *
 * A shopper call is allowed only when they tap Unlock with agent or open a
 * deal. Browsing a listing does not load it. New cars are not priced.
 *
 * Which call a used/CPO unlock makes. Change FAIR_PRICE_SOURCE, one line.
 * This is not an environment variable.
 *
 * 'mcp_premium_with_comparables' (default)
 *   MCP tool predict_price_with_comparables { vin, miles, zip, dealer_type }.
 *   dealer_type is the listing's franchise or independent value, otherwise
 *   franchise. Reads data.marketcheck_price and the active comps at
 *   data.comparables.listings (id, vin, price, daysOnMarket from
 *   dom_active ?? dos_active ?? dom). Market intel uses those comps and does
 *   not call search_active_cars for them.
 *   Cost per used/CPO unlock: MarketCheck "Price US USED Premium" $0.09
 *   (public data fee schedule, https://developers.marketcheck.com/pricing).
 *   Assumes an MCP tool call bills at the underlying REST rate,
 *   GET /v2/predict/car/us/marketcheck_price/comparables. MarketCheck has not
 *   confirmed that. Plus get_car_history (public schedule: VIN History
 *   $0.006 per call; this repo has no separate pricing sheet) and the
 *   listing-detail lookup (GET /v2/listing/car, $0.002).
 *   The separate comps search is not made. About $0.018 more than Base plus
 *   a comps search, in one call, with sold comps and days-on-market stats
 *   on the response (this path keeps the active comps only).
 *
 * 'rest_base_plus_search'
 *   REST Base GET /v2/predict/car/us/marketcheck_price with vin, miles, zip,
 *   and dealer_type. The hosted MCP has no Base price tool: get_marketcheck_price
 *   returns isError "Unknown tool". Price only. Market intel then loads comps
 *   with search_active_cars.
 *   Cost: Price US USED Base $0.07 + that comps search (~$0.002 in the Math
 *   & P&L) ≈ $0.072, plus the same history and listing-detail calls.
 */

export const FAIR_PRICE_SOURCES = ['mcp_premium_with_comparables', 'rest_base_plus_search'] as const;
export type FairPriceSource = (typeof FAIR_PRICE_SOURCES)[number];

export const FAIR_PRICE_SOURCE: FairPriceSource = 'mcp_premium_with_comparables';

export const PREMIUM_PRICE_TOOL = 'predict_price_with_comparables';
export const REST_BASE_PRICE_ENDPOINT = 'v2/predict/car/us/marketcheck_price';

export const FAIR_PRICE_TRIGGERS = ['unlock_with_agent', 'open_deal'] as const;
export type FairPriceTrigger = (typeof FAIR_PRICE_TRIGGERS)[number];

export type MarketCheckDealerType = 'franchise' | 'independent';

export type FairPriceComp = {
  id: string;
  vin: string | null;
  price: number;
  daysOnMarket: number | null;
};

export type FairPriceQuote = {
  price: number;
  fromCache: boolean;
  /**
   * Active comps from the price call. An array means market intel must not
   * search. Omitted means the caller loads comps with search_active_cars.
   */
  comparables?: FairPriceComp[];
};

export type FairPriceVehicle = {
  vin?: string;
  miles?: number;
  zip?: string;
  condition?: 'new' | 'used' | 'certified';
  dealerType?: string | null;
};

export type FairPriceLoadOptions = {
  strict?: boolean;
  /** Tests only. Shopper calls use FAIR_PRICE_SOURCE. */
  source?: FairPriceSource;
};

export function fairPriceTriggerAllowed(trigger: string): trigger is FairPriceTrigger {
  return (FAIR_PRICE_TRIGGERS as readonly string[]).includes(trigger);
}

export function fairPriceDealerType(value: unknown): MarketCheckDealerType {
  return value === 'independent' || value === 'franchise' ? value : 'franchise';
}

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

export interface MarketCheckPrice {
  vin: string;
  miles: number;
  zip: string;
  price: number;
  fromCache: boolean;
  comparables?: FairPriceComp[];
}

export async function getMarketCheckPrice(
  input: { vin: string; miles: number; zip: string; dealerType?: string | null },
  now: () => number = Date.now,
  options?: FairPriceLoadOptions,
): Promise<MarketCheckPrice | null> {
  const vin = input.vin.trim().toUpperCase();
  const zip = zipArea(input.zip);
  const miles = Math.round(input.miles);
  if (!VIN.test(vin) || zip.length !== 5 || !Number.isFinite(miles) || miles < 0 || miles > 2_000_000) {
    return null;
  }

  const source = options?.source ?? FAIR_PRICE_SOURCE;
  const dealerType = fairPriceDealerType(input.dealerType);
  const key = marketCheckPriceCacheKey(vin, zip, miles);
  const { value, fromCache } = await loadMarketCheck(
    'marketcheck_price',
    key,
    () => fetchMarketCheckPrice(vin, miles, zip, dealerType, source, options?.strict === true),
    now,
  );
  if (!value) return null;
  return { ...value, fromCache };
}

/**
 * Shopper fair price. Returns null without a MarketCheck call unless the
 * trigger is Unlock with agent or opening a deal, and the car is used or CPO
 * with a VIN, miles, and ZIP.
 */
export async function loadFairPriceIfAllowed(
  trigger: string,
  vehicle: FairPriceVehicle,
  options?: FairPriceLoadOptions,
): Promise<FairPriceQuote | null> {
  if (!fairPriceTriggerAllowed(trigger)) return null;
  if (vehicle.condition === 'new') return null;
  if (!vehicle.vin || vehicle.miles == null || !vehicle.zip) return null;
  try {
    const quote = await getMarketCheckPrice({
      vin: vehicle.vin,
      miles: vehicle.miles,
      zip: vehicle.zip,
      dealerType: vehicle.dealerType,
    }, Date.now, options);
    if (!quote) return null;
    return {
      price: quote.price,
      fromCache: quote.fromCache,
      ...(Array.isArray(quote.comparables) ? { comparables: quote.comparables } : {}),
    };
  } catch (error) {
    if (options?.strict) throw error;
    console.error(JSON.stringify({
      event: 'marketcheck_price_failed',
      trigger,
      error: redactSecrets(error instanceof Error ? error.message : String(error)),
    }));
    return null;
  }
}

async function fetchMarketCheckPrice(
  vin: string,
  miles: number,
  zip: string,
  dealerType: MarketCheckDealerType,
  source: FairPriceSource,
  strict: boolean,
): Promise<Omit<MarketCheckPrice, 'fromCache'> | null> {
  if (source === 'rest_base_plus_search') {
    const price = await fetchRestBasePrice(vin, miles, zip, dealerType, strict);
    if (price == null) return null;
    return { vin, miles, zip, price };
  }
  const raw = await callMcpTool<unknown>(PREMIUM_PRICE_TOOL, {
    vin,
    miles,
    zip,
    dealer_type: dealerType,
  }, 8000, { strict });
  const parsed = readPremiumPrice(raw);
  if (!parsed) return null;
  return { vin, miles, zip, price: parsed.price, comparables: parsed.comparables };
}

async function fetchRestBasePrice(
  vin: string,
  miles: number,
  zip: string,
  dealerType: MarketCheckDealerType,
  strict: boolean,
): Promise<number | null> {
  const apiKey = process.env.MARKETCHECK_API_KEY ?? '';
  if (!apiKey) throw new Error('MARKETCHECK_API_KEY is not configured');

  recordMarketCheckCall(REST_BASE_PRICE_ENDPOINT);
  const base = (process.env.MARKETCHECK_BASE_URL ?? 'https://api.marketcheck.com').replace(/\/+$/, '');
  const params = new URLSearchParams({
    api_key: apiKey,
    vin,
    miles: String(miles),
    dealer_type: dealerType,
    zip,
  });
  const url = `${base}/${REST_BASE_PRICE_ENDPOINT}?${params.toString()}`;
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
      console.error(JSON.stringify({
        event: 'mc_base_price_http_error',
        status: response.status,
        body: redactSecrets(body).slice(0, 300),
      }));
      if (strict) {
        throw new MarketCheckUpstreamError(`MarketCheck ${REST_BASE_PRICE_ENDPOINT} failed (${response.status})`, response.status);
      }
      return null;
    }
    return readRestBasePrice(await response.json());
  } catch (error) {
    if (
      error instanceof MarketCheckUpstreamError
      || error instanceof McpQuotaError
      || error instanceof McpRateLimitError
    ) throw error;
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      event: isTimeout ? 'mc_base_price_timeout' : 'mc_base_price_exception',
      error: redactSecrets(message),
    }));
    if (strict) {
      throw new MarketCheckUpstreamError(
        isTimeout ? `MarketCheck ${REST_BASE_PRICE_ENDPOINT} timed out` : `MarketCheck ${REST_BASE_PRICE_ENDPOINT} failed`,
      );
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function readPremiumPrice(raw: unknown): { price: number; comparables: FairPriceComp[] } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.success === false) return null;
  const data = record.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const body = data as Record<string, unknown>;
  const price = readMoney(body.marketcheck_price);
  if (price == null) return null;
  const comparables = readActiveComparables(body.comparables);
  if (!comparables) return null;
  return { price, comparables };
}

function readRestBasePrice(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.success === false) return null;
  return readMoney(record.marketcheck_price);
}

function readActiveComparables(raw: unknown): FairPriceComp[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const listings = (raw as Record<string, unknown>).listings;
  if (!Array.isArray(listings)) return null;
  const comps: FairPriceComp[] = [];
  for (const listing of listings) {
    const comp = readComp(listing);
    if (comp) comps.push(comp);
  }
  return comps;
}

function readComp(raw: unknown): FairPriceComp | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const listing = raw as Record<string, unknown>;
  const id = typeof listing.id === 'string' ? listing.id.trim() : '';
  if (!id) return null;
  const price = readMoney(listing.price);
  if (price == null) return null;
  const vin = typeof listing.vin === 'string' && listing.vin.trim()
    ? listing.vin.trim().toUpperCase()
    : null;
  return { id, vin, price, daysOnMarket: readDays(listing) };
}

function readDays(listing: Record<string, unknown>): number | null {
  const candidate = listing.dom_active ?? listing.dos_active ?? listing.dom;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0) return null;
  return Math.round(candidate);
}

function readMoney(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}
