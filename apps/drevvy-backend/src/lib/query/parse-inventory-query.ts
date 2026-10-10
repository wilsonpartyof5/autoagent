/**
 * Shared helpers for natural-language query parsing and geocoding.
 *
 * Extracted from /api/query/parse so that the chat-search endpoint
 * can reuse the same OpenAI extraction logic and geocoding without
 * duplicating code.
 *
 * Exported:
 *   types    – ParsedFilters, LocationData, ApiCompatibleFilters, ParseOpenAIResult, NormalizeResult
 *   functions – parseQueryWithOpenAI, validateAndNormalize, geocodeLocation
 */

import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedFilters {
  minPrice?: number;
  maxPrice?: number;
  make?: string;
  model?: string;
  year?: number;
  minYear?: number;
  maxYear?: number;
  condition?: 'new' | 'used' | 'certified';
  maxMiles?: number;
  bodyType?: string;
  exteriorColor?: string;
  interiorColor?: string;
  trim?: string;
  drivetrain?: string;
  fuelType?: string;
  seatingCapacity?: number;
  powertrainType?: string;
  locationText?: string;
}

export interface LocationData {
  raw: string;
  lat: number;
  lng: number;
  source: 'geocode';
}

export interface ApiCompatibleFilters {
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
  exteriorColor?: string;
  seatingCapacity?: number;
  powertrainType?: string;
}

export interface ParseOpenAIResult {
  filters: ParsedFilters;
  explicitFields: string[];
  confidence: number;
}

export interface NormalizeResult {
  filters: ParsedFilters;
  apiCompatibleFilters: ApiCompatibleFilters;
  parsedFields: string[];
}

// ---------------------------------------------------------------------------
// Internal normalization helpers
// ---------------------------------------------------------------------------

