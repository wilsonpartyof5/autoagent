/**
 * MarketCheck Live Search Adapter
 *
 * Performs real-time inventory discovery against GET /v2/search/car/active.
 * Designed for MVP consumer discovery mode — no dealership dependency.
 *
 * Features:
 * - Bounds-to-center + radius conversion
 * - Filter mapping (make/model/year/price/miles/condition)
 * - Hard timeout with AbortController
 * - In-memory cache (5 min TTL) to reduce API spend
 * - MarketCheck pagination via `start` / `rows`
 * - Response normalization into VehicleResponse contract
 * - Typed errors for quota (402) and rate-limit (429) so callers can surface them clearly
 */

const MARKETCHECK_BASE_URL =
  process.env.MARKETCHECK_BASE_URL ?? 'https://marketcheck-prod.apigee.net';
const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY ?? '';

// --------------------------------------------------------------------------
// Typed errors
// --------------------------------------------------------------------------

export class MarketCheckQuotaError extends Error {
  readonly code = 'MARKETCHECK_QUOTA_EXCEEDED';
  constructor() {
    super('Monthly MarketCheck API quota reached. Upgrade your plan to continue searching.');
    this.name = 'MarketCheckQuotaError';
  }
}

export class MarketCheckRateLimitError extends Error {
  readonly code = 'MARKETCHECK_RATE_LIMITED';
  /** Retry-After seconds suggested by the API, if provided */
  readonly retryAfter?: number;
  constructor(retryAfter?: number) {
    super('Too many requests to MarketCheck. Please wait a moment and try again.');
    this.name = 'MarketCheckRateLimitError';
    this.retryAfter = retryAfter;
  }
}

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface LiveSearchFilters {
  make?: string;
  model?: string;
  year?: number;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxMiles?: number;
  condition?: 'new' | 'used' | 'certified';
  /** Normalized body type e.g. "Truck", "SUV", "Sedan" — mapped to MarketCheck body_style */
  bodyType?: string;
}

/** Map our normalized body type names to MarketCheck body_style values */
function toMarketCheckBodyStyle(bodyType: string): string {
  const map: Record<string, string> = {
    'Truck': 'Pickup Truck',
    'Pickup Truck': 'Pickup Truck',
    'SUV': 'SUV',
    'Sedan': 'Sedan',
    'Coupe': 'Coupe',
    'Van': 'Van',
    'Minivan': 'Minivan',
    'Wagon': 'Wagon',
    'Hatchback': 'Hatchback',
    'Convertible': 'Convertible',
    'Sports Car': 'Sports Car',
  };
  return map[bodyType] ?? bodyType;
}

export interface LiveSearchParams {
  /** Center latitude derived from bounds or userLocation */
  latitude: number;
  /** Center longitude derived from bounds or userLocation */
  longitude: number;
  /** Search radius in miles (derived from viewport span) */
  radiusMiles: number;
  filters?: LiveSearchFilters;
  /** Number of results to return (capped at 50) */
  rows?: number;
  /** Offset for pagination */
  start?: number;
}

export interface LiveVehicle {
  id: string;
  vin?: string;
  listingId?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition: 'new' | 'used' | 'certified';
  price: number;
  msrp?: number;
  miles?: number;
  bodyType?: string;
  thumbnailUrl?: string;
  primaryPhotoUrl?: string;
  photoUrls?: string[];
  location: {
    latitude: number;
    longitude: number;
    dealerName: string;
    dealerCity?: string;
    dealerState?: string;
  };
}

export interface LiveSearchResult {
  vehicles: LiveVehicle[];
  /** num_found from MarketCheck (may be approximate) */
  numFound: number;
  /** Rows actually returned this page */
  returned: number;
  /** Offset that was used */
  start: number;
  /** Rows per page that was requested */
  rows: number;
  /** Whether a cached response was served */
  fromCache: boolean;
  /** Milliseconds the upstream call took (0 when cached) */
  latencyMs: number;
}

interface MarketCheckListing {
  id: string;
  vin?: string;
  price?: number;
  msrp?: number;
  dom?: number;
  inventory_type?: 'new' | 'used' | 'cpo';
  certified?: boolean;
  miles?: number;
  mileage?: number;
  media?: {
    photo_links?: string[];
    /** CDN / MarketCheck-hosted copies — often populated when dealer `photo_links` are empty */
    photo_links_cached?: string[];
    primary_photo_url?: string;
    thumbnail?: { url?: string };
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
  };
  dealer?: {
    id?: string | number;
    name?: string;
    city?: string;
    state?: string;
    latitude?: number | string;
    longitude?: number | string;
  };
}

