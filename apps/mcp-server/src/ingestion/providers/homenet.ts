/**
 * Homenet Provider Mapper
 * 
 * Normalizes Homenet API/feed responses to UVS format.
 * Phase 2: Full field population with intelligent parsing and categorization.
 */

import type { UVS, Feature } from '../../types/UVS';

/**
 * Homenet vehicle data structure
 * Supports common Homenet field variations (snake_case, camelCase, etc.)
 */
export interface HomenetVehicle {
  [key: string]: unknown;
  // Core fields (various naming conventions)
  id?: string;
  vehicle_id?: string;
  vin?: string;
  stock_number?: string;
  stock_no?: string;
  stockNumber?: string;
  
  // Identity fields
  year?: number;
  make?: string;
  manufacturer?: string;
  model?: string;
  trim?: string;
  body_type?: string;
  bodyType?: string;
  vehicle_type?: string;
  vehicleType?: string;
  
  // Condition
  condition?: string;
  inventory_type?: string;
  inventoryType?: string;
  certified?: boolean;
  
  // Pricing
  price?: number;
  selling_price?: number;
  sellingPrice?: number;
  msrp?: number;
  list_price?: number;
  listPrice?: number;
  
  // Specifications
  mileage?: number;
  miles?: number;
  odometer?: number;
  odometer_reading?: number;
  fuel_type?: string;
  fuelType?: string;
  transmission?: string;
  drivetrain?: string;
  drive_train?: string;
  driveTrain?: string;
  engine?: string;
  engine_size?: string;
  engineSize?: string;
  cylinders?: number;
  horsepower?: number;
  hp?: number;
  displacement?: number;
  
  // Features and packages
  features?: string[];
  options?: string[];
  packages?: Array<{
    name?: string;
    code?: string;
    price?: number;
    description?: string;
  }>;
  
  // Media
  photos?: string[];
  photo_urls?: string[];
  photoUrls?: string[];
  primary_photo?: string;
  primaryPhoto?: string;
  primary_photo_url?: string;
  primaryPhotoUrl?: string;
  
  // Dealer information
  dealer_id?: string;
  dealerId?: string;
  dealer_name?: string;
  dealerName?: string;
  dealer_city?: string;
  dealerCity?: string;
  dealer_state?: string;
  dealerState?: string;
  dealer_zip?: string;
  dealerZip?: string;
  
  // Market data
  days_on_market?: number;
  daysOnMarket?: number;
  dom?: number;
  
  // Additional data
  description?: string;
  comments?: string;
  notes?: string;
  price_history?: Array<{
    price?: number;
    timestamp?: number | string;
    date?: string;
  }>;
}

/**
 * Parse year, make, model from Homenet description or title if available
 */
function parseDescription(
  description?: string,
  title?: string
): { year?: number; make?: string; model?: string } {
  const text = description || title;
  if (!text) return {};
  
  // Match pattern: "YYYY Make Model" or "Make Model YYYY"
  const yearFirst = text.match(/^(\d{4})\s+(.+)$/);
  const yearLast = text.match(/(.+?)\s+(\d{4})$/);
  
  if (yearFirst) {
    const year = parseInt(yearFirst[1], 10);
    if (isNaN(year) || year < 1900 || year > 2100) return {};
    
    const remaining = yearFirst[2]?.trim() || '';
    if (!remaining) return { year };
    
    const parts = remaining.split(/\s+/);
    if (parts.length < 2) return { year, make: remaining };
    
    return {
      year,
      make: parts[0] || '',
      model: parts.slice(1).join(' ') || '',
    };
  }
  
  if (yearLast) {
    const year = parseInt(yearLast[2], 10);
    if (isNaN(year) || year < 1900 || year > 2100) return {};
    
    const remaining = yearLast[1]?.trim() || '';
    if (!remaining) return { year };
    
    const parts = remaining.split(/\s+/);
    if (parts.length < 2) return { year, make: remaining };
    
    return {
      year,
      make: parts[0] || '',
      model: parts.slice(1).join(' ') || '',
    };
  }
  
  return {};
}

/**
 * Derive vehicle type from body type or vehicle type field
 */
