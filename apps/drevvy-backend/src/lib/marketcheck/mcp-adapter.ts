/**
 * MarketCheck MCP Adapter
 *
 * Translates internal search/detail requests into MarketCheck MCP tool calls
 * and normalizes the responses back into the DTOs the rest of the app uses
 * (LiveSearchResult and DetailResponse).
 *
 * Tool mapping:
 *   search    → search_active_cars
 *   one listing by id → GET /v2/listing/car/{listing_id}
 *   vin info  → Basic VIN decoder (GET /v2/decode/car/{vin}/specs)
 *   history   → get_car_history
 *
 * The normalization logic mirrors live-search.ts so existing callers see an
 * identical shape regardless of whether data came from REST or MCP.
 */

import { createHash } from 'node:crypto';

import { inspectClientPhoto, toClientPhotoUrl, type PhotoDropReason } from './photos';
import { redactSecrets } from './secrets';
import {
  callMcpTool,
  type McpCallOptions,
  McpQuotaError,
  McpRateLimitError,
} from './mcp-client';
import { fetchMarketCheckListing } from './listing-car';
import { decodeVinBasic, type BasicVinSpecs } from './vin-decode';

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
    photo_links?: string[] | string;
    photo_links_cached?: string[] | string;
    primary_photo_url?: string;
    photo_url?: string;
    thumbnail?: { url?: string } | string;
    video_url?: string;
  };
  /** Price-comparable rows use a single photo_url instead of media.photo_links. */
  photo_url?: string;
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
    dealer_type?: string;
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
  trim?: string;
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
  daysOnMarket?: number;
}

export interface LiveSearchResult {
  vehicles: LiveVehicle[];
  numFound: number;
  returned: number;
  start: number;
  rows: number;
  fromCache: boolean;
  latencyMs: number;
  /** True when MarketCheck returned no search envelope (HTTP/MCP failure), not a real zero-hit page. */
  upstreamFailed?: boolean;
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
    dealerZip?: string;
    dealerPhone?: string;
    dealerWebsite?: string;
    dealerAddress?: string;
    dealerRating?: number;
    dealerReviewCount?: number;
    dealerHours?: Record<string, string>;
  };
  dealerType?: 'franchise' | 'independent';
  enrichedAt: string;
  partial: boolean;
  /** Sections whose MarketCheck calls ran for this response. */
  loadedSections?: DetailSection[];
}

export type DetailSection = 'listing' | 'vin' | 'history';

const DETAIL_SECTIONS = new Set<DetailSection>(['listing', 'vin', 'history']);

/** Missing or blank means the listing shell only. VIN decode and history stay unloaded. */
export function parseDetailSections(raw: string | null | undefined): DetailSection[] | null {
  if (!raw || !raw.trim()) return ['listing'];
  const parts = raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
  const out: DetailSection[] = [];
  for (const part of parts) {
    if (!DETAIL_SECTIONS.has(part as DetailSection)) return null;
    const section = part as DetailSection;
    if (!out.includes(section)) out.push(section);
  }
  return out.length > 0 ? out : ['listing'];
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
 * Client photo URL. A dealer or public URL that carries a secret is dropped.
 * Hosts that require the key are rewritten to the photo proxy, which adds
 * the credential server-side.
 */
function clientPhoto(url: string | undefined): string | undefined {
  return toClientPhotoUrl(url);
}

function photoUrlValues(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) urls.push(item);
  }
  return urls;
}

function firstPhoto(...urls: Array<string | undefined>): string | undefined {
  for (const url of urls) {
    if (typeof url === 'string' && url.trim()) return url;
  }
  return undefined;
}

function thumbnailSource(media: MCListing['media']): string | undefined {
  const thumbnail = media?.thumbnail;
  if (typeof thumbnail === 'string') return thumbnail;
  return thumbnail?.url;
}

function uniqueClientPhotos(urls: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const client = clientPhoto(raw);
    if (!client || seen.has(client)) continue;
    seen.add(client);
    out.push(client);
  }
  return out;
}