interface MarketCheckSearchResponse {
  listings?: MarketCheckListing[];
  num_found?: number;
}

// --------------------------------------------------------------------------
// In-memory cache
// --------------------------------------------------------------------------

interface CacheEntry {
  result: LiveSearchResult;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildCacheKey(params: LiveSearchParams): string {
  const f = params.filters ?? {};
  return [
    params.latitude.toFixed(4),
    params.longitude.toFixed(4),
    params.radiusMiles,
    params.rows ?? 50,
    params.start ?? 0,
    f.make ?? '',
    f.model ?? '',
    f.year ?? '',
    f.minYear ?? '',
    f.maxYear ?? '',
    f.minPrice ?? '',
    f.maxPrice ?? '',
    f.maxMiles ?? '',
    f.condition ?? '',
    f.bodyType ?? '',   // was missing — different body-type searches were sharing a cache entry
  ].join('|');
}

function getCached(key: string): LiveSearchResult | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: LiveSearchResult): void {
  searchCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Periodically remove expired entries (probabilistic, ~5% of calls)
function maybeEvictCache(): void {
  if (Math.random() > 0.05) return;
  const now = Date.now();
  for (const [k, v] of searchCache.entries()) {
    if (now > v.expiresAt) searchCache.delete(k);
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Derive haversine radius from a lat/lng bounding box.
 * Returns radius in miles (clamped 5–100).
 */
export function boundsToRadiusMiles(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): number {
  const latSpanDeg = bounds.north - bounds.south;
  const lngSpanDeg = bounds.east - bounds.west;
  // Miles per degree is roughly 69 for lat, 69*cos(lat) for lng
  const centerLat = (bounds.north + bounds.south) / 2;
  const latMiles = (latSpanDeg / 2) * 69;
  const lngMiles = (lngSpanDeg / 2) * 69 * Math.cos((centerLat * Math.PI) / 180);
  const radiusMiles = Math.max(latMiles, lngMiles);
  return Math.max(5, Math.min(100, Math.round(radiusMiles)));
}

function normalizeLat(val?: number | string): number | undefined {
  if (val === undefined || val === null) return undefined;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? undefined : n;
}

/**
 * Map a MarketCheck listing to the LiveVehicle contract.
 * Returns null if required coordinates are missing.
 */
function normalizeListing(listing: MarketCheckListing): LiveVehicle | null {
  const lat = normalizeLat(listing.dealer?.latitude);
  const lng = normalizeLat(listing.dealer?.longitude);
  if (lat === undefined || lng === undefined) return null;

  const year = listing.build?.year ?? new Date().getFullYear();
  const make = listing.build?.make ?? 'Unknown';
  const model = listing.build?.model ?? 'Vehicle';

  const dealerPhotos = listing.media?.photo_links?.filter(Boolean) ?? [];
  const cachedPhotos = listing.media?.photo_links_cached?.filter(Boolean) ?? [];
  const photoLinks = [...new Set([...cachedPhotos, ...dealerPhotos])];
  const primaryPhoto =
    listing.media?.primary_photo_url ??
    listing.media?.thumbnail?.url ??
    photoLinks[0];
  const miles = listing.miles ?? listing.mileage;

  let condition: 'new' | 'used' | 'certified' = 'used';
  if (listing.inventory_type === 'new') condition = 'new';
  else if (listing.inventory_type === 'cpo' || listing.certified) condition = 'certified';

  return {
    id: listing.id || listing.vin || `mc-${Date.now()}`,
    vin: listing.vin,
    listingId: listing.id,
    year,
    make,
    model,
    trim: listing.build?.trim,
    condition,
    price: Math.max(listing.price ?? 0, 0),
    msrp: listing.msrp,
    miles: typeof miles === 'number' ? Math.max(miles, 0) : undefined,
    bodyType: listing.build?.body_type,
    thumbnailUrl: primaryPhoto,
    primaryPhotoUrl: primaryPhoto,
    photoUrls: photoLinks.length > 0 ? photoLinks : undefined,
    location: {
      latitude: lat,
      longitude: lng,
      dealerName: listing.dealer?.name ?? 'Unknown Dealer',
      dealerCity: listing.dealer?.city,
      dealerState: listing.dealer?.state,
    },
  };
}

// --------------------------------------------------------------------------
// Client-side post-filtering
// --------------------------------------------------------------------------

/** True when user asked for pickups / trucks (normalized label from OpenAI). */
function isTruckBodyFilter(bodyType: string): boolean {
  const b = bodyType.trim().toLowerCase();
  return (
    b === 'truck' ||
    b === 'pickup' ||
    b === 'pickup truck' ||
    b.includes('pickup') ||
    (b.includes('truck') && !b.includes('suv'))
  );
}

/**
 * Many MarketCheck listings omit `build.body_type`. When the user filters for
 * trucks, we must not treat "missing body" as a pass-through — that lets every
 * sedan through. Infer pickup from make/model/trim when body_type is absent.
 */
function vehicleLooksLikePickupTruck(v: LiveVehicle): boolean {
  const blob = `${v.make} ${v.model} ${v.trim ?? ''}`.toLowerCase();

  const truckTokens = [
    'silverado',
    'sierra',
    'f-150',
    'f-250',
    'f-350',
    'f-450',
    'f150',
    'f250',
    'f350',
    'super duty',
    'ram 1500',
    'ram 2500',
    'ram 3500',
    'ram pickup',
    'ranger',
    'tacoma',
    'tundra',
    'frontier',
    'titan',
    'ridgeline',
    'colorado', // Chevy truck (not state — we only have make/model)
    'canyon',
    'maverick',
    'gladiator',
    'gmt400',
    'c/k',
    'pickup',
  ];
  if (truckTokens.some((t) => blob.includes(t))) return true;
  if (/\bs10\b/.test(blob)) return true;

  // Ram / Dodge full-size pickups
  if (/\bram\b/.test(blob) && /\b(1500|2500|3500|4500|5500)\b/.test(blob)) return true;
  if (/\bdodge\b/.test(blob) && /\bram\b/.test(blob)) return true;

  return false;
}

function matchesBodyTypeFilter(v: LiveVehicle, requestedBodyType: string): boolean {
  const requestedNorm = toMarketCheckBodyStyle(requestedBodyType).toLowerCase();
  const actual = (v.bodyType ?? '').toLowerCase();

  if (isTruckBodyFilter(requestedBodyType)) {
    // Explicit non-pickup body types from API
    if (
      actual &&
      (actual.includes('sedan') ||
        actual.includes('coupe') ||
        actual.includes('hatchback') ||
        actual.includes('wagon') ||
        (actual.includes('suv') && !actual.includes('pickup')) ||
        actual.includes('minivan') ||
        actual.includes('convertible'))
    ) {
      return false;
    }
    if (actual && (actual.includes('pickup') || actual.includes('truck'))) return true;
    return vehicleLooksLikePickupTruck(v);
  }

  // Other body styles: use API field when present; if missing, do not exclude (avoid false negatives)
  if (!actual) return true;
  return actual.includes(requestedNorm) || requestedNorm.includes(actual);
}

/**
 * Apply search filters to already-normalized vehicles.
 *
 * MarketCheck's free tier does not honour filter query params (year_min,
 * price_max, body_style, etc.) — it returns all nearby listings regardless.
 * We enforce the requested filters here so the user always sees matching results.
 */
function applyClientFilters(
  vehicles: LiveVehicle[],
  filters?: LiveSearchFilters,
): LiveVehicle[] {
  if (!filters) return vehicles;
  const f = filters;

  return vehicles.filter((v) => {
    if (f.make && v.make.toLowerCase() !== f.make.toLowerCase()) return false;
    if (f.model && !v.model.toLowerCase().includes(f.model.toLowerCase())) return false;

    if (f.year && v.year !== f.year) return false;
    if (f.minYear && v.year < f.minYear) return false;
    if (f.maxYear && v.year > f.maxYear) return false;

    if (f.minPrice && v.price < f.minPrice) return false;
    if (f.maxPrice && v.price > f.maxPrice) return false;

    if (f.maxMiles !== undefined && v.miles !== undefined && v.miles > f.maxMiles) return false;

    if (f.condition && v.condition !== f.condition) return false;

    if (f.bodyType && !matchesBodyTypeFilter(v, f.bodyType)) return false;

    return true;
  });
}

// --------------------------------------------------------------------------
// Public search function
// --------------------------------------------------------------------------

const SEARCH_TIMEOUT_MS = 8000;
/** Max extra MarketCheck pages to pull when client-side filters thin out one page of results */
const AGGREGATE_MAX_PAGES = 8;

function hasActiveFilters(f?: LiveSearchFilters): boolean {
  if (!f) return false;
  return !!(
    f.make ||
    f.model ||
    f.year != null ||
    f.minYear != null ||
    f.maxYear != null ||
    f.minPrice != null ||
    f.maxPrice != null ||
    f.maxMiles != null ||
    f.condition ||
    f.bodyType
  );
}

interface OnePageOptions {
  /** When true, skip mc_usage_increment (caller tracks once, e.g. multi-page aggregate) */
  suppressUsageTrack?: boolean;
}

/**
 * Single MarketCheck page: fetch, normalize, post-filter, cache, optional usage track.
 */
async function searchLiveInventoryOnePage(
  params: LiveSearchParams,
  rows: number,
  start: number,
  options: OnePageOptions = {},
): Promise<LiveSearchResult> {
  maybeEvictCache();
  const cacheKey = buildCacheKey({ ...params, rows, start });
  const cached = getCached(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true, latencyMs: 0 };
  }

  const url = buildSearchUrl(params, rows, start);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - t0;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');

      if (response.status === 402) {
        console.error(JSON.stringify({
          event: 'mc_quota_exceeded',
          status: 402,
          body: errorBody.substring(0, 300),
          latencyMs,
        }));
        throw new MarketCheckQuotaError();
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10);
        console.error(JSON.stringify({
          event: 'mc_rate_limited',
          status: 429,
          retryAfter,
          latencyMs,
        }));
        throw new MarketCheckRateLimitError(retryAfter);
      }

      console.error(JSON.stringify({
        event: 'mc_live_search_error',
        status: response.status,
        body: errorBody.substring(0, 300),
        latencyMs,
      }));
      return { vehicles: [], numFound: 0, returned: 0, start, rows, fromCache: false, latencyMs };
    }

    const data = (await response.json()) as MarketCheckSearchResponse;
    const listings = data.listings ?? [];
    const numFound = data.num_found ?? 0;

    const normalized = listings
      .map(normalizeListing)
      .filter((v): v is LiveVehicle => v !== null);

    const vehicles = applyClientFilters(normalized, params.filters);

    console.log(JSON.stringify({
      event: 'mc_live_search_complete',
      lat: params.latitude.toFixed(4),
      lng: params.longitude.toFixed(4),
      radiusMiles: params.radiusMiles,
      rows,
      start,
      numFound,
      returned: listings.length,
      normalized: normalized.length,
      afterClientFilter: vehicles.length,
      filtersApplied: params.filters ?? null,
      latencyMs,
    }));

    const result: LiveSearchResult = {
      vehicles,
      numFound,
      returned: listings.length,
      start,
      rows,
      fromCache: false,
      latencyMs,
    };

    setCache(cacheKey, result);
    if (!options.suppressUsageTrack) {
      void trackUsage('search').catch(() => {});
    }
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - t0;
    const isTimeout = error instanceof Error && error.name === 'AbortError';

    if (error instanceof MarketCheckQuotaError || error instanceof MarketCheckRateLimitError) {
      throw error;
    }

    console.error(JSON.stringify({
      event: isTimeout ? 'mc_live_search_timeout' : 'mc_live_search_exception',
      latencyMs,
      timeoutMs: SEARCH_TIMEOUT_MS,
      error: error instanceof Error ? error.message : String(error),
    }));

    return { vehicles: [], numFound: 0, returned: 0, start, rows, fromCache: false, latencyMs };
  }
}