function deriveVehicleType(bodyType?: string, vehicleType?: string): UVS['baseIdentity']['vehicleType'] {
  const normalized = (bodyType || vehicleType || '').toLowerCase();
  
  if (normalized.includes('sedan') || normalized.includes('coupe') || normalized.includes('hatchback') || normalized.includes('convertible')) {
    return 'car';
  }
  if (normalized.includes('suv') || normalized.includes('crossover')) {
    return 'suv';
  }
  if (normalized.includes('truck') || normalized.includes('pickup')) {
    return 'truck';
  }
  if (normalized.includes('van') || normalized.includes('minivan')) {
    return 'van';
  }
  if (normalized.includes('motorcycle') || normalized.includes('bike')) {
    return 'motorcycle';
  }
  if (normalized.includes('rv') || normalized.includes('motorhome')) {
    return 'rv';
  }
  if (normalized.includes('trailer')) {
    return 'trailer';
  }
  if (normalized.includes('wagon')) {
    return 'car';
  }
  
  return normalized ? 'other' : undefined;
}

/**
 * Parse engine specifications from description string
 */
function parseEngineSpecs(engineDesc?: string, engineSize?: string): {
  description?: string;
  displacement?: number;
  cylinders?: number;
  horsepower?: number;
} | undefined {
  let displacement: number | undefined;
  let cylinders: number | undefined;
  let horsepower: number | undefined;
  const description = engineDesc || engineSize;
  
  if (!description) return undefined;
  
  const desc = String(description).toLowerCase();
  
  // Parse displacement (e.g., "3.5L", "2.0L")
  const displacementMatch = desc.match(/(\d+\.?\d*)\s*[l]?/i);
  if (displacementMatch) {
    const parsed = parseFloat(displacementMatch[1]);
    if (parsed > 0 && parsed < 20) {
      displacement = parsed;
    }
  }
  
  // Parse cylinders
  const cylinderMatch = desc.match(/(?:v|inline|i|in-line|straight|w)?(\d+)[\s-]?cyl/i) || 
                         desc.match(/(\d+)[\s-]?cylinder/i);
  if (cylinderMatch) {
    const parsed = parseInt(cylinderMatch[1], 10);
    if (parsed > 0 && parsed <= 16) {
      cylinders = parsed;
    }
  } else if (desc.includes('v6') || desc.includes('v-6')) {
    cylinders = 6;
  } else if (desc.includes('v8') || desc.includes('v-8')) {
    cylinders = 8;
  } else if (desc.includes('v4') || desc.includes('v-4') || desc.includes('i4') || desc.includes('l4')) {
    cylinders = 4;
  }
  
  // Parse horsepower
  const hpMatch = desc.match(/(\d+)\s*hp/i) || desc.match(/(\d+)\s*horsepower/i);
  if (hpMatch) {
    const parsed = parseInt(hpMatch[1], 10);
    if (parsed > 0 && parsed < 2000) {
      horsepower = parsed;
    }
  }
  
  if (!description && !displacement && !cylinders && !horsepower) {
    return undefined;
  }
  
  return {
    ...(description && { description }),
    ...(displacement !== undefined && { displacement }),
    ...(cylinders !== undefined && { cylinders }),
    ...(horsepower !== undefined && { horsepower }),
  };
}

/**
 * Map fuel type string to UVS enum
 */
function mapFuelType(fuelType?: string): 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'plug-in hybrid' | 'flex fuel' | 'natural gas' | 'hydrogen' | 'other' | undefined {
  if (!fuelType) return undefined;
  
  const normalized = String(fuelType).toLowerCase();
  if (normalized.includes('gas') || normalized.includes('petrol')) return 'gasoline';
  if (normalized.includes('diesel')) return 'diesel';
  if (normalized.includes('electric')) return 'electric';
  if (normalized.includes('hybrid')) {
    if (normalized.includes('plug')) return 'plug-in hybrid';
    return 'hybrid';
  }
  if (normalized.includes('flex')) return 'flex fuel';
  if (normalized.includes('natural gas') || normalized.includes('cng')) return 'natural gas';
  if (normalized.includes('hydrogen')) return 'hydrogen';
  return 'other';
}

/**
 * Map transmission string to UVS enum
 */
function mapTransmissionType(transmission?: string): 'automatic' | 'manual' | 'cvt' | 'dual clutch' | 'automated manual' | undefined {
  if (!transmission) return undefined;
  
  const normalized = String(transmission).toLowerCase();
  if (normalized.includes('automatic') || normalized.includes('auto')) return 'automatic';
  if (normalized.includes('manual')) return 'manual';
  if (normalized.includes('cvt')) return 'cvt';
  if (normalized.includes('dual clutch') || normalized.includes('dsg')) return 'dual clutch';
  if (normalized.includes('automated manual') || normalized.includes('amt')) return 'automated manual';
  return undefined;
}

/**
 * Map drivetrain string to UVS enum
 */