/**
 * Dealer photo_links are the full-size gallery. Cached copies, primary_photo_url,
 * and photo_url are the same pictures, so they are used only when every dealer
 * URL is dropped. An empty gallery is undefined so `photoUrls ?? primary` can run.
 */
export type ListingPhotoCounts = {
  photoLinks: number;
  photoLinksCached: number;
  primary: number;
  kept: number;
  rejected: Record<PhotoDropReason, number>;
  /** Sanitized rejected query names, most frequent first, at most five. */
  queryNames: string[];
};

type PhotoTally = {
  counts: Omit<ListingPhotoCounts, 'queryNames'>;
  nameCounts: Map<string, number>;
};

function emptyPhotoCounts(): Omit<ListingPhotoCounts, 'queryNames'> {
  return {
    photoLinks: 0,
    photoLinksCached: 0,
    primary: 0,
    kept: 0,
    rejected: { scheme: 0, host: 0, query: 0, other: 0 },
  };
}

function topQueryNames(nameCounts: Map<string, number>): string[] {
  return [...nameCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([name]) => name);
}

/** Array length, one string, or one object. Missing and blank are zero. */
function photoFieldEntries(value: unknown): unknown[] {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function tallyPhotoEntries(entries: unknown[], tally: PhotoTally, now: number): void {
  for (const entry of entries) {
    if (typeof entry !== 'string' || !entry.trim()) {
      tally.counts.rejected.other += 1;
      continue;
    }
    const inspected = inspectClientPhoto(entry, now);
    if (inspected.url) tally.counts.kept += 1;
    else tally.counts.rejected[inspected.reason ?? 'other'] += 1;
    if (inspected.reason === 'query') {
      for (const name of inspected.queryNames) {
        tally.nameCounts.set(name, (tally.nameCounts.get(name) ?? 0) + 1);
      }
    }
  }
}

function tallyListingPhotos(
  listing: { media?: { photo_links?: unknown; photo_links_cached?: unknown; primary_photo_url?: unknown } } | null | undefined,
  now = Date.now(),
): PhotoTally {
  const tally: PhotoTally = { counts: emptyPhotoCounts(), nameCounts: new Map() };
  const media = listing?.media;
  const dealer = photoFieldEntries(media?.photo_links);
  const cached = photoFieldEntries(media?.photo_links_cached);
  const primary = photoFieldEntries(media?.primary_photo_url);
  tally.counts.photoLinks = dealer.length;
  tally.counts.photoLinksCached = cached.length;
  tally.counts.primary = primary.length;
  tallyPhotoEntries(dealer, tally, now);
  tallyPhotoEntries(cached, tally, now);
  tallyPhotoEntries(primary, tally, now);
  return tally;
}

/**
 * Raw photo_links, photo_links_cached, and primary_photo_url counts, plus how
 * many of those values were kept or rejected. Query names are sanitized.
 * No URLs, hosts, or values.
 */
export function summarizeListingPhotos(
  listing: { media?: { photo_links?: unknown; photo_links_cached?: unknown; primary_photo_url?: unknown } } | null | undefined,
  now = Date.now(),
): ListingPhotoCounts {
  const tally = tallyListingPhotos(listing, now);
  return { ...tally.counts, queryNames: topQueryNames(tally.nameCounts) };
}

function photoLogId(id: string | undefined): string | undefined {
  if (!id || !id.trim()) return undefined;
  return createHash('sha256').update(id).digest('hex').slice(0, 12);
}

function photoCountFields(counts: Omit<ListingPhotoCounts, 'queryNames'>, queryNames: string[]) {
  return {
    photoLinks: counts.photoLinks,
    photoLinksCached: counts.photoLinksCached,
    primary: counts.primary,
    kept: counts.kept,
    rejected: counts.rejected,
    queryNames,
  };
}

/** One line for a search page. Summed counts and the top rejected query names. */
function logSearchPhotoPage(listings: readonly MCListing[]): void {
  const totals = emptyPhotoCounts();
  const nameCounts = new Map<string, number>();
  for (const listing of listings) {
    const tally = tallyListingPhotos(listing);
    totals.photoLinks += tally.counts.photoLinks;
    totals.photoLinksCached += tally.counts.photoLinksCached;
    totals.primary += tally.counts.primary;
    totals.kept += tally.counts.kept;
    totals.rejected.scheme += tally.counts.rejected.scheme;
    totals.rejected.host += tally.counts.rejected.host;
    totals.rejected.query += tally.counts.rejected.query;
    totals.rejected.other += tally.counts.rejected.other;
    for (const [name, count] of tally.nameCounts) {
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + count);
    }
  }
  console.log(JSON.stringify({
    event: 'mc_listing_photos',
    source: 'search',
    ...photoCountFields(totals, topQueryNames(nameCounts)),
  }));
}