/**
 * Perform a live MarketCheck inventory search.
 * Throws on configuration errors; returns empty result on upstream failures.
 *
 * When filters are active and `start === 0`, automatically fetches additional
 * pages (up to AGGREGATE_MAX_PAGES) until we fill `rows` post-filter matches or
 * run out of listings — because one page of mixed inventory often yields only a
 * handful of trucks after client-side filtering.
 */
export async function searchLiveInventory(params: LiveSearchParams): Promise<LiveSearchResult> {
  if (!MARKETCHECK_API_KEY) {
    throw new Error('MARKETCHECK_API_KEY is not configured');
  }

  const rows = Math.min(params.rows ?? 50, 50);
  const start = Math.max(params.start ?? 0, 0);

  // Pagination from client (page > 1): single upstream page only
  if (start > 0 || !hasActiveFilters(params.filters)) {
    return searchLiveInventoryOnePage(params, rows, start, {});
  }

  // First page + filters: aggregate multiple MC pages into one response
  const aggKey = buildCacheKey({ ...params, rows, start: 0 });
  const aggCached = getCached(aggKey);
  if (aggCached) {
    return { ...aggCached, fromCache: true, latencyMs: 0 };
  }

  const merged: LiveVehicle[] = [];
  const seen = new Set<string>();
  let curStart = 0;
  let totalLatency = 0;
  let numFound = 0;
  let pagesFetched = 0;

  for (let p = 0; p < AGGREGATE_MAX_PAGES && merged.length < rows; p++) {
    const page = await searchLiveInventoryOnePage(params, rows, curStart, {
      suppressUsageTrack: true,
    });
    pagesFetched += 1;
    totalLatency += page.latencyMs;
    numFound = page.numFound;

    for (const v of page.vehicles) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        merged.push(v);
        if (merged.length >= rows) break;
      }
    }

    if (merged.length >= rows) break;
    if (page.returned === 0) break;
    if (page.returned < rows) break;
    curStart += page.returned;
    if (numFound > 0 && curStart >= numFound) break;
  }

  const result: LiveSearchResult = {
    vehicles: merged.slice(0, rows),
    numFound,
    returned: merged.length,
    start: 0,
    rows,
    fromCache: false,
    latencyMs: totalLatency,
  };

  console.log(JSON.stringify({
    event: 'mc_live_search_aggregate',
    lat: params.latitude.toFixed(4),
    lng: params.longitude.toFixed(4),
    radiusMiles: params.radiusMiles,
    pagesFetched,
    mergedCount: merged.length,
    targetRows: rows,
    filtersApplied: params.filters ?? null,
    totalLatencyMs: totalLatency,
  }));

  setCache(aggKey, result);
  void trackUsage('search').catch(() => {});
  return result;
}

