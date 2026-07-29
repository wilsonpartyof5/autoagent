import { NextRequest, NextResponse } from 'next/server';
import {
  searchActiveCarsMcp as searchLiveInventory,
  boundsToRadiusMiles,
  MarketCheckQuotaError,
  MarketCheckRateLimitError,
  type LiveSearchFilters,
} from '@/lib/marketcheck/mcp-adapter';

/**
 * POST /api/inventory/search
 *
 * Live MarketCheck Inventory Search — MVP consumer discovery mode.
 * Does NOT require any dealership to be signed up.
 *
 * Request JSON:
 * {
 *   "bounds": { "north": 34.9855, "south": 34.9123, "east": -80.9234, "west": -81.0123 },
 *   "filters": { "minPrice": 20000, "maxPrice": 80000, "make": "GMC", "model": "Sierra", "condition": "new" },
 *   "pagination": { "page": 1, "limit": 25 },
 *   "userLocation": { "latitude": 34.95, "longitude": -80.98 }  // strongly recommended
 * }
 *
 * Response JSON:
 * {
 *   "success": true,
 *   "data": {
 *     "vehicles": [...],
 *     "pagination": { "page": 1, "limit": 25, "total": 232, "totalPages": 10, "hasNextPage": true, "hasPreviousPage": false }
 *   }
 * }
 */

// -------------------------------------------------------------------------
// Constants / Config
// -------------------------------------------------------------------------

const MAX_ROWS = 50;
const DEFAULT_ROWS = 25;
// Maximum page depth allowed (prevents deep & expensive pagination)
const MAX_PAGE = 20;

// -------------------------------------------------------------------------
// Request / Response types
// -------------------------------------------------------------------------

interface SearchRequest {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    make?: string;
    model?: string;
    year?: number;
    minYear?: number;
    maxYear?: number;
    maxMiles?: number;
    condition?: 'new' | 'used' | 'certified';
    bodyType?: string;
    dealerId?: string;
  };
  pagination?: {
    page?: number;
    limit?: number;
  };
  userLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface VehicleResponse {
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

// -------------------------------------------------------------------------
// Auth
// -------------------------------------------------------------------------

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  if (!apiKey) return false;

  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) return true;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.substring(7) === apiKey) return true;

  return false;
}

