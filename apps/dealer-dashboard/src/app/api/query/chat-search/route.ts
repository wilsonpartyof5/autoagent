import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import {
  parseQueryWithOpenAI,
  validateAndNormalize,
  geocodeLocation,
  type LocationData,
  type ApiCompatibleFilters,
} from '@/lib/query/parse-inventory-query';

import {
  resolveCanonicalFilters,
  type CanonicalFilters,
} from '@/lib/query/resolve-canonical-filters';

import {
  searchActiveCarsMcp,
  MarketCheckQuotaError,
  MarketCheckRateLimitError,
  type LiveVehicle,
  type LiveSearchFilters,
} from '@/lib/marketcheck/mcp-adapter';

/**
 * POST /api/query/chat-search
 *
 * Single-call orchestration endpoint for the mobile chat experience.
 * Combines query parsing, MCP inventory search, and AI response generation
 * into one roundtrip so the iOS app gets both structured results and a
 * grounded assistant message without separate parse → search → ai calls.
 *
 * Request:
 * {
 *   "query": "family SUV under $25k near Charlotte",
 *   "userLocation": { "latitude": 35.22, "longitude": -80.84 }  // device GPS fallback
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "assistantMessage": "Found 18 family SUVs near Charlotte under $25k ...",
 *     "vehicles": [...],
 *     "pagination": { "total": 45, "returned": 25 },
 *     "location": { "raw": "Charlotte, NC", "lat": 35.22, "lng": -80.84 },
 *     "apiCompatibleFilters": { "bodyType": "SUV", "maxPrice": 25000 }
 *   }
 * }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviousLocation {
  latitude: number;
  longitude: number;
  raw?: string;
}

interface ChatSearchRequest {
  query: string;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  /** Canonical filters from the previous successful search — enables follow-up refinement. */
  previousFilters?: CanonicalFilters;
  /** Location from the previous successful search — preserved when follow-up has no new location. */
  previousLocation?: PreviousLocation;
}

interface VehiclePayload {
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

interface ChatSearchResponseData {
  assistantMessage: string;
  vehicles: VehiclePayload[];
  pagination: {
    total: number;
    returned: number;
  };
  location?: LocationData;
  /** Raw normalized intent from AI parsing. */
  apiCompatibleFilters: ApiCompatibleFilters;
  /** MarketCheck-validated canonical values actually sent to the search API. */
  canonicalFilters: CanonicalFilters;
}

// ---------------------------------------------------------------------------
// Auth (same pattern as all other routes)
// ---------------------------------------------------------------------------

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  if (!apiKey) return false;
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.substring(7) === apiKey) return true;
  return false;
}

// ---------------------------------------------------------------------------
// AI response generation
// ---------------------------------------------------------------------------

const DEFAULT_SEARCH_RADIUS_MILES = 25;

/**
 * Build context for the AI assistant reply.
 * Uses canonicalFilters (the values actually sent to MarketCheck) so the AI
 * accurately describes what was searched, not just what the user typed.
 */
function buildGroundingContext(
  query: string,
  vehicles: LiveVehicle[],
  location: LocationData | undefined,
  canonicalFilters: CanonicalFilters,
  total: number,
): string {
  const cleanLocationRaw = location?.raw.toLowerCase().startsWith('near ')
    ? location.raw.substring(5)
    : location?.raw;
  const locationStr = cleanLocationRaw ? ` near ${cleanLocationRaw}` : '';
  const filterSummary: string[] = [];
  if (canonicalFilters.exteriorColor) filterSummary.push(canonicalFilters.exteriorColor);
  if (canonicalFilters.bodyType) filterSummary.push(canonicalFilters.bodyType);
  if (canonicalFilters.make) filterSummary.push(canonicalFilters.make);
  if (canonicalFilters.model) filterSummary.push(canonicalFilters.model);
  if (canonicalFilters.maxPrice) filterSummary.push(`under $${canonicalFilters.maxPrice.toLocaleString()}`);
  if (canonicalFilters.minPrice) filterSummary.push(`over $${canonicalFilters.minPrice.toLocaleString()}`);
  if (canonicalFilters.condition) filterSummary.push(canonicalFilters.condition);
  if (canonicalFilters.maxMiles) filterSummary.push(`under ${canonicalFilters.maxMiles.toLocaleString()} miles`);
  if (canonicalFilters.seatingCapacity) filterSummary.push(`${canonicalFilters.seatingCapacity} seats`);
  if (canonicalFilters.powertrainType) filterSummary.push(canonicalFilters.powertrainType);
  const filterDesc = filterSummary.length > 0 ? ` (${filterSummary.join(', ')})` : '';

  const topVehicles = vehicles.slice(0, 5).map((v) => {
    const price = v.price > 0 ? `$${v.price.toLocaleString()}` : 'Price TBD';
    const miles = v.miles != null ? `, ${v.miles.toLocaleString()} miles` : '';
    return `• ${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''} — ${price}${miles}`;
  });

  return `User query: "${query}"
Search area: ${locationStr || 'current location'}
Filters applied: ${filterDesc || 'none'}
Total vehicles found: ${total}
Vehicles returned: ${vehicles.length}

Top results:
${topVehicles.join('\n')}`;
}

