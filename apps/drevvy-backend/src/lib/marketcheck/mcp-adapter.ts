/**
 * MarketCheck MCP Adapter
 *
 * Translates internal search/detail requests into MarketCheck MCP tool calls
 * and normalizes the responses back into the DTOs the rest of the app uses
 * (LiveSearchResult and DetailResponse).
 *
 * Tool mapping:
 *   search    → search_active_cars
 *   vin info  → decode_vin_neovin
 *   history   → get_car_history
 *
 * The normalization logic mirrors live-search.ts so existing callers see an
 * identical shape regardless of whether data came from REST or MCP.
 */

import {
  callMcpTool,
  McpQuotaError,
  McpRateLimitError,
} from './mcp-client';

export { McpQuotaError as MarketCheckQuotaError, McpRateLimitError as MarketCheckRateLimitError };

// --------------------------------------------------------------------------
// Shared utilities — mirrors live-search.ts helpers
// --------------------------------------------------------------------------

function normalizeLat(val?: number | string): number | undefined {
  if (val === undefined || val === null) return undefined;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? undefined : n;
}

// --------------------------------------------------------------------------
// Raw types from MarketCheck (same shape whether REST or MCP-wrapped)
// --------------------------------------------------------------------------

interface MCListing {
  id?: string;
  vin?: string;
  price?: number;
  msrp?: number;
  dom?: number;
  inventory_type?: 'new' | 'used' | 'cpo';
  certified?: boolean;
  exterior_color?: string;
  interior_color?: string;
  miles?: number;
  mileage?: number;
  media?: {
    photo_links?: string[];
    photo_links_cached?: string[];
    primary_photo_url?: string;
    thumbnail?: { url?: string };
    video_url?: string;
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    drivetrain?: string;
    drive_train?: string;
    fuel_type?: string;
    transmission?: string;
  };
  dealer?: {
    id?: string | number;
    name?: string;
    street?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number | string;
    longitude?: number | string;
    phone?: string;
    phone_formatted?: string;
    website?: string;
    hours?: Record<string, string>;
    rating?: number;
    review_count?: number;
  };
  seller_comments?: string;
  description?: string;
  features?: string[];
  options?: Array<{ name?: string; code?: string; description?: string } | string>;
}

interface MCSearchResponse {
  success?: boolean;
  service?: string;
  data?: {
    listings?: MCListing[];
    num_found?: number;
    start?: string | number;
    rows?: string | number;
  };
}

interface MCVinDecodeResult {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  msrp?: number;
  body_type?: string;
  drivetrain?: string;
  drive_train?: string;
  fuel_type?: string;
  transmission?: string;
  engine?: string;
  city_mpg?: number;
  highway_mpg?: number;
  seating_capacity?: number;
  powertrain_type?: string;
  features?: string[];
  high_value_features?: string[];
  options?: Array<{ name?: string; code?: string; description?: string } | string>;
}

interface MCVinDecodeEnvelope {
  success?: boolean;
  service?: string;
  data?: MCVinDecodeResult;
}

interface MCCarHistoryEntry {
  id?: string;
  price?: number;
  miles?: number;
  first_seen_at?: number;
  last_seen_at?: number;
  first_seen_at_date?: string;
  last_seen_at_date?: string;
  source?: string;
  seller_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  inventory_type?: string;
  status_date?: string;
}

interface MCCarHistory {
  listing_id?: string;
  vin?: string;
  dom?: number;
  first_seen_at?: string;
  last_seen_at?: string;
  price_history?: Array<{ price: number; date?: string }>;
}

// --------------------------------------------------------------------------
// Public contracts (unchanged from live-search.ts / detail route)
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
  bodyType?: string;
  exteriorColor?: string;
  seatingCapacity?: number;
  powertrainType?: string;
}

export interface LiveSearchParams {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  filters?: LiveSearchFilters;
  rows?: number;
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
  numFound: number;
  returned: number;
  start: number;
  rows: number;
  fromCache: boolean;
  latencyMs: number;
}

