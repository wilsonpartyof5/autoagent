/**
 * Shared inventory parse-to-search steps for POST /api/query/chat-search and
 * POST /api/consumer/ask. Chat-search keeps its own auth, reply, and response
 * shape. Ask passes quiet: true so this function does not log the shopper text.
 */

import { marketCheckSubject, withMarketCheckContext } from '@/lib/marketcheck/context';
import {
  searchActiveCarsMcp,
  MarketCheckQuotaError,
  MarketCheckRateLimitError,
  type LiveSearchFilters,
  type LiveSearchResult,
  type LiveVehicle,
} from '@/lib/marketcheck/mcp-adapter';
import { redactSecrets } from '@/lib/marketcheck/secrets';

import {
  geocodeLocation,
  validateAndNormalize,
  type ApiCompatibleFilters,
  type LocationData,
  type ParseOpenAIResult,
} from './parse-inventory-query';
import {
  resolveCanonicalFilters,
  type CanonicalFilters,
} from './resolve-canonical-filters';

export const DEFAULT_SEARCH_RADIUS_MILES = 25;

export type InventorySearchSuccess = {
  ok: true;
  location?: LocationData;
  center: { latitude: number; longitude: number };
  incomingFilters: ApiCompatibleFilters;
  mergedFilters: ApiCompatibleFilters;
  canonicalFilters: CanonicalFilters;
  searchFilters: LiveSearchFilters;
  liveVehicles: LiveVehicle[];
  total: number;
  /** True when MarketCheck returned no search envelope. Chat-search ignores this. */
  upstreamFailed: boolean;
};

export type InventorySearchFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  retryAfter?: number;
};

