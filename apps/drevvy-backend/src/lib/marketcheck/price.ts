import { loadMarketCheck, marketCheckPriceCacheKey, peekMarketCheck, zipArea } from './cache-policy';
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
 *
 * Paid calls stay off unless FAIR_PRICE_SPEND_ENABLED is the exact string
 * "true" at request time. Unset or any other value is off. A deal open
 * returns before any ZIP lookup, so it makes no MarketCheck call. A
 * market-intel unlock returns no price, so the key is refunded.
 * FAIR_PRICE_DAILY_CAP counts network calls per user per UTC
 * day in this process only. An empty lookup is remembered for
 * FAIR_PRICE_NEGATIVE_TTL_MS. A 5xx or transport failure is remembered only
 * for FAIR_PRICE_UPSTREAM_TTL_MS.
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
  /** Similarity facts MarketCheck returns on each comparable. Null when absent. */
  year?: number | null;
  trim?: string | null;
  miles?: number | null;
  /** Miles from the subject car, as MarketCheck reports `dist`. */
  distanceMiles?: number | null;
  dealerName?: string | null;
  vdpUrl?: string | null;
};

export type FairPriceQuote = {
  price: number;
  fromCache: boolean;
  /**
   * Active comps from the price call. An array means market intel must not
   * search. Omitted means the caller loads comps with search_active_cars.
   */
  comparables?: FairPriceComp[];
  /** Factory sticker for this VIN as configured (MarketCheck `msrp` on the price response). */
  msrp?: number;
};

export type FairPriceVehicle = {
  vin?: string;
  miles?: number;
  zip?: string;
  condition?: 'new' | 'used' | 'certified';
  dealerType?: string | null;
};

export type FairPricePurpose = 'deal' | 'market_intel';

export type FairPriceLoadOptions = {
  strict?: boolean;
  /** Tests only. Shopper calls use FAIR_PRICE_SOURCE. */
  source?: FairPriceSource;
  /** Signed-in shopper. A paid call without one is refused. */
  userId?: string | null;
  /**
   * Market intel returns no price when spend is off, including a cache hit,
   * so the key is refunded. Deal opens do not call this while spend is off.
   */
  purpose?: FairPricePurpose;
};

/** Network price calls per user per UTC day. In-memory, so each instance counts alone. */
export const FAIR_PRICE_DAILY_CAP = 20;
/**
 * Network price calls for every shopper in this process per UTC day.
 * The durable ceiling lives in supabase/held and is not applied.
 */
export const FAIR_PRICE_GLOBAL_DAILY_CAP = 200;
/** Empty or failed price lookups. Repeats are not billed again. */
export const FAIR_PRICE_NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;
/** 5xx and transport failures. Short so a blip can be retried. */
export const FAIR_PRICE_UPSTREAM_TTL_MS = 2 * 60 * 1000;

/** True only when the process env is exactly the string "true". Read on each call. */
export function fairPriceSpendEnabled(): boolean {
  return process.env.FAIR_PRICE_SPEND_ENABLED === 'true';
}

type NegativeKind = 'miss' | 'tool' | 'upstream';

type NegativeEntry = {
  kind: NegativeKind;
  expiresAt: number;
  error?: unknown;
};

/** Daily cap or a missing shopper. Strict callers throw this and do not cache it. */
export class FairPriceCappedError extends Error {
  constructor() {
    super('fair price daily cap');
    this.name = 'FairPriceCappedError';
  }
}

const negativeCache = new Map<string, NegativeEntry>();
const dailyCalls = new Map<string, { day: string; count: number }>();
const globalCalls = new Map<string, number>();

export function resetFairPriceGuardsForTests(): void {
  negativeCache.clear();
  dailyCalls.clear();
  globalCalls.clear();
}

function rememberNegative(key: string, kind: NegativeKind, nowMs: number, error?: unknown): void {
  const ttl = kind === 'upstream' ? FAIR_PRICE_UPSTREAM_TTL_MS : FAIR_PRICE_NEGATIVE_TTL_MS;
  negativeCache.set(key, { kind, expiresAt: nowMs + ttl, error });
}

function readNegative(key: string, nowMs: number): NegativeEntry | null {
  const entry = negativeCache.get(key);
  if (!entry) return null;
  if (nowMs >= entry.expiresAt) {
    negativeCache.delete(key);
    return null;
  }
  return entry;
}

function negativeKindFor(error: unknown): NegativeKind {
  if (error instanceof MarketCheckUpstreamError) {
    if (error.kind === 'tool') return 'tool';
    if (error.kind === 'timeout' || error.kind === 'transport') return 'upstream';
    if (error.kind === 'http' && (error.status ?? 0) >= 500) return 'upstream';
  }
  return 'upstream';
}