// -------------------------------------------------------------------------
// Route handler
// -------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const reqStart = Date.now();
  let queryHash = '';

  try {
    if (!validateApiKey(request)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing API key. Provide x-api-key header or Authorization: Bearer <key>',
          },
        },
        { status: 401 },
      );
    }

    // -----------------------------------------------------------------------
    // Parse body
    // -----------------------------------------------------------------------
    let body: SearchRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Invalid JSON in request body' },
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Validate bounds (required)
    // -----------------------------------------------------------------------
    if (!body.bounds || typeof body.bounds !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BOUNDS',
            message: 'bounds are required (north, south, east, west)',
          },
        },
        { status: 400 },
      );
    }

    const { north, south, east, west } = body.bounds;

    if (
      typeof north !== 'number' ||
      typeof south !== 'number' ||
      typeof east !== 'number' ||
      typeof west !== 'number' ||
      isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_BOUNDS', message: 'Bounds must be valid numbers (north, south, east, west)' },
        },
        { status: 400 },
      );
    }

    if (north <= south || east <= west) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_BOUNDS', message: 'Invalid bounds: north must be > south, east must be > west' },
        },
        { status: 400 },
      );
    }

    if (north > 90 || south < -90 || east > 180 || west < -180) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_BOUNDS', message: 'Bounds out of valid range: latitude [-90, 90], longitude [-180, 180]' },
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Location gating
    // Location is required for useful live results. Prefer explicit
    // userLocation; fall back to bounds center. If neither resolves to a
    // plausible area, ask the client to provide one.
    // -----------------------------------------------------------------------
    const boundsCenter = {
      latitude: (north + south) / 2,
      longitude: (east + west) / 2,
    };

    const searchCenter = body.userLocation ?? boundsCenter;

    // Reject zero-island (0, 0) centers that slip through — no inventory there
    if (
      Math.abs(searchCenter.latitude) < 0.01 &&
      Math.abs(searchCenter.longitude) < 0.01
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LOCATION_REQUIRED',
            message:
              'A valid location is required to search inventory. Please enable location services or enter a ZIP code / city name.',
          },
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Validate userLocation if provided
    // -----------------------------------------------------------------------
    if (body.userLocation) {
      const { latitude, longitude } = body.userLocation;
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        isNaN(latitude) || isNaN(longitude) ||
        latitude < -90 || latitude > 90 ||
        longitude < -180 || longitude > 180
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_USER_LOCATION',
              message: 'userLocation must have valid latitude [-90, 90] and longitude [-180, 180]',
            },
          },
          { status: 400 },
        );
      }
    }

    // -----------------------------------------------------------------------
    // Validate pagination — cap page depth to avoid expensive deep fetches
    // -----------------------------------------------------------------------
    const page = Math.max(body.pagination?.page ?? 1, 1);
    const limit = Math.min(Math.max(body.pagination?.limit ?? DEFAULT_ROWS, 1), MAX_ROWS);

    if (page > MAX_PAGE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PAGINATION',
            message: `Page must be <= ${MAX_PAGE} for live inventory search`,
          },
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Validate filters
    // -----------------------------------------------------------------------
    if (body.filters) {
      const { minPrice, maxPrice, year, minYear, maxYear, maxMiles } = body.filters;

      if (minPrice !== undefined && (typeof minPrice !== 'number' || minPrice < 0))
        return badFilter('minPrice must be a non-negative number');
      if (maxPrice !== undefined && (typeof maxPrice !== 'number' || maxPrice < 0))
        return badFilter('maxPrice must be a non-negative number');
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
        return badFilter('minPrice must be <= maxPrice');

      if (year !== undefined && (typeof year !== 'number' || year < 1900 || year > 2100))
        return badFilter('year must be between 1900 and 2100');
      if (minYear !== undefined && (typeof minYear !== 'number' || minYear < 1900 || minYear > 2100))
        return badFilter('minYear must be between 1900 and 2100');
      if (maxYear !== undefined && (typeof maxYear !== 'number' || maxYear < 1900 || maxYear > 2100))
        return badFilter('maxYear must be between 1900 and 2100');
      if (minYear !== undefined && maxYear !== undefined && minYear > maxYear)
        return badFilter('minYear must be <= maxYear');

      if (maxMiles !== undefined && (typeof maxMiles !== 'number' || maxMiles < 0))
        return badFilter('maxMiles must be a non-negative number');

      if (body.filters.condition && !['new', 'used', 'certified'].includes(body.filters.condition))
        return badFilter('condition must be one of: new, used, certified');
    }

    // -----------------------------------------------------------------------
    // Build live-search params
    // -----------------------------------------------------------------------
    const radiusMiles = boundsToRadiusMiles({ north, south, east, west });
    const start = (page - 1) * limit;

    const filters: LiveSearchFilters = {};
    if (body.filters?.make) filters.make = body.filters.make;
    if (body.filters?.model) filters.model = body.filters.model;
    if (body.filters?.year) filters.year = body.filters.year;
    if (body.filters?.minYear) filters.minYear = body.filters.minYear;
    if (body.filters?.maxYear) filters.maxYear = body.filters.maxYear;
    if (body.filters?.minPrice) filters.minPrice = body.filters.minPrice;
    if (body.filters?.maxPrice) filters.maxPrice = body.filters.maxPrice;
    if (body.filters?.maxMiles) filters.maxMiles = body.filters.maxMiles;
    if (body.filters?.condition) filters.condition = body.filters.condition;
    if (body.filters?.bodyType) filters.bodyType = body.filters.bodyType;

    // Build a short query hash for log correlation
    queryHash = Buffer.from(
      `${searchCenter.latitude.toFixed(3)},${searchCenter.longitude.toFixed(3)},${radiusMiles},${start},${limit},${JSON.stringify(filters)}`,
    )
      .toString('base64')
      .substring(0, 12);

    console.log(JSON.stringify({
      event: 'inventory_search_start',
      queryHash,
      lat: searchCenter.latitude.toFixed(4),
      lng: searchCenter.longitude.toFixed(4),
      radiusMiles,
      page,
      limit,
      start,
      hasFilters: Object.keys(filters).length > 0,
      locationMode: body.userLocation ? 'gps' : 'bounds_center',
    }));

    // -----------------------------------------------------------------------
    // Perform live search
    // -----------------------------------------------------------------------
    const searchResult = await searchLiveInventory({
      latitude: searchCenter.latitude,
      longitude: searchCenter.longitude,
      radiusMiles,
      filters,
      rows: limit,
      start,
    });

    // -----------------------------------------------------------------------
    // Map to response contract
    // -----------------------------------------------------------------------
    const vehicles: VehicleResponse[] = searchResult.vehicles.map((v) => ({
      id: v.id,
      vin: v.vin,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      condition: v.condition,
      price: v.price,
      msrp: v.msrp,
      miles: v.miles,
      bodyType: v.bodyType,
      thumbnailUrl: v.thumbnailUrl,
      primaryPhotoUrl: v.primaryPhotoUrl,
      photoUrls: v.photoUrls,
      location: v.location,
    }));

    // Use numFound from MarketCheck when available, otherwise use returned count
    const total = searchResult.numFound > 0 ? searchResult.numFound : vehicles.length;
    const cappedTotal = Math.min(total, MAX_PAGE * limit); // cap estimate to avoid UI confusion
    const totalPages = Math.ceil(cappedTotal / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const totalMs = Date.now() - reqStart;
    console.log(JSON.stringify({
      event: 'inventory_search_complete',
      queryHash,
      vehicles: vehicles.length,
      total,
      fromCache: searchResult.fromCache,
      upstreamLatencyMs: searchResult.latencyMs,
      totalMs,
    }));

    return NextResponse.json({
      success: true,
      data: {
        vehicles,
        pagination: {
          page,
          limit,
          total: cappedTotal,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      },
    });
  } catch (error) {
    const totalMs = Date.now() - reqStart;

    if (error instanceof MarketCheckQuotaError) {
      console.error(JSON.stringify({ event: 'inventory_search_quota_exceeded', queryHash, totalMs }));
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 503 },
      );
    }

    if (error instanceof MarketCheckRateLimitError) {
      console.error(JSON.stringify({ event: 'inventory_search_rate_limited', queryHash, totalMs, retryAfter: error.retryAfter }));
      const res = NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 429 },
      );
      if (error.retryAfter) res.headers.set('Retry-After', String(error.retryAfter));
      return res;
    }

    console.error(JSON.stringify({
      event: 'inventory_search_error',
      queryHash,
      totalMs,
      error: error instanceof Error ? error.message : String(error),
    }));

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            process.env.NODE_ENV === 'production'
              ? 'An error occurred while searching inventory. Please try again.'
              : error instanceof Error
                ? error.message
                : 'Internal server error',
        },
      },
      { status: 500 },
    );
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function badFilter(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'INVALID_FILTERS', message } },
    { status: 400 },
  );
}