export interface DetailResponse {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition: 'new' | 'used' | 'certified';
  price: number;
  msrp?: number;
  miles?: number;
  bodyType?: string;
  exteriorColor?: string;
  interiorColor?: string;
  drivetrain?: string;
  fuelType?: string;
  transmission?: string;
  engine?: string;
  cityMpg?: number;
  highwayMpg?: number;
  seatingCapacity?: number;
  powertrainType?: string;
  sellerComments?: string;
  description?: string;
  features?: string[];
  options?: Array<{ name?: string; code?: string; description?: string }>;
  photoUrls?: string[];
  videoUrl?: string;
  daysOnMarket?: number;
  location: {
    latitude?: number;
    longitude?: number;
    dealerName: string;
    dealerCity?: string;
    dealerState?: string;
    dealerPhone?: string;
    dealerWebsite?: string;
    dealerAddress?: string;
    dealerRating?: number;
    dealerReviewCount?: number;
    dealerHours?: Record<string, string>;
  };
  enrichedAt: string;
  partial: boolean;
}

// --------------------------------------------------------------------------
// In-memory caches
// --------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<LiveSearchResult>>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const detailCache = new Map<string, CacheEntry<DetailResponse>>();
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;

function maybeEvict<T>(cache: Map<string, CacheEntry<T>>): void {
  if (Math.random() > 0.05) return;
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (now > v.expiresAt) cache.delete(k);
  }
}

// --------------------------------------------------------------------------
// Search normalization
// --------------------------------------------------------------------------

function normalizeCondition(listing: MCListing): 'new' | 'used' | 'certified' {
  if (listing.inventory_type === 'new') return 'new';
  if (listing.inventory_type === 'cpo' || listing.certified) return 'certified';
  return 'used';
}

/**
 * Append the MarketCheck API key to MarketCheck-hosted CDN URLs only.
 * Third-party dealer CDN URLs (e.g. dealercenter.net, overfuel.com) don't
 * require authentication and should be passed through unchanged.
 */