// --------------------------------------------------------------------------
// Usage tracking (Supabase-backed, fire-and-forget)
// --------------------------------------------------------------------------

/**
 * Increment the monthly MarketCheck call counter in Supabase.
 * Uses upsert so the row is created automatically on first call of the month.
 * Silently fails — tracking must never break search.
 */
async function trackUsage(callType: 'search' | 'detail'): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const monthKey = new Date().toISOString().substring(0, 7); // e.g. "2026-04"

  // Use Supabase REST directly to avoid importing the full client in this module
  await fetch(`${url}/rest/v1/rpc/mc_usage_increment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ p_month: monthKey, p_call_type: callType }),
    cache: 'no-store',
  });
}

// --------------------------------------------------------------------------
// URL builder
// --------------------------------------------------------------------------

function buildSearchUrl(params: LiveSearchParams, rows: number, start: number): string {
  const base = MARKETCHECK_BASE_URL.replace(/\/$/, '');
  const sp = new URLSearchParams();

  sp.set('api_key', MARKETCHECK_API_KEY);
  sp.set('latitude', params.latitude.toString());
  sp.set('longitude', params.longitude.toString());
  sp.set('radius', params.radiusMiles.toString());
  sp.set('rows', rows.toString());
  sp.set('start', start.toString());
  // Never append the MarketCheck key onto public photo URLs.
  sp.set('append_api_key', 'false');

  const f = params.filters ?? {};

  if (f.condition === 'new') sp.set('car_type', 'new');
  else if (f.condition === 'used') sp.set('car_type', 'used');
  else if (f.condition === 'certified') sp.set('car_type', 'cpo');
  // no condition filter = all types

  if (f.make) sp.set('make', f.make);
  if (f.model) sp.set('model', f.model);

  if (f.year) {
    sp.set('year', f.year.toString());
  } else {
    if (f.minYear) sp.set('year_min', f.minYear.toString());
    if (f.maxYear) sp.set('year_max', f.maxYear.toString());
  }

  if (f.minPrice) sp.set('price_min', f.minPrice.toString());
  if (f.maxPrice) sp.set('price_max', f.maxPrice.toString());
  if (f.maxMiles) sp.set('miles_max', f.maxMiles.toString());
  if (f.bodyType) sp.set('body_style', toMarketCheckBodyStyle(f.bodyType));

  return `${base}/v2/search/car/active?${sp.toString()}`;
}
