import { NextRequest, NextResponse } from 'next/server';

import {
  parseQueryWithOpenAI,
  validateAndNormalize,
  geocodeLocation,
  cleanupGeocodeCache,
  type ParsedFilters,
  type LocationData,
} from '@/lib/query/parse-inventory-query';

import {
  resolveCanonicalFilters,
  cleanupFacetCache,
  type CanonicalFilters,
  type ResolutionMeta,
} from '@/lib/query/resolve-canonical-filters';

/**
 * POST /api/query/parse
 *
 * Caching: In-memory cache with 7-minute TTL
 * Rate Limiting: 30 requests per minute per IP
 *
 * Query Parsing API for iOS app
 * Converts natural language user queries into structured filter objects
 * compatible with /api/inventory/search
 *
 * Request JSON:
 * {
 *   "query": "Show me red SUVs under $40,000"
 * }
 *
 * Response JSON:
 * {
 *   "success": true,
 *   "data": {
 *     "filters": { "maxPrice": 40000, "bodyType": "SUV", "exteriorColor": "red" },
 *     "confidence": 0.95,
 *     "parsedFields": ["maxPrice", "bodyType", "exteriorColor"]
 *   }
 * }
 */

interface ParseRequest {
  query: string;
}

interface ParseResponse {
  success: boolean;
  data?: {
    filters: ParsedFilters;
    confidence: number;
    parsedFields: string[];
    explicitFields: string[];  // Fields explicitly mentioned by user (from OpenAI)
    location?: LocationData;  // Only included if location was explicitly mentioned and geocoded
    apiCompatibleFilters: {
      // Only fields supported by /api/inventory/search
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
    };
    /** MarketCheck-validated canonical values — use these for actual API calls. */
    canonicalFilters: CanonicalFilters;
    /** Resolution debug info — omitted in production unless NODE_ENV=development. */
    resolutionMeta?: ResolutionMeta;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Cache entry for parsed queries
 */
interface CacheEntry {
  data: ParseResponse['data'];
  timestamp: number;
}

/**
 * In-memory cache for parsed queries
 * Key: normalized query string
 * Value: parsed filters with timestamp
 * TTL: 7 minutes (420,000 ms)
 */
const parseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes

/**
 * Rate limiting: Track requests per IP
 * Key: IP address
 * Value: Array of request timestamps (last minute)
 */
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_REQUESTS = 30; // 30 requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Cleanup expired cache entries
 * Called on-demand to avoid issues with serverless environments
 */
function cleanupCache() {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of parseCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      parseCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[query-parse] Cleaned ${cleaned} expired cache entries`);
  }
}

/**
 * Cleanup old rate limit entries
 * Called on-demand to avoid issues with serverless environments
 */
function cleanupRateLimits() {
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitMap.delete(ip);
      cleaned++;
    } else {
      rateLimitMap.set(ip, recent);
    }
  }
  if (cleaned > 0) {
    console.log(`[query-parse] Cleaned ${cleaned} expired rate limit entries`);
  }
}

// Cleanup on a probabilistic basis (every ~10th request) to avoid overhead
let cleanupCounter = 0;
function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter % 10 === 0) {
    cleanupCache();
    cleanupRateLimits();
    cleanupGeocodeCache(); // geocode cache lives in shared lib
    cleanupFacetCache();   // facet cache lives in canonical resolver
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to connection remote address (not available in Next.js Edge)
  return 'unknown';
}

/**
 * Check rate limit for IP address
 * Returns true if within limits, false if rate limited
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  
  // Filter to only recent requests (within last minute)
  const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  
  if (recent.length >= RATE_LIMIT_REQUESTS) {
    return false; // Rate limited
  }
  
  // Add current request timestamp
  recent.push(now);
  rateLimitMap.set(ip, recent);
  
  return true; // Within limits
}

/**
 * Normalize query for cache key (lowercase, trim)
 */
function normalizeQueryForCache(query: string): string {
  return query.toLowerCase().trim();
}

/**
 * Get cached result if available
 */
function getCachedResult(query: string): ParseResponse['data'] | null {
  const cacheKey = normalizeQueryForCache(query);
  const entry = parseCache.get(cacheKey);
  
  if (!entry) {
    return null;
  }
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    // Expired, remove from cache
    parseCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

/**
 * Store result in cache
 */
function setCachedResult(query: string, data: ParseResponse['data']): void {
  const cacheKey = normalizeQueryForCache(query);
  parseCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Validate API key
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  
  if (!apiKey) {
    return false;
  }
  
  // Check x-api-key header
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) {
    return true;
  }
  
  // Check Authorization: Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === apiKey) {
      return true;
    }
  }
  
  return false;
}


export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing API key. Provide x-api-key header or Authorization: Bearer <key>',
          },
        } as ParseResponse,
        { status: 401 }
      );
    }
    
    // Check rate limit
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again in a minute.',
          },
        } as ParseResponse,
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      );
    }
    
    // Parse request body
    let body: ParseRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid JSON in request body',
          },
        } as ParseResponse,
        { status: 400 }
      );
    }
    
    // Validate query
    if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Query is required and must be a non-empty string',
          },
        } as ParseResponse,
        { status: 400 }
      );
    }
    
    const normalizedQuery = body.query.trim();
    
    // Periodic cleanup (probabilistic)
    maybeCleanup();
    
    // Check cache first
    const cachedResult = getCachedResult(normalizedQuery);
    if (cachedResult) {
      console.log('[query-parse] Cache hit for query:', normalizedQuery.substring(0, 50));
      return NextResponse.json({
        success: true,
        data: cachedResult,
      } as ParseResponse);
    }
    
    // Parse query with OpenAI (cache miss)
    let parseResult: { filters: ParsedFilters; explicitFields: string[]; confidence: number };
    try {
      parseResult = await parseQueryWithOpenAI(normalizedQuery);
    } catch (error) {
      console.error('[query-parse] Parse error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to parse query',
          },
        } as ParseResponse,
        { status: 500 }
      );
    }
    
    // Validate and normalize filters - only include fields in explicitFields in apiCompatibleFilters
    const { filters, apiCompatibleFilters, parsedFields } = validateAndNormalize(parseResult.filters, parseResult.explicitFields);
    
    // Log explicitFields for debugging
    console.log('[query-parse] Explicit fields from OpenAI:', parseResult.explicitFields);
    console.log('[query-parse] apiCompatibleFilters:', JSON.stringify(apiCompatibleFilters));
    
    // Geocode location if locationText was extracted
    // Note: We geocode regardless of explicitFields, but only track in parsedFields if explicitly mentioned
    let location: LocationData | undefined;
    if (filters.locationText && filters.locationText !== null) {
      try {
        const geocoded = await geocodeLocation(filters.locationText);
        if (geocoded) {
          location = geocoded;
        } else {
          console.warn('[query-parse] Failed to geocode location:', filters.locationText);
        }
      } catch (error) {
        console.error('[query-parse] Geocoding error:', error);
        // Continue without location - don't fail the entire request
      }
    }
    
    // ---------------------------------------------------------------------------
    // Canonical resolution — validate categorical filters against live MCP facets
    // Only runs when we have a geocoded location so results are market-scoped.
    // Falls back to apiCompatibleFilters on any failure.
    // ---------------------------------------------------------------------------
    let canonicalFilters: CanonicalFilters = { ...apiCompatibleFilters };
    let resolutionMeta: ResolutionMeta | undefined;

    if (location) {
      try {
        const resolved = await resolveCanonicalFilters(apiCompatibleFilters, {
          latitude: location.lat,
          longitude: location.lng,
          radiusMiles: 50,
        });
        canonicalFilters = resolved.canonicalFilters;
        resolutionMeta = resolved.meta;
      } catch (err) {
        console.error('[query-parse] Canonical resolution failed (non-fatal):', err);
        // canonicalFilters stays as apiCompatibleFilters passthrough
      }
    }

    // Build response data
    const responseData: ParseResponse['data'] = {
      filters,
      confidence: parseResult.confidence,
      parsedFields,
      explicitFields: parseResult.explicitFields, // Fields explicitly mentioned by user
      apiCompatibleFilters,
      canonicalFilters,
      ...(location && { location }), // Only include location if geocoding succeeded
      ...(process.env.NODE_ENV === 'development' && resolutionMeta && { resolutionMeta }),
    };
    
    // Store in cache
    setCachedResult(normalizedQuery, responseData);
    
    // Return response
    return NextResponse.json({
      success: true,
      data: responseData,
    } as ParseResponse);
  } catch (error) {
    console.error('[query-parse] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      } as ParseResponse,
      { status: 500 }
    );
  }
}