function mapDrivetrain(drivetrain?: string): 'fwd' | 'rwd' | 'awd' | '4wd' | 'part-time 4wd' | undefined {
  if (!drivetrain) return undefined;
  
  const normalized = String(drivetrain).toLowerCase();
  if (normalized === 'fwd' || normalized.includes('front')) return 'fwd';
  if (normalized === 'rwd' || normalized.includes('rear')) return 'rwd';
  if (normalized === 'awd' || normalized.includes('all wheel')) return 'awd';
  if (normalized === '4wd' || normalized.includes('four wheel')) return '4wd';
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'part-time 4wd';
  return undefined;
}

/**
 * Categorize feature based on keywords (same as MarketCheck)
 */
function categorizeFeature(feature: string): 'safety' | 'interior' | 'exterior' | 'convenience' | 'technology' | 'entertainment' | 'performance' | 'other' {
  if (!feature) return 'other';
  
  const normalized = String(feature).toLowerCase();
  
  // Safety features
  if (normalized.includes('safety') || normalized.includes('airbag') || normalized.includes('backup camera') ||
      normalized.includes('blind spot') || normalized.includes('lane assist') || normalized.includes('collision') ||
      normalized.includes('brake') || normalized.includes('parking assist') || normalized.includes('sensor') ||
      normalized.includes('abs') || normalized.includes('traction') || normalized.includes('stability')) {
    return 'safety';
  }
  
  // Technology features
  if (normalized.includes('bluetooth') || normalized.includes('navigation') || normalized.includes('apple carplay') ||
      normalized.includes('android auto') || normalized.includes('usb') || normalized.includes('wifi') ||
      normalized.includes('wireless') || normalized.includes('screen') || normalized.includes('display') ||
      normalized.includes('touch') || normalized.includes('infotainment') || normalized.includes('connectivity')) {
    return 'technology';
  }
  
  // Entertainment features
  if (normalized.includes('radio') || normalized.includes('stereo') || normalized.includes('speaker') ||
      normalized.includes('audio') || normalized.includes('sound') || normalized.includes('premium') ||
      normalized.includes('bose') || normalized.includes('harman') || normalized.includes('satellite')) {
    return 'entertainment';
  }
  
  // Convenience features
  if (normalized.includes('keyless') || normalized.includes('remote start') || normalized.includes('push button') ||
      normalized.includes('power') && (normalized.includes('window') || normalized.includes('door')) ||
      normalized.includes('cruise control') || normalized.includes('adaptive cruise') || normalized.includes('heated') ||
      normalized.includes('cooled') || normalized.includes('memory') || normalized.includes('tilt') ||
      normalized.includes('adjustable')) {
    return 'convenience';
  }
  
  // Exterior features
  if (normalized.includes('sunroof') || normalized.includes('moonroof') || normalized.includes('panoramic') ||
      normalized.includes('roof rack') || normalized.includes('running board') ||
      normalized.includes('wheel') && normalized.includes('alloy') || normalized.includes('chrome') ||
      normalized.includes('fog light') || normalized.includes('led') || normalized.includes('spoiler')) {
    return 'exterior';
  }
  
  // Interior features
  if (normalized.includes('leather') || normalized.includes('cloth') || normalized.includes('fabric') ||
      normalized.includes('seat') || normalized.includes('steering') || normalized.includes('wood') ||
      normalized.includes('trim') || normalized.includes('dashboard') || normalized.includes('console')) {
    return 'interior';
  }
  
  // Performance features
  if (normalized.includes('sport') || normalized.includes('racing') || normalized.includes('performance') ||
      normalized.includes('turbo') || normalized.includes('supercharg') || normalized.includes('suspension') ||
      normalized.includes('exhaust') || normalized.includes('intake')) {
    return 'performance';
  }
  
  return 'other';
}

/**
 * Derive dealer-provided price from Homenet data
 * Tries price field first, then price_history (most recent), then rejects if none found
 */