async function generateAssistantReply(
  groundingContext: string,
  total: number,
): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    // Graceful fallback — never block the response on AI generation
    return null as unknown as string;
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const systemPrompt = `You are AutoAgent, a friendly AI car-shopping assistant embedded in a mobile app.
The user just submitted a vehicle search. Given the search context and actual results found, write a helpful 1–2 sentence response that:
- Acknowledges what they searched for
- States how many matches were found and where
- Briefly highlights the 1–2 best options by year, make/model, and price
- Ends with a natural call-to-action (explore the map, tap a card, etc.)

Rules:
- Be conversational and specific — use real numbers from the results
- Do NOT invent specs, features, or prices not in the results
- Keep it to 1–2 sentences max
- If 0 results: suggest broadening search criteria (budget, radius, or body type)`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: groundingContext },
      ],
      max_tokens: 150,
    });
    return completion.choices[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    console.error('[chat-search] AI reply generation failed:', error);
    return '';
  }
}

function buildFallbackMessage(total: number, locationRaw: string | undefined): string {
  // Strip leading "near " so we don't say "near near Charlotte"
  const cleanLocation = locationRaw?.toLowerCase().startsWith('near ')
    ? locationRaw.substring(5)
    : locationRaw;
  const locStr = cleanLocation ? ` near ${cleanLocation}` : '';
  if (total === 0) {
    return `No vehicles matched your search${locStr}. Try broadening your budget, body type, or search area.`;
  }
  return `Found ${total} vehicle${total === 1 ? '' : 's'}${locStr}. Tap any card to see details and photos.`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const reqStart = Date.now();

  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key. Provide x-api-key header or Authorization: Bearer <key>' } },
      { status: 401 },
    );
  }

  let body: ChatSearchRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON in request body' } },
      { status: 400 },
    );
  }

  if (!body.query || typeof body.query !== 'string' || !body.query.trim()) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_QUERY', message: 'query is required and must be a non-empty string' } },
      { status: 400 },
    );
  }

  const query = body.query.trim();
  const prev = body.previousFilters ?? {};
  const prevLocation = body.previousLocation;

  // ---------------------------------------------------------------------------
  // 1. Parse query with OpenAI
  // ---------------------------------------------------------------------------
  let parseResult: Awaited<ReturnType<typeof parseQueryWithOpenAI>>;
  try {
    parseResult = await parseQueryWithOpenAI(query);
  } catch (error) {
    console.error('[chat-search] Parse error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PARSE_ERROR', message: error instanceof Error ? error.message : 'Failed to parse query' } },
      { status: 500 },
    );
  }

  const { filters, apiCompatibleFilters } = validateAndNormalize(parseResult.filters, parseResult.explicitFields);

  // Log what was extracted from the current query (before merging previous context)
  console.log(JSON.stringify({
    event: 'chat_search_incoming',
    query: query.substring(0, 80),
    incomingFilters: apiCompatibleFilters,
    previousFilters: Object.keys(prev).length > 0 ? prev : null,
    hasPreviousLocation: !!prevLocation,
  }));

  // ---------------------------------------------------------------------------
  // 2. Geocode if location mentioned in new query
  // ---------------------------------------------------------------------------
  let location: LocationData | undefined;
  if (filters.locationText) {
    try {
      const geocoded = await geocodeLocation(filters.locationText);
      if (geocoded) location = geocoded;
    } catch {
      // Non-fatal — fall back to userLocation
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Determine search center
  //    Priority: new query geocode → userLocation (device GPS) → previousLocation
  // ---------------------------------------------------------------------------
  const center = location
    ? { latitude: location.lat, longitude: location.lng }
    : body.userLocation
      ?? (prevLocation ? { latitude: prevLocation.latitude, longitude: prevLocation.longitude } : undefined);

  // Restore previous location metadata when the current query didn't mention a place
  if (!location && prevLocation?.raw) {
    location = { raw: prevLocation.raw, lat: prevLocation.latitude, lng: prevLocation.longitude, source: 'geocode' };
  }

  if (!center || (Math.abs(center.latitude) < 0.01 && Math.abs(center.longitude) < 0.01)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOCATION_REQUIRED',
          message: 'A location is needed to search inventory. Please mention a city/ZIP in your query or enable device location.',
        },
      },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Merge previous context with current intent
  //    Rule: new explicit fields win; previous fields fill in gaps.
  // ---------------------------------------------------------------------------
  const explicitSet = new Set(parseResult.explicitFields);

  const mergedFilters: ApiCompatibleFilters = {
    // Start from previous context
    ...prev,
    // Overwrite only the fields explicitly present in the new query
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

  console.log(JSON.stringify({
    event: 'chat_search_merged',
    query: query.substring(0, 80),
    mergedFilters,
    explicitFields: parseResult.explicitFields,
  }));

  // ---------------------------------------------------------------------------
  // 5. Canonical filter resolution — validate categorical values against MCP facets
  // ---------------------------------------------------------------------------
  let canonicalFilters: CanonicalFilters = { ...mergedFilters };
  try {
    const resolved = await resolveCanonicalFilters(mergedFilters, {
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMiles: DEFAULT_SEARCH_RADIUS_MILES,
    });
    canonicalFilters = resolved.canonicalFilters;
  } catch (err) {
    console.error('[chat-search] Canonical resolution failed (non-fatal):', err);
    // canonicalFilters stays as mergedFilters passthrough
  }

  // ---------------------------------------------------------------------------
  // 6. MCP inventory search — build from canonicalFilters (validated values)
  // ---------------------------------------------------------------------------
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

  let searchResult: Awaited<ReturnType<typeof searchActiveCarsMcp>>;
  try {
    searchResult = await searchActiveCarsMcp({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMiles: DEFAULT_SEARCH_RADIUS_MILES,
      filters: searchFilters,
      rows: 25,
      start: 0,
    });
  } catch (error) {
    if (error instanceof MarketCheckQuotaError) {
      console.error(JSON.stringify({
        event: 'marketcheck_quota_exceeded',
        message: '🚫 Monthly MarketCheck API quota exhausted — all MCP calls will return 402 until the quota resets.',
        query: query.substring(0, 60),
      }));
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 503 },
      );
    }
    if (error instanceof MarketCheckRateLimitError) {
      console.warn(JSON.stringify({
        event: 'marketcheck_rate_limited',
        retryAfter: error.retryAfter,
        query: query.substring(0, 60),
      }));
      const res = NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 429 },
      );
      if (error.retryAfter) res.headers.set('Retry-After', String(error.retryAfter));
      return res;
    }
    console.error('[chat-search] MCP search error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SEARCH_ERROR', message: 'Failed to search inventory. Please try again.' } },
      { status: 500 },
    );
  }

  const { vehicles: liveVehicles, numFound } = searchResult;
  const total = numFound > 0 ? numFound : liveVehicles.length;

  // ---------------------------------------------------------------------------
  // 6. Generate AI assistant reply (grounded in canonical results)
  // ---------------------------------------------------------------------------
  let assistantMessage = '';
  if (liveVehicles.length > 0) {
    // Use canonicalFilters so the AI describes what was actually searched
    const groundingContext = buildGroundingContext(query, liveVehicles, location, canonicalFilters, total);
    assistantMessage = await generateAssistantReply(groundingContext, total);
  }
  // Fall back to a template if AI generation failed or returned nothing
  if (!assistantMessage) {
    assistantMessage = buildFallbackMessage(total, location?.raw);
  }

  // ---------------------------------------------------------------------------
  // 7. Map to response contract (same shape as /api/inventory/search vehicles)
  // ---------------------------------------------------------------------------
  const vehicles: VehiclePayload[] = liveVehicles.map((v) => ({
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

  const totalMs = Date.now() - reqStart;
  console.log(JSON.stringify({
    event: 'chat_search_complete',
    query: query.substring(0, 80),
    lat: center.latitude.toFixed(4),
    lng: center.longitude.toFixed(4),
    locationSource: location ? 'geocode' : (prevLocation ? 'previousLocation' : 'userLocation'),
    filterCount: Object.keys(searchFilters).length,
    vehiclesReturned: vehicles.length,
    total,
    totalMs,
    // Incoming (new query only), merged (new + previous), canonical (MCP-validated)
    incomingFilters: apiCompatibleFilters,
    mergedFilters,
    canonicalFilters,
    marketCheckArgs: {
      body_type: searchFilters.bodyType,
      make: searchFilters.make,
      model: searchFilters.model,
      car_type: searchFilters.condition,
      price_range: searchFilters.minPrice || searchFilters.maxPrice
        ? `${searchFilters.minPrice ?? 0}-${searchFilters.maxPrice ?? 9999999}`
        : undefined,
      base_ext_color: searchFilters.exteriorColor,
      powertrain_type: searchFilters.powertrainType,
      seating_capacity: searchFilters.seatingCapacity,
    },
  }));

  const responseData: ChatSearchResponseData = {
    assistantMessage,
    vehicles,
    pagination: {
      total,
      returned: vehicles.length,
    },
    ...(location && { location }),
    apiCompatibleFilters: mergedFilters,
    canonicalFilters,
  };

  return NextResponse.json({ success: true, data: responseData });
}