// Normalize broad color intent to MarketCheck base_ext_color casing (title-case).
// MarketCheck accepts: Black, White, Silver, Gray, Red, Blue, Green, Brown,
// Beige, Orange, Yellow, Purple, Gold, Tan.
function normalizeColor(color: string): string {
  const normalized = color.toLowerCase().trim();
  const colorMap: Record<string, string> = {
    red: 'Red', crimson: 'Red', scarlet: 'Red', maroon: 'Red', burgundy: 'Red',
    blue: 'Blue', navy: 'Blue', azure: 'Blue', royal: 'Blue',
    black: 'Black', 'jet black': 'Black', obsidian: 'Black',
    white: 'White', 'pearl white': 'White',
    silver: 'Silver', 'metallic silver': 'Silver',
    gray: 'Gray', grey: 'Gray', charcoal: 'Gray',
    green: 'Green', emerald: 'Green',
    yellow: 'Yellow', gold: 'Gold',
    orange: 'Orange',
    brown: 'Brown', tan: 'Tan', beige: 'Beige',
    purple: 'Purple',
  };
  if (colorMap[normalized]) return colorMap[normalized];
  // Title-case fallback for any other color word
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// Brands that MarketCheck stores as all-caps (case-insensitive lookup)
const ALL_CAPS_MAKES = new Set(['gmc', 'bmw', 'fiat', 'kia', 'ram', 'vw']);

// Verified against MarketCheck facets — maps colloquial/abbreviated inputs to
// the exact make string the API accepts.
const MAKE_ALIASES: Record<string, string> = {
  chevy: 'Chevrolet',
  chevrolet: 'Chevrolet',
  vw: 'Volkswagen',
  volkswagen: 'Volkswagen',
  mercedes: 'Mercedes-Benz',
  benz: 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  landrover: 'Land Rover',
  'land rover': 'Land Rover',
  caddy: 'Cadillac',
  infiniti: 'INFINITI',
  // MarketCheck requires hyphen: "Rolls Royce" returns 0, "Rolls-Royce" returns 71
  'rolls royce': 'Rolls-Royce',
  'rolls-royce': 'Rolls-Royce',
  rolls: 'Rolls-Royce',
  // "Alfa" alone returns 0; needs full brand name
  alfa: 'Alfa Romeo',
  'alfa romeo': 'Alfa Romeo',
};

function normalizeMake(make: string): string {
  const lower = make.toLowerCase().trim();
  if (MAKE_ALIASES[lower]) return MAKE_ALIASES[lower];
  if (ALL_CAPS_MAKES.has(lower)) return lower.toUpperCase();
  return make.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Ford F-series: "F150" → "F-150", "F250" → "F-250", etc.
const FORD_F_SERIES = /^[Ff](150|250|350|450|550|650|750)$/;

// BMW trim-level numbers → series name (e.g. "330i" → "3 Series").
// Verified: BMW '330i' returns 0, '3 Series' returns 286.
const BMW_TRIM_TO_SERIES: Record<string, string> = {
  // 2 Series
  '220i': '2 Series', '228i': '2 Series', '230i': '2 Series', '240i': '2 Series',
  // 3 Series
  '316i': '3 Series', '318i': '3 Series', '320i': '3 Series', '323i': '3 Series',
  '325i': '3 Series', '328i': '3 Series', '330i': '3 Series', '335i': '3 Series', '340i': '3 Series',
  // 4 Series
  '420i': '4 Series', '428i': '4 Series', '430i': '4 Series', '435i': '4 Series', '440i': '4 Series',
  // 5 Series
  '520i': '5 Series', '523i': '5 Series', '525i': '5 Series', '528i': '5 Series',
  '530i': '5 Series', '535i': '5 Series', '540i': '5 Series', '545i': '5 Series', '550i': '5 Series',
  // 6 Series
  '630i': '6 Series', '640i': '6 Series', '645ci': '6 Series', '650i': '6 Series',
  // 7 Series
  '730i': '7 Series', '740i': '7 Series', '745i': '7 Series', '750i': '7 Series', '760i': '7 Series',
  // 8 Series
  '840i': '8 Series', '850i': '8 Series',
};

// Model aliases for models that users commonly abbreviate or hyphenate differently
// than the MarketCheck canonical form. Verified against live API — all lowercase keys.
const MODEL_ALIASES: Record<string, string> = {
  // Honda — hyphen is required; "CRV" returns 0, "CR-V" returns 1304
  'crv': 'CR-V', 'cr v': 'CR-V',
  'hrv': 'HR-V', 'hr v': 'HR-V',
  'crz': 'CR-Z', 'cr z': 'CR-Z',
  // Jeep — hyphen returns 0, space returns 643
  'grand-cherokee': 'Grand Cherokee',
  'grand cherokee l': 'Grand Cherokee L',
  // Toyota
  'rav 4': 'RAV4',
  '4 runner': '4Runner',
  // Mercedes-Benz
  'c class': 'C-Class', 'e class': 'E-Class', 's class': 'S-Class',
  'g class': 'G-Class', 'a class': 'A-Class',
};

function normalizeModel(model: string, make?: string): string {
  const trimmed = model.trim();
  const lower = trimmed.toLowerCase();

  // Check model alias map first
  if (MODEL_ALIASES[lower]) return MODEL_ALIASES[lower];

  // BMW: map trim numbers to series (e.g. "330i" → "3 Series")
  if (make && make.toUpperCase() === 'BMW' && BMW_TRIM_TO_SERIES[lower]) {
    return BMW_TRIM_TO_SERIES[lower];
  }

  // Ford F-series without hyphen (e.g. "F150" → "F-150")
  if (FORD_F_SERIES.test(trimmed)) {
    return `F-${trimmed.slice(1)}`;
  }

  return trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function normalizeBodyType(bodyType: string): string {
  const normalized = bodyType.toUpperCase().trim();
  // All values verified against MarketCheck facets API near Charlotte.
  // Invalid values that return 0: "Van", "Truck", "Pickup Truck", "Sports Car",
  // "Crossover", "Station Wagon", "Roadster".
  const bodyTypeMap: Record<string, string> = {
    // SUV family
    SUV: 'SUV', SUVS: 'SUV',
    CROSSOVER: 'SUV', CUV: 'SUV',
    'SPORT UTILITY': 'SUV', 'SPORTS UTILITY': 'SUV', 'SPORT UTILITY VEHICLE': 'SUV',
    // Sedans / coupes / hatches
    SEDAN: 'Sedan', COUPE: 'Coupe',
    '2 DOOR': 'Coupe', '2-DOOR': 'Coupe',
    HATCHBACK: 'Hatchback',
    WAGON: 'Wagon', 'STATION WAGON': 'Wagon',
    // Convertibles — "Roadster" and "Cabriolet" return 0, map to Convertible
    CONVERTIBLE: 'Convertible',
    ROADSTER: 'Convertible', CABRIOLET: 'Convertible',
    SPIDER: 'Convertible', SPYDER: 'Convertible',
    // Sports Car is not a MarketCheck value — closest is Coupe
    'SPORTS CAR': 'Coupe', 'SPORT CAR': 'Coupe',
    // Trucks — "Truck" and "Pickup Truck" return 0, only "Pickup" works
    TRUCK: 'Pickup', PICKUP: 'Pickup', 'PICKUP TRUCK': 'Pickup',
    // Van family — "Van" returns 0; use specific MarketCheck variants
    VAN: 'Minivan', MINIVAN: 'Minivan', 'MINI VAN': 'Minivan',
    'CARGO VAN': 'Cargo Van',
    'PASSENGER VAN': 'Passenger Van',
  };
  return bodyTypeMap[normalized] ?? bodyType;
}

// Maps common user-facing language to MarketCheck powertrain_type API values.
// MarketCheck valid values: BEV, HEV, MHEV, PHEV, FCEV, EREV, Combustion
function normalizePowertrainType(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s === 'bev' || s === 'electric' || s === 'ev' || s === 'all-electric' || s === 'fully electric') return 'BEV';
  if (s === 'phev' || s === 'plug-in hybrid' || s === 'plug in hybrid' || s === 'plugin hybrid') return 'PHEV';
  if (s === 'hev' || s === 'hybrid') return 'HEV';
  if (s === 'mhev' || s === 'mild hybrid' || s === 'mild-hybrid') return 'MHEV';
  if (s === 'fcev' || s === 'hydrogen' || s === 'fuel cell') return 'FCEV';
  if (s === 'erev' || s === 'extended range') return 'EREV';
  if (s === 'gas' || s === 'gasoline' || s === 'petrol' || s === 'combustion' || s === 'ice') return 'Combustion';
  return raw;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Geocoding cache (24 h TTL, shared across routes in the same serverless instance)
// ---------------------------------------------------------------------------

interface GeocodeCacheEntry {
  location: LocationData;
  timestamp: number;
}

const geocodeCache = new Map<string, GeocodeCacheEntry>();
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function cleanupGeocodeCache(): void {
  const now = Date.now();
  for (const [key, entry] of geocodeCache.entries()) {
    if (now - entry.timestamp > GEOCODE_CACHE_TTL_MS) geocodeCache.delete(key);
  }
}

// ---------------------------------------------------------------------------
// validateAndNormalize
// ---------------------------------------------------------------------------

export function validateAndNormalize(
  filters: ParsedFilters,
  explicitFields: string[],
): NormalizeResult {
  const normalized: ParsedFilters = { ...filters };
  const apiCompatible: ApiCompatibleFilters = {};
  const parsedFields: string[] = [];
  const explicitSet = new Set(explicitFields);

  // Price
  if (explicitSet.has('minPrice') && normalized.minPrice != null) {
    normalized.minPrice = Math.max(0, normalized.minPrice);
    if (normalized.minPrice > 0) { apiCompatible.minPrice = normalized.minPrice; parsedFields.push('minPrice'); }
  } else { normalized.minPrice = undefined; }

  if (explicitSet.has('maxPrice') && normalized.maxPrice != null) {
    normalized.maxPrice = Math.max(0, normalized.maxPrice);
    if (normalized.maxPrice > 0) { apiCompatible.maxPrice = normalized.maxPrice; parsedFields.push('maxPrice'); }
  } else { normalized.maxPrice = undefined; }

  if (normalized.minPrice != null && normalized.maxPrice != null && normalized.minPrice > normalized.maxPrice) {
    [normalized.minPrice, normalized.maxPrice] = [normalized.maxPrice, normalized.minPrice];
    [apiCompatible.minPrice, apiCompatible.maxPrice] = [apiCompatible.maxPrice, apiCompatible.minPrice];
  }

  // Make / Model
  if (explicitSet.has('make') && normalized.make) {
    normalized.make = normalizeMake(normalized.make);
    apiCompatible.make = normalized.make;
    parsedFields.push('make');
  } else { normalized.make = undefined; }

  if (explicitSet.has('model') && normalized.model) {
    // Pass normalized make so BMW trim numbers can be mapped to series names
    normalized.model = normalizeModel(normalized.model, normalized.make);
    apiCompatible.model = normalized.model;
    parsedFields.push('model');
  } else { normalized.model = undefined; }

  // Year
  if (explicitSet.has('year') && normalized.year != null) {
    normalized.year = clampNumber(normalized.year, 1900, 2100);
    apiCompatible.year = normalized.year;
    parsedFields.push('year');
  } else { normalized.year = undefined; }

  if (explicitSet.has('minYear') && normalized.minYear != null) {
    normalized.minYear = clampNumber(normalized.minYear, 1900, 2100);
    apiCompatible.minYear = normalized.minYear;
    parsedFields.push('minYear');
  } else { normalized.minYear = undefined; }

  if (explicitSet.has('maxYear') && normalized.maxYear != null) {
    normalized.maxYear = clampNumber(normalized.maxYear, 1900, 2100);
    apiCompatible.maxYear = normalized.maxYear;
    parsedFields.push('maxYear');
  } else { normalized.maxYear = undefined; }

  if (normalized.minYear != null && normalized.maxYear != null && normalized.minYear > normalized.maxYear) {
    [normalized.minYear, normalized.maxYear] = [normalized.maxYear, normalized.minYear];
    [apiCompatible.minYear, apiCompatible.maxYear] = [apiCompatible.maxYear, apiCompatible.minYear];
  }

  // Condition
  if (explicitSet.has('condition') && normalized.condition && ['new', 'used', 'certified'].includes(normalized.condition)) {
    apiCompatible.condition = normalized.condition as 'new' | 'used' | 'certified';
    parsedFields.push('condition');
  } else { normalized.condition = undefined; }

  // Miles
  if (explicitSet.has('maxMiles') && normalized.maxMiles != null) {
    normalized.maxMiles = Math.max(0, normalized.maxMiles);
    if (normalized.maxMiles > 0) { apiCompatible.maxMiles = normalized.maxMiles; parsedFields.push('maxMiles'); }
  } else { normalized.maxMiles = undefined; }

  // Body type
  if (explicitSet.has('bodyType') && normalized.bodyType) {
    normalized.bodyType = normalizeBodyType(normalized.bodyType);
    apiCompatible.bodyType = normalized.bodyType;
    parsedFields.push('bodyType');
  } else { normalized.bodyType = undefined; }

  // Cosmetic / search fields
  if (explicitSet.has('exteriorColor') && normalized.exteriorColor) {
    normalized.exteriorColor = normalizeColor(normalized.exteriorColor);
    apiCompatible.exteriorColor = normalized.exteriorColor;
    parsedFields.push('exteriorColor');
  } else { normalized.exteriorColor = undefined; }

  if (explicitSet.has('interiorColor') && normalized.interiorColor) {
    normalized.interiorColor = normalizeColor(normalized.interiorColor);
    parsedFields.push('interiorColor');
  } else { normalized.interiorColor = undefined; }

  if (explicitSet.has('trim') && normalized.trim) {
    normalized.trim = normalizeModel(normalized.trim);
    parsedFields.push('trim');
  } else { normalized.trim = undefined; }

  if (explicitSet.has('drivetrain') && normalized.drivetrain) {
    parsedFields.push('drivetrain');
  } else { normalized.drivetrain = undefined; }

  if (explicitSet.has('fuelType') && normalized.fuelType) {
    parsedFields.push('fuelType');
  } else { normalized.fuelType = undefined; }

  if (explicitSet.has('seatingCapacity') && normalized.seatingCapacity != null) {
    normalized.seatingCapacity = Math.max(1, Math.min(15, normalized.seatingCapacity));
    apiCompatible.seatingCapacity = normalized.seatingCapacity;
    parsedFields.push('seatingCapacity');
  } else { normalized.seatingCapacity = undefined; }

  if (explicitSet.has('powertrainType') && normalized.powertrainType) {
    normalized.powertrainType = normalizePowertrainType(normalized.powertrainType);
    apiCompatible.powertrainType = normalized.powertrainType;
    parsedFields.push('powertrainType');
  } else { normalized.powertrainType = undefined; }

  if (explicitSet.has('locationText')) parsedFields.push('locationText');

  return { filters: normalized, apiCompatibleFilters: apiCompatible, parsedFields };
}

// ---------------------------------------------------------------------------
// geocodeLocation (Mapbox)
// ---------------------------------------------------------------------------

export async function geocodeLocation(locationText: string): Promise<LocationData | null> {
  const normalizedText = locationText.trim().toLowerCase();

  const cached = geocodeCache.get(normalizedText);
  if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL_MS) {
    return cached.location;
  }

  let cleanLocation = locationText.trim();
  if (cleanLocation.toLowerCase().startsWith('near ')) cleanLocation = cleanLocation.substring(5).trim();
  if (!cleanLocation) return null;

  try {
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.warn('[parse-inventory-query] MAPBOX_ACCESS_TOKEN not set, skipping geocoding');
      return null;
    }

    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanLocation)}.json?access_token=${mapboxToken}&limit=1`;
    const response = await fetch(geocodeUrl);
    if (!response.ok) return null;

    const data = await response.json() as { features?: Array<{ center: [number, number] }> };
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      const location: LocationData = { raw: locationText, lat, lng, source: 'geocode' };
      geocodeCache.set(normalizedText, { location, timestamp: Date.now() });
      return location;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// parseQueryWithOpenAI
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    filters: {
      type: 'object',
      properties: {
        minPrice: { type: 'number', nullable: true, description: 'Minimum price in USD. Return null if not mentioned.' },
        maxPrice: { type: 'number', nullable: true, description: 'Maximum price in USD. Return null if not mentioned.' },
        make: { type: 'string', nullable: true, description: 'Vehicle make. Return null if not mentioned.' },
        model: { type: 'string', nullable: true, description: 'Vehicle model. Return null if not mentioned.' },
        year: { type: 'number', nullable: true, description: 'Exact year. Return null if not mentioned.' },
        minYear: { type: 'number', nullable: true, description: 'Minimum year in a range. Return null if not mentioned.' },
        maxYear: { type: 'number', nullable: true, description: 'Maximum year in a range. Return null if not mentioned.' },
        condition: { type: 'string', enum: ['new', 'used', 'certified'], nullable: true, description: 'Vehicle condition. Return null if not mentioned.' },
        maxMiles: { type: 'number', nullable: true, description: 'Maximum mileage. Return null if not mentioned.' },
        bodyType: { type: 'string', nullable: true, description: 'Body type (SUV, Sedan, Truck, etc.). Return null if not mentioned.' },
        exteriorColor: { type: 'string', nullable: true, description: 'Exterior color. Return null if not mentioned.' },
        interiorColor: { type: 'string', nullable: true, description: 'Interior color. Return null if not mentioned.' },
        trim: { type: 'string', nullable: true, description: 'Trim level. Return null if not mentioned.' },
        drivetrain: { type: 'string', nullable: true, description: 'Drivetrain (AWD, FWD, etc.). Return null if not mentioned.' },
        fuelType: { type: 'string', nullable: true, description: 'Fuel type (electric, hybrid, etc.). Return null if not mentioned.' },
        seatingCapacity: { type: 'number', nullable: true, description: 'Number of seats explicitly mentioned (e.g. "7-seat", "seats 8", "fits 5"). Return null if not mentioned.' },
        powertrainType: { type: 'string', nullable: true, description: 'Powertrain type. Map "electric"/"EV" to "BEV", "hybrid" to "HEV", "plug-in hybrid"/"PHEV" to "PHEV", "gas"/"gasoline" to "Combustion". Return null if not mentioned.' },
        locationText: { type: 'string', nullable: true, description: 'Location from query (city, ZIP, etc.). Return null if not mentioned.' },
      },
      required: ['minPrice', 'maxPrice', 'make', 'model', 'year', 'minYear', 'maxYear', 'condition', 'maxMiles', 'bodyType', 'exteriorColor', 'interiorColor', 'trim', 'drivetrain', 'fuelType', 'seatingCapacity', 'powertrainType', 'locationText'],
      additionalProperties: false,
    },
    explicitFields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['minPrice', 'maxPrice', 'make', 'model', 'year', 'minYear', 'maxYear', 'condition', 'maxMiles', 'bodyType', 'exteriorColor', 'interiorColor', 'trim', 'drivetrain', 'fuelType', 'seatingCapacity', 'powertrainType', 'locationText'],
      },
      description: 'Fields explicitly mentioned by the user. Empty array if no constraints.',
    },
  },
  required: ['filters', 'explicitFields'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a vehicle search query parser. Extract structured filter information from natural language queries about vehicle inventory.

CRITICAL: Return TWO outputs:
1. filters: All filter fields (nullable) - populate only fields explicitly mentioned, set others to null
2. explicitFields: Array of field names that the user EXPLICITLY mentioned

Rules for filters:
- Only extract information that is EXPLICITLY mentioned in the query
- Do NOT infer or assume values
- For prices: "$40k" -> 40000, "under $50000" -> maxPrice: 50000
- For years: "2023 or newer" -> minYear: 2023. "older than 2020" -> maxYear: 2019
- For condition: "new" -> "new", "used" -> "used", "certified" or "CPO" -> "certified"
- For miles: "under 50k miles" -> maxMiles: 50000
- For body types: Standardize to SUV, Sedan, Truck, Coupe, Van, etc.
- For seatingCapacity: Extract the number from "7-seat", "seats 8", "fits 6 people", "8-passenger" etc.
- For powertrainType: "electric"/"EV"/"all-electric" -> "BEV", "hybrid" -> "HEV", "plug-in hybrid"/"PHEV" -> "PHEV", "gas"/"gasoline" -> "Combustion"
- For locations: Extract from phrases like "in Rock Hill, SC", "near Charlotte", "90210"
- Return null for any field not mentioned

Rules for explicitFields:
- ONLY list field names the user EXPLICITLY mentioned
- "cars near Rock Hill" → ["locationText"]
- "under $30k" → ["maxPrice"]
- "new SUVs" → ["condition", "bodyType"]
- "7-seat hybrid" → ["seatingCapacity", "powertrainType"]
- "just show me cars" → []`;

export async function parseQueryWithOpenAI(query: string): Promise<ParseOpenAIResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY environment variable is not set');

  const openai = new OpenAI({ apiKey: openaiApiKey });

  interface ParsedResponse { filters: ParsedFilters; explicitFields: string[] }

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'vehicle_filters', strict: true, schema: RESPONSE_SCHEMA as any },
      },
    });

    let parsed = completion.choices[0]?.message?.parsed as ParsedResponse | null | undefined;

    if (!parsed) {
      const content = completion.choices[0]?.message?.content;
      if (content) {
        parsed = JSON.parse(content) as ParsedResponse;
      }
    }

    if (!parsed?.filters || !Array.isArray(parsed.explicitFields)) {
      throw new Error('Invalid response format from OpenAI');
    }

    const explicitCount = parsed.explicitFields.length;
    const confidence = explicitCount > 0 ? Math.min(0.95, 0.5 + explicitCount * 0.1) : 0.3;

    return { filters: parsed.filters, explicitFields: parsed.explicitFields, confidence };
  } catch (error) {
    throw new Error(`Failed to parse query with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