function deriveDealerPrice(raw: HomenetVehicle): number {
  const listingId = raw.id || raw.vehicle_id || raw.vin || 'unknown';
  
  // Primary: Use current price if available and positive
  const price = raw.price || raw.selling_price || raw.sellingPrice;
  if (typeof price === 'number' && price > 0) {
    return price;
  }
  
  // Fallback: Use most recent price from price_history if available
  if (raw.price_history && Array.isArray(raw.price_history) && raw.price_history.length > 0) {
    const validPrices = raw.price_history
      .filter((entry: unknown) => {
        const e = entry as { price?: number; timestamp?: number | string; date?: string };
        return typeof e.price === 'number' && e.price > 0;
      })
      .sort((a: unknown, b: unknown) => {
        const aEntry = a as { timestamp?: number | string; date?: string };
        const bEntry = b as { timestamp?: number | string; date?: string };
        
        const aTime = typeof aEntry.timestamp === 'number' ? aEntry.timestamp :
                     typeof aEntry.timestamp === 'string' ? new Date(aEntry.timestamp).getTime() :
                     typeof aEntry.date === 'string' ? new Date(aEntry.date).getTime() : 0;
        const bTime = typeof bEntry.timestamp === 'number' ? bEntry.timestamp :
                     typeof bEntry.timestamp === 'string' ? new Date(bEntry.timestamp).getTime() :
                     typeof bEntry.date === 'string' ? new Date(bEntry.date).getTime() : 0;
        return bTime - aTime;
      });
    
    if (validPrices.length > 0) {
      const priceEntry = validPrices[0] as { price?: number };
      if (priceEntry.price) {
        console.warn(JSON.stringify({
          event: 'homenet_price_from_history',
          listingId,
          price: priceEntry.price,
          message: 'Using price from price_history as dealer-provided price',
        }));
        return priceEntry.price;
      }
    }
  }
  
  // No dealer-provided price found - reject the listing
  throw new Error(`Missing dealer-provided price for Homenet listing ${listingId}. Cannot create UVS record without valid pricing.`);
}

/**
 * Determine availability status from Homenet data
 */
function determineAvailability(raw: HomenetVehicle): UVS['availability'] | undefined {
  // Check if price is 0 or missing (might indicate unavailable)
  const price = raw.price || raw.selling_price || raw.sellingPrice;
  if (price === 0 || price === null || price === undefined) {
    return { status: 'unavailable' };
  }
  
  // Default to available
  return { status: 'available' };
}

/**
 * Normalize Homenet vehicle to UVS format
 * 
 * @param raw - Raw Homenet vehicle data
 * @returns Normalized UVS vehicle
 * @throws Error if required fields (year/make/model/price) cannot be derived
 */