function withApiKey(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (!url.includes('api.marketcheck.com')) return url;
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}api_key=${apiKey}`;
}

function normalizeListing(listing: MCListing): LiveVehicle | null {
  const lat = normalizeLat(listing.dealer?.latitude);
  const lng = normalizeLat(listing.dealer?.longitude);
  if (lat === undefined || lng === undefined) return null;

  const cachedPhotos = Array.isArray(listing.media?.photo_links_cached) ? (listing.media!.photo_links_cached as string[]).filter(Boolean) : [];
  const dealerPhotos = Array.isArray(listing.media?.photo_links) ? (listing.media!.photo_links as string[]).filter(Boolean) : [];

  // Prefer dealer originals for the gallery — the cached thumbnails are lower-res copies
  // of the same images. Only fall back to cached if no dealer photos are available.
  // This prevents showing the same photo twice (once cached, once original).
  const galleryPhotos = dealerPhotos.length > 0 ? dealerPhotos : cachedPhotos;
  const thumbnailPhoto = cachedPhotos[0] ?? dealerPhotos[0] ?? listing.media?.primary_photo_url ?? listing.media?.thumbnail?.url;

  const miles = listing.miles ?? listing.mileage;

  return {
    id: listing.id ?? listing.vin ?? `mc-${Date.now()}`,
    vin: listing.vin,
    listingId: listing.id,
    year: listing.build?.year ?? new Date().getFullYear(),
    make: listing.build?.make ?? 'Unknown',
    model: listing.build?.model ?? 'Vehicle',
    trim: listing.build?.trim,
    condition: normalizeCondition(listing),
    price: Math.max(listing.price ?? 0, 0),
    msrp: listing.msrp,
    miles: typeof miles === 'number' ? Math.max(miles, 0) : undefined,
    bodyType: listing.build?.body_type,
    thumbnailUrl: withApiKey(thumbnailPhoto),
    primaryPhotoUrl: withApiKey(galleryPhotos[0] ?? thumbnailPhoto),
    photoUrls: galleryPhotos.length > 0 ? galleryPhotos.map(withApiKey).filter((u): u is string => !!u) : undefined,
    location: {
      latitude: lat,
      longitude: lng,
      dealerName: listing.dealer?.name ?? 'Unknown Dealer',
      dealerCity: listing.dealer?.city,
      dealerState: listing.dealer?.state,
    },
  };
}

// All body type filtering is handled by the API using correct MarketCheck
// canonical values. No client-side filtering needed.
function applyClientFilters(vehicles: LiveVehicle[]): LiveVehicle[] {
  return vehicles;
}

function buildSearchCacheKey(params: LiveSearchParams): string {
  const f = params.filters ?? {};
  return [
    params.latitude.toFixed(4),
    params.longitude.toFixed(4),
    params.radiusMiles,
    params.rows ?? 25,
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
    f.bodyType ?? '',
  ].join('|');
}

// --------------------------------------------------------------------------
// Public: search_active_cars
// --------------------------------------------------------------------------


function buildSearchArgs(params: LiveSearchParams, rows: number, start: number): Record<string, unknown> {
  const args: Record<string, unknown> = {
    latitude: params.latitude,
    longitude: params.longitude,
    radius: params.radiusMiles,
    rows,
    start,
    // Required to get build.year/make/model/trim/body_type/drivetrain/fuel_type in response
    include_build_object: true,
    // Required to get dealer.latitude/longitude/name/city/state in response
    include_dealer_object: true,
  };
  const f = params.filters ?? {};
  if (f.condition === 'new') args.car_type = 'new';
  else if (f.condition === 'used') args.car_type = 'used';
  else if (f.condition === 'certified') args.car_type = 'cpo';
  if (f.make) args.make = f.make;
  if (f.model) args.model = f.model;
  if (f.year) {
    args.year = f.year;
  } else if (f.minYear || f.maxYear) {
    // MCP uses range strings, not separate min/max params
    const yMin = f.minYear ?? 1900;
    const yMax = f.maxYear ?? (new Date().getFullYear() + 1);
    args.year_range = `${yMin}-${yMax}`;
  }
  if (f.minPrice || f.maxPrice) {
    // MCP uses "min-max" range string, not separate price_min/price_max params
    const pMin = f.minPrice ?? 0;
    const pMax = f.maxPrice ?? 9999999;
    args.price_range = `${pMin}-${pMax}`;
  }
  if (f.maxMiles) {
    // MCP uses "min-max" range string, not a scalar miles_max param
    args.miles_range = `0-${f.maxMiles}`;
  }
  // Pass body_type directly using the canonical MarketCheck values.
  // Correct values (verified via facets): "Pickup", "SUV", "Sedan", "Minivan",
  // "Cargo Van", "Passenger Van", "Coupe", "Hatchback", "Wagon", "Convertible".
  // "Truck", "Van", and "Pickup Truck" all return 0 — they are not valid API values.
  if (f.bodyType) args.body_type = f.bodyType;
  if (f.seatingCapacity) args.seating_capacity = f.seatingCapacity;
  if (f.powertrainType) args.powertrain_type = f.powertrainType;
  // Broad color intent maps to base_ext_color (e.g. "Black", "White").
  // Reserve exterior_color for exact paint names (e.g. "Agate Black Metallic").
  if (f.exteriorColor) args.base_ext_color = f.exteriorColor;
  return args;
}

async function searchOnePage(params: LiveSearchParams, rows: number, start: number): Promise<LiveSearchResult> {
  maybeEvict(searchCache);
  const cacheKey = buildSearchCacheKey({ ...params, rows, start });
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.data, fromCache: true, latencyMs: 0 };
  }

  const t0 = Date.now();
  const raw = await callMcpTool<MCSearchResponse>('search_active_cars', buildSearchArgs(params, rows, start));
  const latencyMs = Date.now() - t0;

  if (!raw) {
    return { vehicles: [], numFound: 0, returned: 0, start, rows, fromCache: false, latencyMs };
  }

  // MCP wraps MarketCheck REST response in a `data` envelope
  const listings = raw.data?.listings ?? [];
  const numFound = raw.data?.num_found ?? 0;
  const normalized = listings.map(normalizeListing).filter((v): v is LiveVehicle => v !== null);
  const vehicles = applyClientFilters(normalized);

  console.log(JSON.stringify({
    event: 'mc_mcp_search_page',
    lat: params.latitude.toFixed(4),
    lng: params.longitude.toFixed(4),
    radiusMiles: params.radiusMiles,
    rows,
    start,
    numFound,
    returned: listings.length,
    normalized: normalized.length,
    afterFilter: vehicles.length,
    latencyMs,
  }));

  const result: LiveSearchResult = { vehicles, numFound, returned: listings.length, start, rows, fromCache: false, latencyMs };
  searchCache.set(cacheKey, { data: result, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  return result;
}

/**
 * Search live MarketCheck inventory using the MCP search_active_cars tool.
 * All filtering (including body type) is handled by the API using canonical
 * MarketCheck values. No client-side filtering or over-fetching needed.
 */
export async function searchActiveCarsMcp(params: LiveSearchParams): Promise<LiveSearchResult> {
  const targetRows = Math.min(params.rows ?? 25, 50);
  const start = Math.max(params.start ?? 0, 0);
  return searchOnePage(params, targetRows, start);
}

// --------------------------------------------------------------------------
// Public: bounds-to-radius helper (same as live-search.ts)
// --------------------------------------------------------------------------

export function boundsToRadiusMiles(bounds: { north: number; south: number; east: number; west: number }): number {
  const latSpanDeg = bounds.north - bounds.south;
  const lngSpanDeg = bounds.east - bounds.west;
  const centerLat = (bounds.north + bounds.south) / 2;
  const latMiles = (latSpanDeg / 2) * 69;
  const lngMiles = (lngSpanDeg / 2) * 69 * Math.cos((centerLat * Math.PI) / 180);
  return Math.max(5, Math.min(100, Math.round(Math.max(latMiles, lngMiles))));
}

// --------------------------------------------------------------------------
// Public: getVehicleDetailMcp
// Assembles a full DetailResponse by calling:
//   1. search_active_cars (by VIN) for current listing/photos
//   2. decode_vin_neovin  for build specs, features, options
//   3. get_car_history    for DOM and price changes
// --------------------------------------------------------------------------

function normalizeOptions(
  raw?: Array<{ name?: string; code?: string; description?: string } | string>,
): Array<{ name?: string; code?: string; description?: string }> | undefined {
  if (!raw?.length) return undefined;
  if (typeof raw[0] === 'string') return (raw as string[]).map((s) => ({ name: s }));
  return raw as Array<{ name?: string; code?: string; description?: string }>;
}

function normalizeDealerWebsite(raw?: string): string | undefined {
  if (!raw) return undefined;
  const site = raw.trim();
  const withProto = site.startsWith('http') ? site : `https://${site}`;
  try {
    new URL(withProto);
    return withProto;
  } catch {
    return undefined;
  }
}