/** Detail only. The id is a 12-char hash, never a VIN, URL, or host. */
function logListingPhotos(listing: MCListing | null | undefined, id: string | undefined): void {
  const counts = summarizeListingPhotos(listing);
  const hashed = photoLogId(id);
  console.log(JSON.stringify({
    event: 'mc_listing_photos',
    source: 'detail',
    ...(hashed ? { id: hashed } : {}),
    photoLinks: counts.photoLinks,
    photoLinksCached: counts.photoLinksCached,
    primary: counts.primary,
    kept: counts.kept,
    rejected: counts.rejected,
    queryNames: counts.queryNames,
  }));
}

function listingClientPhotos(listing: MCListing | null | undefined): {
  photoUrls?: string[];
  primaryPhotoUrl?: string;
  thumbnailUrl?: string;
} {
  const media = listing?.media;
  const dealerRaw = photoUrlValues(media?.photo_links);
  const cachedRaw = photoUrlValues(media?.photo_links_cached);
  const primaryRaw = firstPhoto(media?.primary_photo_url, media?.photo_url, listing?.photo_url);
  const dealer = uniqueClientPhotos(dealerRaw);
  const cached = uniqueClientPhotos(cachedRaw);
  const gallery = dealer.length > 0
    ? dealer
    : cached.length > 0
      ? cached
      : uniqueClientPhotos([primaryRaw, thumbnailSource(media)]);
  const thumbnailUrl = clientPhoto(firstPhoto(cachedRaw[0], dealerRaw[0], primaryRaw, thumbnailSource(media)));
  return {
    photoUrls: gallery.length > 0 ? gallery : undefined,
    primaryPhotoUrl: gallery[0] ?? thumbnailUrl,
    thumbnailUrl,
  };
}