/** Counts one network call. False when this user is already at the daily cap. */
export function tryConsumeFairPriceCall(userId: string, nowMs: number): boolean {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  if (dailyCalls.size > 1000) {
    for (const [id, row] of dailyCalls) {
      if (row.day !== day) dailyCalls.delete(id);
    }
  }
  const global = globalCalls.get(day) ?? 0;
  if (global >= FAIR_PRICE_GLOBAL_DAILY_CAP) return false;
  const row = dailyCalls.get(userId);
  if (!row || row.day !== day) {
    dailyCalls.set(userId, { day, count: 1 });
    globalCalls.set(day, global + 1);
    return true;
  }
  if (row.count >= FAIR_PRICE_DAILY_CAP) return false;
  row.count += 1;
  globalCalls.set(day, global + 1);
  return true;
}

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
  msrp?: number;
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

  const purpose = options?.purpose ?? 'deal';
  const source = options?.source ?? FAIR_PRICE_SOURCE;
  const dealerType = fairPriceDealerType(input.dealerType);
  const key = marketCheckPriceCacheKey(vin, zip, miles);
  const spendOn = fairPriceSpendEnabled();

  if (!spendOn && purpose === 'market_intel') return null;

  const cached = peekMarketCheck<Omit<MarketCheckPrice, 'fromCache'>>('marketcheck_price', key, now);
  if (cached) return { ...cached, fromCache: true };
  if (!spendOn) return null;

  const blocked = readNegative(key, now());
  if (blocked) {
    if (blocked.kind !== 'miss' && options?.strict) {
      throw blocked.error instanceof Error
        ? blocked.error
        : new MarketCheckUpstreamError('MarketCheck price lookup failed');
    }
    return null;
  }

  const userId = typeof options?.userId === 'string' ? options.userId.trim() : '';
  if (!userId || !tryConsumeFairPriceCall(userId, now())) {
    if (options?.strict) throw new FairPriceCappedError();
    return null;
  }

  try {
    const { value, fromCache } = await loadMarketCheck(
      'marketcheck_price',
      key,
      () => fetchMarketCheckPrice(vin, miles, zip, dealerType, source, true),
      now,
    );
    if (!value) {
      rememberNegative(key, 'miss', now());
      return null;
    }
    return { ...value, fromCache };
  } catch (error) {
    if (error instanceof FairPriceCappedError) {
      if (options?.strict) throw error;
      return null;
    }
    rememberNegative(key, negativeKindFor(error), now(), error);
    if (options?.strict) throw error;
    console.error(JSON.stringify({
      event: 'marketcheck_price_failed',
      error: redactSecrets(error instanceof Error ? error.message : String(error)),
    }));
    return null;
  }
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
  now: () => number = Date.now,
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
    }, now, options);
    if (!quote) return null;
    return {
      price: quote.price,
      fromCache: quote.fromCache,
      ...(Array.isArray(quote.comparables) ? { comparables: quote.comparables } : {}),
      ...(typeof quote.msrp === 'number' && quote.msrp > 0 ? { msrp: quote.msrp } : {}),
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
  return {
    vin,
    miles,
    zip,
    price: parsed.price,
    comparables: parsed.comparables,
    ...(parsed.msrp != null ? { msrp: parsed.msrp } : {}),
  };
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
        throw new MarketCheckUpstreamError(
          `MarketCheck ${REST_BASE_PRICE_ENDPOINT} failed (${response.status})`,
          response.status,
          'http',
        );
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
        null,
        isTimeout ? 'timeout' : 'transport',
      );
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function readPremiumPrice(
  raw: unknown,
): { price: number; comparables: FairPriceComp[]; msrp: number | null } | null {
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
  return { price, comparables, msrp: readMoney(body.msrp) };
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
  return {
    id,
    vin,
    price,
    daysOnMarket: readDays(listing),
    year: readWhole(listing.year),
    trim: typeof listing.trim === 'string' && listing.trim.trim() ? listing.trim.trim() : null,
    miles: readWhole(listing.miles),
    distanceMiles: typeof listing.dist === 'number' && Number.isFinite(listing.dist) ? listing.dist : null,
    dealerName: typeof listing.dealer_name === 'string' ? listing.dealer_name : null,
    vdpUrl: typeof listing.vdp_url === 'string' ? listing.vdp_url : null,
  };
}

function readDays(listing: Record<string, unknown>): number | null {
  const candidate = listing.dom_active ?? listing.dos_active ?? listing.dom;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0) return null;
  return Math.round(candidate);
}

function readWhole(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function readMoney(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}