export async function searchResolvedInventory(input: {
  query: string;
  parseResult: ParseOpenAIResult;
  userLocation?: { latitude: number; longitude: number };
  previousFilters?: CanonicalFilters;
  previousLocation?: { latitude: number; longitude: number; raw?: string };
  origin: string;
  subjectHeader: string | null;
  subjectUserId?: string;
  rows?: number;
  /** Ask sets this so the shopper message is not written to logs. */
  quiet?: boolean;
  geocode?: (locationText: string) => Promise<LocationData | null>;
  resolveCanonical?: typeof resolveCanonicalFilters;
  search?: (params: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
    filters?: LiveSearchFilters;
    rows?: number;
    start?: number;
  }) => Promise<LiveSearchResult>;
}): Promise<InventorySearchSuccess | InventorySearchFailure> {
  const prev = input.previousFilters ?? {};
  const prevLocation = input.previousLocation;
  const { filters, apiCompatibleFilters } = validateAndNormalize(
    input.parseResult.filters,
    input.parseResult.explicitFields,
  );

  if (!input.quiet) {
    console.log(JSON.stringify({
      event: 'chat_search_incoming',
      query: input.query.substring(0, 80),
      incomingFilters: apiCompatibleFilters,
      previousFilters: Object.keys(prev).length > 0 ? prev : null,
      hasPreviousLocation: !!prevLocation,
    }));
  }

  let location: LocationData | undefined;
  if (filters.locationText) {
    try {
      const geocoded = await (input.geocode ?? geocodeLocation)(filters.locationText);
      if (geocoded) location = geocoded;
    } catch {
      // Non-fatal — fall back to userLocation
    }
  }

  const center = location
    ? { latitude: location.lat, longitude: location.lng }
    : input.userLocation
      ?? (prevLocation ? { latitude: prevLocation.latitude, longitude: prevLocation.longitude } : undefined);

  if (!location && prevLocation?.raw) {
    location = {
      raw: prevLocation.raw,
      lat: prevLocation.latitude,
      lng: prevLocation.longitude,
      source: 'geocode',
    };
  }

  if (!center || (Math.abs(center.latitude) < 0.01 && Math.abs(center.longitude) < 0.01)) {
    return {
      ok: false,
      status: 400,
      code: 'LOCATION_REQUIRED',
      message: 'A location is needed to search inventory. Please mention a city/ZIP in your query or enable device location.',
    };
  }

  const explicitSet = new Set(input.parseResult.explicitFields);
  const mergedFilters: ApiCompatibleFilters = {
    ...prev,
    ...(explicitSet.has('make') && apiCompatibleFilters.make !== undefined ? { make: apiCompatibleFilters.make } : {}),
    ...(explicitSet.has('model') && apiCompatibleFilters.model !== undefined ? { model: apiCompatibleFilters.model } : {}),
    ...(explicitSet.has('bodyType') && apiCompatibleFilters.bodyType !== undefined ? { bodyType: apiCompatibleFilters.bodyType } : {}),
    ...(explicitSet.has('condition') && apiCompatibleFilters.condition !== undefined ? { condition: apiCompatibleFilters.condition } : {}),
    ...(explicitSet.has('minPrice') && apiCompatibleFilters.minPrice !== undefined ? { minPrice: apiCompatibleFilters.minPrice } : {}),
    ...(explicitSet.has('maxPrice') && apiCompatibleFilters.maxPrice !== undefined ? { maxPrice: apiCompatibleFilters.maxPrice } : {}),
    ...(explicitSet.has('maxMiles') && apiCompatibleFilters.maxMiles !== undefined ? { maxMiles: apiCompatibleFilters.maxMiles } : {}),
    ...(explicitSet.has('year') && apiCompatibleFilters.year !== undefined ? { year: apiCompatibleFilters.year } : {}),
    ...(explicitSet.has('minYear') && apiCompatibleFilters.minYear !== undefined ? { minYear: apiCompatibleFilters.minYear } : {}),
    ...(explicitSet.has('maxYear') && apiCompatibleFilters.maxYear !== undefined ? { maxYear: apiCompatibleFilters.maxYear } : {}),
    ...(explicitSet.has('exteriorColor') && apiCompatibleFilters.exteriorColor !== undefined ? { exteriorColor: apiCompatibleFilters.exteriorColor } : {}),
    ...(explicitSet.has('seatingCapacity') && apiCompatibleFilters.seatingCapacity !== undefined ? { seatingCapacity: apiCompatibleFilters.seatingCapacity } : {}),
    ...(explicitSet.has('powertrainType') && apiCompatibleFilters.powertrainType !== undefined ? { powertrainType: apiCompatibleFilters.powertrainType } : {}),
  };

  if (!input.quiet) {
    console.log(JSON.stringify({
      event: 'chat_search_merged',
      query: input.query.substring(0, 80),
      mergedFilters,
      explicitFields: input.parseResult.explicitFields,
    }));
  }

  let canonicalFilters: CanonicalFilters = { ...mergedFilters };
  try {
    const resolved = await (input.resolveCanonical ?? resolveCanonicalFilters)(mergedFilters, {
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMiles: DEFAULT_SEARCH_RADIUS_MILES,
    });
    canonicalFilters = resolved.canonicalFilters;
  } catch (err) {
    if (!input.quiet) {
      console.error('[chat-search] Canonical resolution failed (non-fatal):', err);
    }
  }

  const searchFilters: LiveSearchFilters = {};
  if (canonicalFilters.make) searchFilters.make = canonicalFilters.make;
  if (canonicalFilters.model) searchFilters.model = canonicalFilters.model;
  if (canonicalFilters.year) searchFilters.year = canonicalFilters.year;
  if (canonicalFilters.minYear) searchFilters.minYear = canonicalFilters.minYear;
  if (canonicalFilters.maxYear) searchFilters.maxYear = canonicalFilters.maxYear;
  if (canonicalFilters.minPrice) searchFilters.minPrice = canonicalFilters.minPrice;
  if (canonicalFilters.maxPrice) searchFilters.maxPrice = canonicalFilters.maxPrice;
  if (canonicalFilters.maxMiles) searchFilters.maxMiles = canonicalFilters.maxMiles;
  if (canonicalFilters.condition) searchFilters.condition = canonicalFilters.condition;
  if (canonicalFilters.bodyType) searchFilters.bodyType = canonicalFilters.bodyType;
  if (canonicalFilters.seatingCapacity) searchFilters.seatingCapacity = canonicalFilters.seatingCapacity;
  if (canonicalFilters.powertrainType) searchFilters.powertrainType = canonicalFilters.powertrainType;
  if (canonicalFilters.exteriorColor) searchFilters.exteriorColor = canonicalFilters.exteriorColor;

  const subject = input.subjectUserId
    ? marketCheckSubject(input.subjectUserId, null)
    : marketCheckSubject(undefined, input.subjectHeader);

  let searchResult: LiveSearchResult;
  try {
    searchResult = await withMarketCheckContext(
      { origin: input.origin, subject },
      () => (input.search ?? searchActiveCarsMcp)({
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMiles: DEFAULT_SEARCH_RADIUS_MILES,
        filters: searchFilters,
        rows: input.rows ?? 25,
        start: 0,
      }),
    );
  } catch (error) {
    if (error instanceof MarketCheckQuotaError) {
      if (!input.quiet) {
        console.error(JSON.stringify({
          event: 'marketcheck_quota_exceeded',
          message: '🚫 Monthly MarketCheck API quota exhausted — all MCP calls will return 402 until the quota resets.',
          query: input.query.substring(0, 60),
        }));
      }
      return { ok: false, status: 503, code: error.code, message: error.message };
    }
    if (error instanceof MarketCheckRateLimitError) {
      if (!input.quiet) {
        console.warn(JSON.stringify({
          event: 'marketcheck_rate_limited',
          retryAfter: error.retryAfter,
          query: input.query.substring(0, 60),
        }));
      }
      return {
        ok: false,
        status: 429,
        code: error.code,
        message: error.message,
        retryAfter: error.retryAfter,
      };
    }
    if (!input.quiet) {
      console.error(JSON.stringify({
        event: 'chat_search_mcp_error',
        error: redactSecrets(error instanceof Error ? error.message : String(error)),
      }));
    }
    return {
      ok: false,
      status: 500,
      code: 'SEARCH_ERROR',
      message: 'Failed to search inventory. Please try again.',
    };
  }

  const liveVehicles = searchResult.vehicles;
  const total = searchResult.numFound > 0 ? searchResult.numFound : liveVehicles.length;
  return {
    ok: true,
    location,
    center,
    incomingFilters: apiCompatibleFilters,
    mergedFilters,
    canonicalFilters,
    searchFilters,
    liveVehicles,
    total,
    upstreamFailed: searchResult.upstreamFailed === true,
  };
}