export async function getVehicleDetailMcp(listingId: string, vin?: string): Promise<DetailResponse | null> {
  maybeEvict(detailCache);
  const cacheKey = listingId;
  const cached = detailCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const t0 = Date.now();

  // Three parallel MCP calls:
  // (a) search by listing ID / VIN to get current price, photos, dealer
  // (b) VIN decode for build specs (only if VIN available)
  // (c) car history for DOM and price changes
  const searchArgs: Record<string, unknown> = {
    rows: 1,
    start: 0,
    // Required to receive build.* and dealer.* objects in the response
    include_build_object: true,
    include_dealer_object: true,
  };
  if (vin) {
    searchArgs.vin = vin;
  } else {
    searchArgs.listing_id = listingId;
  }

  // Run all three calls; allow individual failures to return null without
  // aborting the others.
  const [searchRes, vinEnvelope, historyRaw] = await Promise.all([
    callMcpTool<MCSearchResponse>('search_active_cars', searchArgs).catch((e) => {
      console.error(JSON.stringify({ event: 'mc_detail_search_threw', error: String(e) }));
      return null;
    }),
    vin ? callMcpTool<MCVinDecodeEnvelope>('decode_vin_neovin', { vin }).catch((e) => {
      console.error(JSON.stringify({ event: 'mc_detail_vin_threw', error: String(e) }));
      return null;
    }) : Promise.resolve(null),
    callMcpTool<MCCarHistoryEntry[]>('get_car_history', vin ? { vin } : { listing_id: listingId }).catch((e) => {
      console.error(JSON.stringify({ event: 'mc_detail_history_threw', error: String(e) }));
      return null;
    }),
  ]);

  // MCP wraps the REST response in a `data` envelope for both search and VIN decode
  const listing: MCListing | null = searchRes?.data?.listings?.[0] ?? null;
  const vinData: MCVinDecodeResult | null = vinEnvelope?.data ?? null;
  // get_car_history returns a plain array (no wrapper)
  const historyList: MCCarHistoryEntry[] = Array.isArray(historyRaw) ? historyRaw : [];

  const latencyMs = Date.now() - t0;

  if (!listing && !vinData && historyList.length === 0) {
    console.error(JSON.stringify({ event: 'mc_mcp_detail_not_found', listingId, latencyMs }));
    return null;
  }

  // Build photo list for detail view.
  // Prefer dealer originals (photo_links) — they are the full-size gallery photos.
  // photo_links_cached are MarketCheck's lower-res copies of the same images, so
  // mixing both would show duplicates. Only fall back to cached if no dealer photos exist.
  const cachedPhotos = Array.isArray(listing?.media?.photo_links_cached) ? (listing!.media!.photo_links_cached as string[]).filter(Boolean) : [];
  const dealerPhotos = Array.isArray(listing?.media?.photo_links) ? (listing!.media!.photo_links as string[]).filter(Boolean) : [];
  const galleryPhotos = dealerPhotos.length > 0 ? dealerPhotos : cachedPhotos;
  // Ensure primary_photo_url is included if not already in the gallery
  const primaryPhoto = listing?.media?.primary_photo_url ?? listing?.media?.thumbnail?.url ?? galleryPhotos[0];
  const allPhotos = primaryPhoto && !galleryPhotos.includes(primaryPhoto)
    ? [primaryPhoto, ...galleryPhotos]
    : [...galleryPhotos];
  const allPhotosWithKey = allPhotos.map(withApiKey).filter((u): u is string => !!u);

  // Build features list — combine VIN decode + listing build info
  const buildFeatures: string[] = [];
  const buildSource = listing?.build ?? {};
  for (const field of [buildSource.drivetrain, buildSource.drive_train, buildSource.transmission, buildSource.fuel_type, buildSource.trim]) {
    if (field) buildFeatures.push(field);
  }
  // Guard against API returning features as object instead of array (causes spread TypeError)
  const safeArr = (v: unknown): string[] => Array.isArray(v) ? v as string[] : [];
  const vinFeatures = [...safeArr(vinData?.features), ...safeArr(vinData?.high_value_features)];
  const listingFeatures = safeArr(listing?.features);
  const allFeatures = [...new Set([...buildFeatures, ...vinFeatures, ...listingFeatures])];

  const rawOptions = Array.isArray(listing?.options) ? listing!.options : (Array.isArray(vinData?.options) ? vinData!.options : undefined);
  const options = normalizeOptions(rawOptions);

  // Condition
  let condition: 'new' | 'used' | 'certified' = 'used';
  if (listing?.inventory_type === 'new') condition = 'new';
  else if (listing?.inventory_type === 'cpo' || listing?.certified) condition = 'certified';

  // Prefer VIN decode for build fields since it has full manufacturer data
  const year = listing?.build?.year ?? vinData?.year ?? new Date().getFullYear();
  const make = listing?.build?.make ?? vinData?.make ?? 'Unknown';
  const model = listing?.build?.model ?? vinData?.model ?? 'Vehicle';
  const trim = listing?.build?.trim ?? vinData?.trim;
  const bodyType = listing?.build?.body_type ?? vinData?.body_type;
  const drivetrain = listing?.build?.drivetrain ?? listing?.build?.drive_train ?? vinData?.drivetrain ?? vinData?.drive_train;
  const fuelType = listing?.build?.fuel_type ?? vinData?.fuel_type;
  const transmission = listing?.build?.transmission ?? vinData?.transmission;
  const msrp = listing?.msrp ?? vinData?.msrp;
  const miles = listing?.miles ?? listing?.mileage;
  // history entries have `first_seen_at` (Unix seconds) — compute DOM if listing doesn't have it
  const domFromHistory = historyList.length > 0
    ? (() => {
        const earliest = historyList.reduce<number | null>((min, e) => {
          const t = e.first_seen_at;
          return typeof t === 'number' ? (min === null ? t : Math.min(min, t)) : min;
        }, null);
        return earliest != null ? Math.round((Date.now() / 1000 - earliest) / 86400) : undefined;
      })()
    : undefined;
  const dom = listing?.dom ?? domFromHistory;

  const dealerSource = listing?.dealer;
  const dealerAddress = [dealerSource?.street ?? dealerSource?.address, dealerSource?.city, dealerSource?.state, dealerSource?.zip].filter(Boolean).join(', ') || undefined;

  const response: DetailResponse = {
    id: listingId,
    vin: listing?.vin ?? vin,
    year,
    make,
    model,
    trim,
    condition,
    price: Math.max(listing?.price ?? 0, 0),
    msrp,
    miles: typeof miles === 'number' ? Math.max(miles, 0) : undefined,
    bodyType,
    exteriorColor: listing?.exterior_color,
    interiorColor: listing?.interior_color,
    drivetrain,
    fuelType,
    transmission,
    engine: vinData?.engine,
    cityMpg: vinData?.city_mpg,
    highwayMpg: vinData?.highway_mpg,
    seatingCapacity: vinData?.seating_capacity,
    powertrainType: vinData?.powertrain_type,
    sellerComments: listing?.seller_comments,
    description: listing?.description,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    options,
    photoUrls: allPhotosWithKey.length > 0 ? allPhotosWithKey : undefined,
    videoUrl: listing?.media?.video_url,
    daysOnMarket: typeof dom === 'number' ? dom : undefined,
    location: {
      latitude: normalizeLat(dealerSource?.latitude),
      longitude: normalizeLat(dealerSource?.longitude),
      dealerName: dealerSource?.name ?? 'Unknown Dealer',
      dealerCity: dealerSource?.city,
      dealerState: dealerSource?.state,
      dealerPhone: dealerSource?.phone_formatted ?? dealerSource?.phone,
      dealerWebsite: normalizeDealerWebsite(dealerSource?.website),
      dealerAddress,
      dealerRating: dealerSource?.rating,
      dealerReviewCount: dealerSource?.review_count,
      dealerHours: dealerSource?.hours,
    },
    enrichedAt: new Date().toISOString(),
    partial: !(listing && (vinData || allFeatures.length > 0)),
  };

  console.log(JSON.stringify({
    event: 'mc_mcp_detail_complete',
    listingId,
    partial: response.partial,
    hasListing: !!listing,
    hasVin: !!vinData,
    hasHistory: historyList.length > 0,
    photoCount: allPhotos.length,
    featureCount: allFeatures.length,
    latencyMs,
  }));

  detailCache.set(cacheKey, { data: response, expiresAt: Date.now() + DETAIL_CACHE_TTL_MS });
  return response;
}
