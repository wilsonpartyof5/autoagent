import { NextRequest, NextResponse } from 'next/server';

import { searchResolvedInventory } from '@/lib/query/inventory-search';
import {
  parseQueryWithOpenAI,
  type LocationData,
  type ApiCompatibleFilters,
} from '@/lib/query/parse-inventory-query';
import { createShoppingModelClient, SHOPPING_MODEL, shoppingGatewayCredential } from '@/lib/query/shopping-llm';

import { type CanonicalFilters } from '@/lib/query/resolve-canonical-filters';

import { type LiveVehicle } from '@/lib/marketcheck/mcp-adapter';
import { payloadContainsSecret } from '@/lib/marketcheck/secrets';
import { redactShopperDealerIdentity } from '@/lib/shopper/redact-dealer';

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
 *
 * The success payload passes through redactShopperDealerIdentity. Vehicle
 * price, identity, photos, city/state, and coordinates stay. dealerName is
 * empty, and the assistant message is scrubbed for dealer contact details.
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
    /** Always empty in the shopper response. */
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

  const showing = vehicles.length < total
    ? `Showing top ${vehicles.length} of ${total} total matches`
    : `${total} total match${total === 1 ? '' : 'es'}`;

  return `User query: "${query}"
Search area: ${locationStr || 'current location'}
Filters applied: ${filterDesc || 'none'}
${showing}

Top results:
${topVehicles.join('\n')}`;
}

async function generateAssistantReply(
  groundingContext: string,
  total: number,
): Promise<string> {
  if (!shoppingGatewayCredential()) {
    // Graceful fallback — never block the response on AI generation
    return '';
  }

  const openai = createShoppingModelClient();

  const systemPrompt = `You are Drevvy, a friendly AI car-shopping assistant embedded in a mobile app.
The user just submitted a vehicle search. Given the search context and actual results found, write a helpful 1–2 sentence response that:
- Acknowledges what they searched for
- States the TOTAL match count (use the total from "Showing top X of Y total matches"), not just the page size
- Briefly highlights the 1–2 best options by year, make/model, and price
- Ends with a natural call-to-action (explore the map, tap a card, etc.)

Rules:
- Be conversational and specific — use real numbers from the results
- When results exceed the page, say something like "I found 41 vehicles... here are the top 25" to convey the full total
- Do NOT invent specs, features, or prices not in the results
- Do NOT mention dealership names, salespeople, phone numbers, email addresses, or dealer websites
- Keep it to 1–2 sentences max
- If 0 results: suggest broadening search criteria (budget, radius, or body type)`;

  try {
    const completion = await openai.chat.completions.create({
      model: SHOPPING_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: groundingContext },
      ],
      // Reasoning tokens count against this budget.
      max_tokens: 800,
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

  const searched = await searchResolvedInventory({
    query,
    parseResult,
    userLocation: body.userLocation,
    previousFilters: prev,
    previousLocation: prevLocation,
    origin: request.nextUrl.origin,
    subjectHeader: request.headers.get('x-drevvy-subject'),
  });
  if (!searched.ok) {
    const res = NextResponse.json(
      { success: false, error: { code: searched.code, message: searched.message } },
      { status: searched.status },
    );
    if (searched.retryAfter) res.headers.set('Retry-After', String(searched.retryAfter));
    return res;
  }

  const {
    location,
    center,
    incomingFilters: apiCompatibleFilters,
    mergedFilters,
    canonicalFilters,
    searchFilters,
    liveVehicles,
    total,
  } = searched;

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

  const payload = redactShopperDealerIdentity({ success: true, data: responseData });
  if (payloadContainsSecret(payload)) {
    console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'chat_search' }));
    return NextResponse.json(
      { success: false, error: { code: 'SEARCH_ERROR', message: 'Failed to search inventory. Please try again.' } },
      { status: 500 },
    );
  }
  return NextResponse.json(payload);
}
