import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
 *     "filters": {
 *       "maxPrice": 40000,
 *       "bodyType": "SUV",
 *       "exteriorColor": "red"
 *     },
 *     "confidence": 0.95,
 *     "parsedFields": ["maxPrice", "bodyType", "exteriorColor"]
 *   }
 * }
 */

interface ParseRequest {
  query: string;
}

interface ParsedFilters {
  // Price range
  minPrice?: number;
  maxPrice?: number;
  
  // Vehicle identity
  make?: string;
  model?: string;
  year?: number;          // Exact year
  minYear?: number;       // Year range start
  maxYear?: number;       // Year range end
  
  // Condition
  condition?: 'new' | 'used' | 'certified';
  
  // Mileage
  maxMiles?: number;
  
  // Future fields (parse but log for future use)
  bodyType?: string;      // For logging/future API support
  exteriorColor?: string; // For logging/future API support
  interiorColor?: string; // For logging/future API support
  trim?: string;          // For logging/future API support
  drivetrain?: string;    // For logging/future API support
  fuelType?: string;      // For logging/future API support
}

interface ParseResponse {
  success: boolean;
  data?: {
    filters: ParsedFilters;
    confidence: number;
    parsedFields: string[];
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
    };
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

/**
 * Normalize color names to common values
 */
function normalizeColor(color: string): string {
  const normalized = color.toLowerCase().trim();
  
  // Common color mappings
  const colorMap: Record<string, string> = {
    'red': 'red',
    'crimson': 'red',
    'scarlet': 'red',
    'maroon': 'red',
    'burgundy': 'red',
    'blue': 'blue',
    'navy': 'blue',
    'azure': 'blue',
    'royal': 'blue',
    'black': 'black',
    'jet black': 'black',
    'obsidian': 'black',
    'white': 'white',
    'pearl white': 'white',
    'silver': 'silver',
    'metallic silver': 'silver',
    'gray': 'gray',
    'grey': 'gray',
    'charcoal': 'gray',
    'green': 'green',
    'emerald': 'green',
    'yellow': 'yellow',
    'gold': 'yellow',
    'orange': 'orange',
    'brown': 'brown',
    'tan': 'brown',
    'beige': 'beige',
  };
  
  return colorMap[normalized] || normalized;
}

/**
 * Normalize make names (e.g., "GMC" stays "GMC", "bmw" -> "BMW")
 */
function normalizeMake(make: string): string {
  // Capitalize first letter of each word
  return make
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize model names (capitalize first letter)
 */
function normalizeModel(model: string): string {
  return model
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize body type to common values
 */
function normalizeBodyType(bodyType: string): string {
  const normalized = bodyType.toUpperCase().trim();
  
  const bodyTypeMap: Record<string, string> = {
    'SUV': 'SUV',
    'SUVS': 'SUV',
    'SEDAN': 'Sedan',
    'COUPE': 'Coupe',
    'TRUCK': 'Truck',
    'PICKUP': 'Truck',
    'PICKUP TRUCK': 'Truck',
    'VAN': 'Van',
    'MINIVAN': 'Van',
    'WAGON': 'Wagon',
    'HATCHBACK': 'Hatchback',
    'CONVERTIBLE': 'Convertible',
    'SPORTS CAR': 'Sports Car',
  };
  
  return bodyTypeMap[normalized] || bodyType;
}

/**
 * Validate and clamp numeric values
 */
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and normalize parsed filters
 */
function validateAndNormalize(filters: ParsedFilters): {
  filters: ParsedFilters;
  apiCompatibleFilters: ParseResponse['data']['apiCompatibleFilters'];
  parsedFields: string[];
} {
  const normalized: ParsedFilters = { ...filters };
  const apiCompatible: ParseResponse['data']['apiCompatibleFilters'] = {};
  const parsedFields: string[] = [];
  
  // Price validation
  if (normalized.minPrice !== undefined) {
    normalized.minPrice = Math.max(0, normalized.minPrice);
    apiCompatible.minPrice = normalized.minPrice;
    parsedFields.push('minPrice');
  }
  if (normalized.maxPrice !== undefined) {
    normalized.maxPrice = Math.max(0, normalized.maxPrice);
    apiCompatible.maxPrice = normalized.maxPrice;
    parsedFields.push('maxPrice');
  }
  
  // Ensure minPrice <= maxPrice
  if (normalized.minPrice !== undefined && normalized.maxPrice !== undefined) {
    if (normalized.minPrice > normalized.maxPrice) {
      // Swap if invalid
      [normalized.minPrice, normalized.maxPrice] = [normalized.maxPrice, normalized.minPrice];
      [apiCompatible.minPrice, apiCompatible.maxPrice] = [apiCompatible.maxPrice, apiCompatible.minPrice];
    }
  }
  
  // Make/Model normalization
  if (normalized.make) {
    normalized.make = normalizeMake(normalized.make);
    apiCompatible.make = normalized.make;
    parsedFields.push('make');
  }
  if (normalized.model) {
    normalized.model = normalizeModel(normalized.model);
    apiCompatible.model = normalized.model;
    parsedFields.push('model');
  }
  
  // Year validation
  if (normalized.year !== undefined) {
    normalized.year = clampNumber(normalized.year, 1900, 2100);
    apiCompatible.year = normalized.year;
    parsedFields.push('year');
  }
  if (normalized.minYear !== undefined) {
    normalized.minYear = clampNumber(normalized.minYear, 1900, 2100);
    apiCompatible.minYear = normalized.minYear;
    parsedFields.push('minYear');
  }
  if (normalized.maxYear !== undefined) {
    normalized.maxYear = clampNumber(normalized.maxYear, 1900, 2100);
    apiCompatible.maxYear = normalized.maxYear;
    parsedFields.push('maxYear');
  }
  
  // Ensure minYear <= maxYear
  if (normalized.minYear !== undefined && normalized.maxYear !== undefined) {
    if (normalized.minYear > normalized.maxYear) {
      [normalized.minYear, normalized.maxYear] = [normalized.maxYear, normalized.minYear];
      [apiCompatible.minYear, apiCompatible.maxYear] = [apiCompatible.maxYear, apiCompatible.minYear];
    }
  }
  
  // Condition validation
  if (normalized.condition) {
    if (['new', 'used', 'certified'].includes(normalized.condition)) {
      apiCompatible.condition = normalized.condition as 'new' | 'used' | 'certified';
      parsedFields.push('condition');
    }
  }
  
  // Miles validation
  if (normalized.maxMiles !== undefined) {
    normalized.maxMiles = Math.max(0, normalized.maxMiles);
    apiCompatible.maxMiles = normalized.maxMiles;
    parsedFields.push('maxMiles');
  }
  
  // Future fields (normalize but don't include in API filters)
  if (normalized.bodyType) {
    normalized.bodyType = normalizeBodyType(normalized.bodyType);
    parsedFields.push('bodyType');
  }
  if (normalized.exteriorColor) {
    normalized.exteriorColor = normalizeColor(normalized.exteriorColor);
    parsedFields.push('exteriorColor');
  }
  if (normalized.interiorColor) {
    normalized.interiorColor = normalizeColor(normalized.interiorColor);
    parsedFields.push('interiorColor');
  }
  if (normalized.trim) {
    normalized.trim = normalizeModel(normalized.trim); // Use same normalization as model
    parsedFields.push('trim');
  }
  if (normalized.drivetrain) {
    parsedFields.push('drivetrain');
  }
  if (normalized.fuelType) {
    parsedFields.push('fuelType');
  }
  
  return { filters: normalized, apiCompatibleFilters: apiCompatible, parsedFields };
}

/**
 * Parse natural language query using OpenAI
 */
async function parseQueryWithOpenAI(query: string): Promise<{
  filters: ParsedFilters;
  confidence: number;
}> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  const openai = new OpenAI({
    apiKey: openaiApiKey,
  });
  
  // Define strict schema for structured output
  const responseSchema = {
    type: 'object',
    properties: {
      minPrice: {
        type: 'number',
        description: 'Minimum price in USD. Only extract if explicitly mentioned.',
        nullable: true,
      },
      maxPrice: {
        type: 'number',
        description: 'Maximum price in USD. Only extract if explicitly mentioned.',
        nullable: true,
      },
      make: {
        type: 'string',
        description: 'Vehicle make (e.g., "Toyota", "Ford", "BMW"). Only extract if explicitly mentioned.',
        nullable: true,
      },
      model: {
        type: 'string',
        description: 'Vehicle model (e.g., "Camry", "F-150", "3 Series"). Only extract if explicitly mentioned.',
        nullable: true,
      },
      year: {
        type: 'number',
        description: 'Exact year. Use this if user specifies a single year (e.g., "2023").',
        nullable: true,
      },
      minYear: {
        type: 'number',
        description: 'Minimum year in a range (e.g., "2020 or newer" -> minYear: 2020).',
        nullable: true,
      },
      maxYear: {
        type: 'number',
        description: 'Maximum year in a range (e.g., "older than 2020" -> maxYear: 2019).',
        nullable: true,
      },
      condition: {
        type: 'string',
        enum: ['new', 'used', 'certified'],
        description: 'Vehicle condition. Extract from words like "new", "used", "certified pre-owned", "CPO".',
        nullable: true,
      },
      maxMiles: {
        type: 'number',
        description: 'Maximum mileage. Extract from phrases like "under 50k miles", "less than 30000 miles".',
        nullable: true,
      },
      bodyType: {
        type: 'string',
        description: 'Body type (e.g., "SUV", "Sedan", "Truck", "Coupe"). Extract from terms like "SUV", "sedan", "truck", "pickup", "van".',
        nullable: true,
      },
      exteriorColor: {
        type: 'string',
        description: 'Exterior color (e.g., "red", "black", "white", "silver"). Extract common color names.',
        nullable: true,
      },
      interiorColor: {
        type: 'string',
        description: 'Interior color. Only extract if explicitly mentioned.',
        nullable: true,
      },
      trim: {
        type: 'string',
        description: 'Trim level (e.g., "SLT", "Limited", "XLE"). Only extract if explicitly mentioned.',
        nullable: true,
      },
      drivetrain: {
        type: 'string',
        description: 'Drivetrain (e.g., "AWD", "FWD", "RWD", "4WD"). Extract from terms like "all-wheel drive", "AWD", "4x4".',
        nullable: true,
      },
      fuelType: {
        type: 'string',
        description: 'Fuel type (e.g., "electric", "hybrid", "gasoline"). Extract from terms like "electric", "EV", "hybrid", "gas".',
        nullable: true,
      },
    },
    required: [],
  } as const;
  
  const systemPrompt = `You are a vehicle search query parser. Extract structured filter information from natural language queries about vehicle inventory.

Rules:
- Only extract information that is EXPLICITLY mentioned in the query
- Do NOT infer or assume values
- For prices: Extract numbers with currency context (e.g., "$40k" -> 40000, "under $50000" -> maxPrice: 50000)
- For years: "2023" or "2023 model" -> year: 2023. "2020 or newer" -> minYear: 2020. "older than 2020" -> maxYear: 2019
- For condition: "new" -> "new", "used" -> "used", "certified" or "CPO" -> "certified"
- For miles: "under 50k miles" -> maxMiles: 50000, "less than 30000 miles" -> maxMiles: 30000
- For body types: Standardize to common names (SUV, Sedan, Truck, Coupe, Van, etc.)
- For colors: Extract common color names (red, blue, black, white, silver, gray, etc.)
- Return null for any field not mentioned in the query
- Be conservative - only extract what is clearly stated`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'vehicle_filters',
          strict: true,
          schema: responseSchema as any,
        },
      },
      temperature: 0.1, // Low temperature for consistent parsing
    });
    
    const parsed = completion.choices[0]?.message?.parsed as ParsedFilters | null | undefined;
    
    if (!parsed) {
      // Fallback: try to parse from content if parsed is not available
      const content = completion.choices[0]?.message?.content;
      if (content) {
        try {
          const parsedFromContent = JSON.parse(content) as ParsedFilters;
          const extractedCount = Object.values(parsedFromContent).filter(v => v !== null && v !== undefined).length;
          const confidence = extractedCount > 0 ? Math.min(0.9, 0.4 + extractedCount * 0.1) : 0.2;
          return {
            filters: parsedFromContent,
            confidence,
          };
        } catch (parseError) {
          console.error('[query-parse] Failed to parse JSON from content:', parseError);
          throw new Error('Failed to parse response from OpenAI');
        }
      }
      throw new Error('No parsed data received from OpenAI');
    }
    
    // Calculate confidence based on number of extracted fields
    // More fields = higher confidence (assuming the model is doing its job)
    const extractedCount = Object.values(parsed).filter(v => v !== null && v !== undefined).length;
    const confidence = extractedCount > 0 ? Math.min(0.95, 0.5 + extractedCount * 0.1) : 0.3;
    
    return {
      filters: parsed,
      confidence,
    };
  } catch (error) {
    console.error('[query-parse] OpenAI API error:', error);
    throw new Error(`Failed to parse query with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
    let parseResult: { filters: ParsedFilters; confidence: number };
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
    
    // Validate and normalize filters
    const { filters, apiCompatibleFilters, parsedFields } = validateAndNormalize(parseResult.filters);
    
    // Build response data
    const responseData: ParseResponse['data'] = {
      filters,
      confidence: parseResult.confidence,
      parsedFields,
      apiCompatibleFilters,
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