function normalizeListing(listing: MCListing): LiveVehicle | null {
  const lat = normalizeLat(listing.dealer?.latitude);
  const lng = normalizeLat(listing.dealer?.longitude);
  if (lat === undefined || lng === undefined) return null;

  const photos = listingClientPhotos(listing);
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
    thumbnailUrl: photos.thumbnailUrl,
    primaryPhotoUrl: photos.primaryPhotoUrl,
    photoUrls: photos.photoUrls,
    daysOnMarket: typeof listing.dom === 'number' && listing.dom >= 0 ? Math.round(listing.dom) : undefined,
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
  if (f.trim) args.trim = f.trim;
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

async function searchOnePage(
  params: LiveSearchParams,
  rows: number,
  start: number,
  options?: McpCallOptions,
): Promise<LiveSearchResult> {
  const t0 = Date.now();
  const raw = await callMcpTool<MCSearchResponse>(
    'search_active_cars',
    buildSearchArgs(params, rows, start),
    8000,
    options,
  );
  const latencyMs = Date.now() - t0;

  if (!raw || raw.data == null) {
    console.error(JSON.stringify({
      event: 'mc_mcp_search_empty_envelope',
      lat: params.latitude.toFixed(4),
      lng: params.longitude.toFixed(4),
      radiusMiles: params.radiusMiles,
      latencyMs,
    }));
    return { vehicles: [], numFound: 0, returned: 0, start, rows, fromCache: false, latencyMs, upstreamFailed: true };
  }

  // MCP wraps MarketCheck REST response in a `data` envelope
  const listings = raw.data?.listings ?? [];
  const numFound = raw.data?.num_found ?? 0;
  logSearchPhotoPage(listings);
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

  return { vehicles, numFound, returned: listings.length, start, rows, fromCache: false, latencyMs };
}

/**
 * Search live MarketCheck inventory using the MCP search_active_cars tool.
 * All filtering (including body type) is handled by the API using canonical
 * MarketCheck values. No client-side filtering or over-fetching needed.
 */
export async function searchActiveCarsMcp(
  params: LiveSearchParams,
  options?: McpCallOptions,
): Promise<LiveSearchResult> {
  const targetRows = Math.min(params.rows ?? 25, 50);
  const start = Math.max(params.start ?? 0, 0);
  return searchOnePage(params, targetRows, start, options);
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
// A listing id is loaded with GET /v2/listing/car/{listing_id}. A VIN-only
// shell still uses search_active_cars. The Basic VIN decoder and
// get_car_history run only when `sections` includes `vin` or `history`.
// MarketCheck Price is not loaded here.
// --------------------------------------------------------------------------

function normalizeOptions(
  raw?: Array<{ name?: string; code?: string; description?: string } | string>,
): Array<{ name?: string; code?: string; description?: string }> | undefined {
  if (!raw?.length) return undefined;
  if (typeof raw[0] === 'string') return (raw as string[]).map((s) => ({ name: s }));
  return raw as Array<{ name?: string; code?: string; description?: string }>;
}

function dealerPostalCode(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '').slice(0, 5);
  return digits.length === 5 ? digits : undefined;
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

function safeError(error: unknown): string {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

async function loadListingShell(listingId: string, vin?: string): Promise<MCListing | null> {
  if (vin) {
    const searchRes = await callMcpTool<MCSearchResponse>('search_active_cars', {
      rows: 1,
      start: 0,
      include_build_object: true,
      include_dealer_object: true,
      vin,
    }, 8000, { strict: true });
    return searchRes?.data?.listings?.[0] ?? null;
  }
  const listing = await fetchMarketCheckListing(listingId);
  return listing as MCListing | null;
}

export async function getVehicleDetailMcp(
  listingId: string,
  vin?: string,
  sections?: readonly DetailSection[],
): Promise<DetailResponse | null> {
  const wanted = new Set<DetailSection>(sections && sections.length > 0 ? sections : ['listing']);
  const wantListing = wanted.has('listing');
  const wantVin = wanted.has('vin');
  const wantHistory = wanted.has('history');
  const t0 = Date.now();

  // (a) one listing by id, or a VIN search when no listing id was used
  // (b) Basic VIN decode for specs-card fields (only when that section is open)
  // (c) car history for DOM and price changes (only when that section is open)

  // Listing is the VDP shell. VIN decode and history run only when that
  // section was requested, so opening the page does not pay for them.
  const needListing = wantListing || (wantVin && !vin);
  const [listingShell, vinSpecsFirst, historyRaw] = await Promise.all([
    needListing ? loadListingShell(listingId, vin) : Promise.resolve(null),
    wantVin && vin ? decodeVinBasic(vin).catch((e) => {
      console.error(JSON.stringify({ event: 'mc_detail_vin_threw', error: safeError(e) }));
      return null;
    }) : Promise.resolve(null),
    wantHistory ? callMcpTool<MCCarHistoryEntry[]>('get_car_history', vin ? { vin } : { listing_id: listingId }).catch((e) => {
      console.error(JSON.stringify({ event: 'mc_detail_history_threw', error: safeError(e) }));
      return null;
    }) : Promise.resolve(null),
  ]);

  let vinData: BasicVinSpecs | null = vinSpecsFirst;
  if (wantVin && !vin) {
    const discovered = typeof listingShell?.vin === 'string' ? listingShell.vin : undefined;
    if (discovered) {
      vinData = await decodeVinBasic(discovered).catch((e) => {
        console.error(JSON.stringify({ event: 'mc_detail_vin_threw', error: safeError(e) }));
        return null;
      });
    }
  }

  // MCP wraps the search response in a `data` envelope. Basic decode is already mapped.
  const listing: MCListing | null = listingShell;
  // get_car_history returns a plain array (no wrapper)
  const historyList: MCCarHistoryEntry[] = Array.isArray(historyRaw) ? historyRaw : [];

  const latencyMs = Date.now() - t0;

  if (!listing && !vinData && historyList.length === 0) {
    console.error(JSON.stringify({ event: 'mc_mcp_detail_not_found', listingId, latencyMs }));
    return null;
  }

  const photos = listingClientPhotos(listing);
  const detailId = typeof listing?.id === 'string' && listing.id.trim() ? listing.id : listingId;
  logListingPhotos(listing, detailId);

  // Build features list — combine VIN decode + listing build info
  const buildFeatures: string[] = [];
  const buildSource = listing?.build ?? {};
  for (const field of [buildSource.drivetrain, buildSource.drive_train, buildSource.transmission, buildSource.fuel_type, buildSource.trim]) {
    if (field) buildFeatures.push(field);
  }
  // Guard against API returning features as object instead of array (causes spread TypeError)
  const safeArr = (v: unknown): string[] => Array.isArray(v) ? v as string[] : [];
  const listingFeatures = safeArr(listing?.features);
  const allFeatures = [...new Set([...buildFeatures, ...listingFeatures])];

  const rawOptions = Array.isArray(listing?.options) ? listing!.options : undefined;
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
  const bodyType = listing?.build?.body_type ?? vinData?.bodyType;
  const drivetrain = listing?.build?.drivetrain ?? listing?.build?.drive_train ?? vinData?.drivetrain;
  const fuelType = listing?.build?.fuel_type ?? vinData?.fuelType;
  const transmission = listing?.build?.transmission ?? vinData?.transmission;
  const msrp = listing?.msrp;
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

  const returnedListingId = typeof listing?.id === 'string' ? listing.id.trim() : '';
  // A VIN search must keep the id MarketCheck returned. The caller's id is
  // only a label when the search itself was by that listing id.
  const id = vin ? returnedListingId : (returnedListingId || listingId);

  const response: DetailResponse = {
    id,
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
    cityMpg: vinData?.cityMpg,
    highwayMpg: vinData?.highwayMpg,
    seatingCapacity: vinData?.seatingCapacity,
    powertrainType: vinData?.powertrainType,
    sellerComments: listing?.seller_comments,
    description: listing?.description,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    options,
    photoUrls: photos.photoUrls,
    videoUrl: listing?.media?.video_url,
    daysOnMarket: typeof dom === 'number' ? dom : undefined,
    location: {
      latitude: normalizeLat(dealerSource?.latitude),
      longitude: normalizeLat(dealerSource?.longitude),
      dealerName: dealerSource?.name ?? 'Unknown Dealer',
      dealerCity: dealerSource?.city,
      dealerState: dealerSource?.state,
      dealerZip: dealerPostalCode(dealerSource?.zip),
      dealerPhone: dealerSource?.phone_formatted ?? dealerSource?.phone,
      dealerWebsite: normalizeDealerWebsite(dealerSource?.website),
      dealerAddress,
      dealerRating: dealerSource?.rating,
      dealerReviewCount: dealerSource?.review_count,
      dealerHours: dealerSource?.hours,
    },
    dealerType: dealerSource?.dealer_type === 'independent' || dealerSource?.dealer_type === 'franchise'
      ? dealerSource.dealer_type
      : undefined,
    enrichedAt: new Date().toISOString(),
    partial: (needListing && !listing) || (wantVin && !vinData) || (wantHistory && historyList.length === 0),
    loadedSections: [
      ...(needListing && listing ? ['listing' as const] : []),
      ...(wantVin && vinData ? ['vin' as const] : []),
      ...(wantHistory && historyList.length > 0 ? ['history' as const] : []),
    ],
  };

  console.log(JSON.stringify({
    event: 'mc_mcp_detail_complete',
    listingId,
    partial: response.partial,
    hasListing: !!listing,
    hasVin: !!vinData,
    hasHistory: historyList.length > 0,
    photoCount: photos.photoUrls?.length ?? 0,
    featureCount: allFeatures.length,
    latencyMs,
    sections: [...wanted],
  }));

  return response;
}