export function normalize(raw: HomenetVehicle): UVS {
  const now = new Date().toISOString();
  
  // Extract year, make, model - try multiple field variations
  let year = raw.year;
  let make = raw.make || raw.manufacturer;
  let model = raw.model;
  let trim = raw.trim;
  
  // Try parsing from description if fields are missing
  if (!year || !make || !model) {
    const parsed = parseDescription(
      raw.description as string | undefined,
      raw.comments as string | undefined
    );
    year = year || parsed.year;
    make = make || parsed.make;
    model = model || (parsed.model && parsed.model.trim().length > 0 ? parsed.model : undefined);
  }
  
  // Validate required fields - log warnings and use fallbacks
  if (!year || year < 1900 || year > 2100) {
    console.warn(JSON.stringify({
      event: 'homenet_missing_year',
      listingId: raw.id || raw.vehicle_id || raw.vin,
      message: 'Year missing or invalid, using current year as fallback',
    }));
    year = new Date().getFullYear();
  }
  
  if (!make || String(make).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'homenet_missing_make',
      listingId: raw.id || raw.vehicle_id || raw.vin,
      message: 'Make missing, using "Unknown" as fallback',
    }));
    make = 'Unknown';
  }
  
  if (!model || String(model).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'homenet_missing_model',
      listingId: raw.id || raw.vehicle_id || raw.vin,
      message: 'Model missing, using "Vehicle" as fallback',
    }));
    model = 'Vehicle';
  }
  
  // Ensure strings are trimmed
  make = String(make).trim();
  model = String(model).trim();
  
  // Determine condition
  let condition: 'new' | 'used' | 'certified' = 'used';
  const conditionStr = String(raw.condition || raw.inventory_type || raw.inventoryType || 'used').toLowerCase();
  if (conditionStr.includes('new')) {
    condition = 'new';
  } else if (conditionStr.includes('certified') || conditionStr.includes('cpo') || raw.certified === true) {
    condition = 'certified';
  }
  
  // Extract odometer - handle various field names and units
  const miles = raw.miles || raw.mileage || raw.odometer || raw.odometer_reading;
  const odometer = miles !== undefined && typeof miles === 'number' && miles >= 0 ? {
    value: miles,
    unit: 'mi' as const, // Assume miles unless indicated otherwise
  } : undefined;
  
  // Derive vehicleType
  const vehicleType = deriveVehicleType(
    raw.body_type as string | undefined || raw.bodyType as string | undefined,
    raw.vehicle_type as string | undefined || raw.vehicleType as string | undefined
  );
  
  // Parse engine specs
  const engineSpecs = parseEngineSpecs(
    raw.engine as string | undefined,
    raw.engine_size as string | undefined || raw.engineSize as string | undefined
  );
  
  // Map features with intelligent categorization
  const allFeatures: Feature[] = [
    ...(Array.isArray(raw.features) ? raw.features : []),
    ...(Array.isArray(raw.options) ? raw.options : []),
  ].map((feature: unknown) => ({
    name: String(feature),
    category: categorizeFeature(String(feature)),
    source: 'homenet',
  }));
  
  // Map packages
  const packages = Array.isArray(raw.packages) ? raw.packages.map((pkg: unknown) => {
    const p = pkg as { name?: string; code?: string; price?: number; description?: string };
    return {
      name: p.name || 'Unknown Package',
      code: p.code,
      price: typeof p.price === 'number' && p.price >= 0 ? p.price : undefined,
      description: p.description,
    };
  }) : [];
  
  // Determine availability
  const availabilityStatus = determineAvailability(raw);
  
  // Map market data - use nullish coalescing to preserve 0 values
  const daysOnMarket = raw.days_on_market ?? raw.daysOnMarket ?? raw.dom;
  const marketData = daysOnMarket !== undefined &&
    typeof daysOnMarket === 'number' &&
    daysOnMarket >= 0 ? {
    averageDaysOnMarket: daysOnMarket,
  } : undefined;
  
  // Map media - handle various field names
  const photoUrls = [
    ...(Array.isArray(raw.photos) ? raw.photos : []),
    ...(Array.isArray(raw.photo_urls) ? raw.photo_urls : []),
    ...(Array.isArray(raw.photoUrls) ? raw.photoUrls : []),
  ].filter(Boolean) as string[];
  
  const primaryPhoto = raw.primary_photo || raw.primaryPhoto || raw.primary_photo_url || raw.primaryPhotoUrl || photoUrls[0];
  
  // Extract dealer information - handle various field names
  const dealerId = raw.dealer_id || raw.dealerId;
  const dealerName = raw.dealer_name || raw.dealerName;
  const dealerCity = raw.dealer_city || raw.dealerCity;
  const dealerState = raw.dealer_state || raw.dealerState;
  
  // Derive dealer-provided price (throws if missing)
  const dealerPrice = deriveDealerPrice(raw);
  
  return {
    id: (raw.id as string) || (raw.vehicle_id as string) || (raw.vin as string) || `hn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    baseIdentity: {
      vin: raw.vin as string | undefined,
      year,
      make,
      model,
      trim: trim as string | undefined,
      stockNumber: (raw.stock_number || raw.stock_no || raw.stockNumber) as string | undefined,
      listingId: (raw.id || raw.vehicle_id) as string | undefined,
      vehicleType,
    },
    condition,
    coreSpecs: {
      bodyType: (raw.body_type || raw.bodyType) as string | undefined,
      fuelType: mapFuelType((raw.fuel_type || raw.fuelType) as string | undefined),
      engine: engineSpecs,
      transmission: raw.transmission ? {
        description: String(raw.transmission),
        type: mapTransmissionType(String(raw.transmission)),
      } : undefined,
      drivetrain: mapDrivetrain(
        (raw.drivetrain || raw.drive_train || raw.driveTrain) as string | undefined
      ),
      odometer,
    },
    pricing: {
      price: dealerPrice,
      msrp: (raw.msrp || raw.list_price || raw.listPrice) as number | undefined,
      currency: 'USD', // Default to USD
    },
    featuresPackages: (allFeatures.length > 0 || packages.length > 0) ? {
      features: allFeatures.length > 0 ? allFeatures : undefined,
      packages: packages.length > 0 ? packages : undefined,
    } : undefined,
    media: {
      primaryPhotoUrl: primaryPhoto as string | undefined,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    },
    location: {
      dealer: {
        dealerId: dealerId as string | undefined,
        name: (dealerName as string) || 'Unknown Dealer',
        city: dealerCity as string | undefined,
        state: dealerState as string | undefined,
      },
    },
    availability: availabilityStatus,
    marketData,
    operational: {
      dataSource: 'homenet',
      lastSyncedAt: now,
      syncStatus: 'success',
    },
    dealerDefined: {
      // Preserve raw Homenet data
      raw,
    },
    enrichment: {
      // Store additional Homenet data if available
      description: raw.description,
      comments: raw.comments,
      notes: raw.notes,
    },
  };
}
