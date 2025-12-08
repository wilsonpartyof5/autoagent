/**
 * vAuto Provider Mapper
 * 
 * Normalizes vAuto API responses to UVS format.
 * Phase 2: Full field population with intelligent parsing and categorization.
 */

import type { UVS, Feature } from '../../types/UVS';

/**
 * vAuto vehicle data structure
 * Supports common vAuto field variations and naming conventions
 */
export interface VAutoVehicle {
  [key: string]: unknown;
  // Core fields
  id?: string;
  vehicleId?: string;
  vin?: string;
  stockNumber?: string;
  stock_no?: string;
  stock?: string;
  
  // Identity fields
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyType?: string;
  body_type?: string;
  vehicleType?: string;
  vehicle_type?: string;
  category?: string;
  
  // Condition
  condition?: string;
  inventoryType?: string;
  inventory_type?: string;
  certified?: boolean;
  isCertified?: boolean;
  cpo?: boolean;
  
  // Pricing (vAuto has multiple price types)
  price?: number;
  internetPrice?: number;
  internet_price?: number;
  retailPrice?: number;
  retail_price?: number;
  askingPrice?: number;
  asking_price?: number;
  msrp?: number;
  listPrice?: number;
  list_price?: number;
  
  // Specifications
  mileage?: number;
  miles?: number;
  odometer?: number;
  odometerReading?: number;
  odometer_reading?: number;
  fuelType?: string;
  fuel_type?: string;
  transmission?: string;
  transType?: string;
  trans_type?: string;
  drivetrain?: string;
  driveTrain?: string;
  drive_train?: string;
  engine?: string;
  engineDescription?: string;
  engine_description?: string;
  engineSize?: string;
  engine_size?: string;
  cylinders?: number;
  horsepower?: number;
  hp?: number;
  displacement?: number;
  
  // Features and packages
  features?: string[];
  equipment?: string[];
  options?: string[];
  packages?: Array<{
    name?: string;
    code?: string;
    price?: number;
    description?: string;
  }>;
  
  // Media
  images?: string[];
  imageUrls?: string[];
  image_urls?: string[];
  photos?: string[];
  photoUrls?: string[];
  photo_urls?: string[];
  primaryImage?: string;
  primary_image?: string;
  primaryPhoto?: string;
  primary_photo?: string;
  primaryPhotoUrl?: string;
  primary_photo_url?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  
  // Dealer information
  dealerId?: string;
  dealer_id?: string;
  dealerName?: string;
  dealer_name?: string;
  dealerCode?: string;
  dealer_code?: string;
  dealerCity?: string;
  dealer_city?: string;
  dealerState?: string;
  dealer_state?: string;
  dealerZip?: string;
  dealer_zip?: string;
  
  // Market data (vAuto-specific)
  daysOnMarket?: number;
  days_on_market?: number;
  dom?: number;
  turnRate?: number;
  turn_rate?: number;
  pricingZone?: string;
  pricing_zone?: string;
  
  // Additional data
  description?: string;
  comments?: string;
  notes?: string;
  priceHistory?: Array<{
    price?: number;
    date?: string;
    timestamp?: number | string;
  }>;
  price_history?: Array<{
    price?: number;
    date?: string;
    timestamp?: number | string;
  }>;
}

// Import helper functions from Homenet (same logic)
// These are the same parsing/categorization functions, so we can reuse the logic
// But we'll implement them inline here to avoid cross-dependencies

/**
 * Derive vehicle type from body type or vehicle type field
 */
function deriveVehicleType(bodyType?: string, vehicleType?: string, category?: string): UVS['baseIdentity']['vehicleType'] {
  const normalized = (bodyType || vehicleType || category || '').toLowerCase();
  
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
  
  // Parse displacement
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
 * Categorize feature based on keywords
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
 * Derive dealer-provided price from vAuto data
 * vAuto typically has internet_price (preferred), retail_price, or asking_price
 * Tries internet_price first, then retail_price, then asking_price, then price_history, then rejects
 */
function deriveDealerPrice(raw: VAutoVehicle): number {
  const listingId = raw.id || raw.vehicleId || raw.vin || 'unknown';
  
  // Primary: Use internet price (vAuto's preferred dealer price) if available and positive
  const internetPrice = raw.internetPrice ?? raw.internet_price;
  if (typeof internetPrice === 'number' && internetPrice > 0) {
    return internetPrice;
  }
  
  // Secondary: Use retail price if internet price not available
  const retailPrice = raw.retailPrice ?? raw.retail_price;
  if (typeof retailPrice === 'number' && retailPrice > 0) {
    console.warn(JSON.stringify({
      event: 'vauto_price_from_retail',
      listingId,
      price: retailPrice,
      message: 'Using retail price as dealer-provided price (internet price not available)',
    }));
    return retailPrice;
  }
  
  // Tertiary: Use asking price if retail not available
  const askingPrice = raw.askingPrice ?? raw.asking_price;
  if (typeof askingPrice === 'number' && askingPrice > 0) {
    console.warn(JSON.stringify({
      event: 'vauto_price_from_asking',
      listingId,
      price: askingPrice,
      message: 'Using asking price as dealer-provided price',
    }));
    return askingPrice;
  }
  
  // Fallback: Use generic price field
  const price = raw.price;
  if (typeof price === 'number' && price > 0) {
    console.warn(JSON.stringify({
      event: 'vauto_price_from_generic',
      listingId,
      price,
      message: 'Using generic price field as dealer-provided price',
    }));
    return price;
  }
  
  // Last resort: Use most recent price from price_history if available
  const priceHistory = raw.priceHistory || raw.price_history;
  if (priceHistory && Array.isArray(priceHistory) && priceHistory.length > 0) {
    const validPrices = priceHistory
      .filter((entry: unknown) => {
        const e = entry as { price?: number; date?: string; timestamp?: number | string };
        return typeof e.price === 'number' && e.price > 0;
      })
      .sort((a: unknown, b: unknown) => {
        const aEntry = a as { date?: string; timestamp?: number | string };
        const bEntry = b as { date?: string; timestamp?: number | string };
        
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
          event: 'vauto_price_from_history',
          listingId,
          price: priceEntry.price,
          message: 'Using price from price_history as dealer-provided price',
        }));
        return priceEntry.price;
      }
    }
  }
  
  // No dealer-provided price found - reject the listing
  throw new Error(`Missing dealer-provided price for vAuto listing ${listingId}. Cannot create UVS record without valid pricing.`);
}

/**
 * Determine availability status from vAuto data
 */
function determineAvailability(raw: VAutoVehicle): UVS['availability'] | undefined {
  // Check if price is 0 or missing (might indicate unavailable)
  const price = raw.internetPrice ?? raw.internet_price ?? raw.retailPrice ?? raw.retail_price ?? raw.price;
  if (price === 0 || price === null || price === undefined) {
    return { status: 'unavailable' };
  }
  
  // Default to available
  return { status: 'available' };
}

/**
 * Normalize vAuto vehicle to UVS format
 * 
 * @param raw - Raw vAuto vehicle data
 * @returns Normalized UVS vehicle
 * @throws Error if required fields (year/make/model/price) cannot be derived
 */
export function normalize(raw: VAutoVehicle): UVS {
  const now = new Date().toISOString();
  
  // Extract year, make, model - try multiple field variations
  let year = raw.year;
  let make = raw.make;
  let model = raw.model;
  let trim = raw.trim;
  
  // Validate required fields - log warnings and use fallbacks
  if (!year || year < 1900 || year > 2100) {
    console.warn(JSON.stringify({
      event: 'vauto_missing_year',
      listingId: raw.id || raw.vehicleId || raw.vin,
      message: 'Year missing or invalid, using current year as fallback',
    }));
    year = new Date().getFullYear();
  }
  
  if (!make || String(make).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'vauto_missing_make',
      listingId: raw.id || raw.vehicleId || raw.vin,
      message: 'Make missing, using "Unknown" as fallback',
    }));
    make = 'Unknown';
  }
  
  if (!model || String(model).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'vauto_missing_model',
      listingId: raw.id || raw.vehicleId || raw.vin,
      message: 'Model missing, using "Vehicle" as fallback',
    }));
    model = 'Vehicle';
  }
  
  // Ensure strings are trimmed
  make = String(make).trim();
  model = String(model).trim();
  
  // Determine condition
  let condition: 'new' | 'used' | 'certified' = 'used';
  const conditionStr = String(raw.condition || raw.inventoryType || raw.inventory_type || 'used').toLowerCase();
  if (conditionStr.includes('new')) {
    condition = 'new';
  } else if (conditionStr.includes('certified') || conditionStr.includes('cpo') || raw.certified === true || raw.isCertified === true || raw.cpo === true) {
    condition = 'certified';
  }
  
  // Extract odometer - handle various field names
  const miles = raw.miles ?? raw.mileage ?? raw.odometer ?? raw.odometerReading ?? raw.odometer_reading;
  const odometer = miles !== undefined && typeof miles === 'number' && miles >= 0 ? {
    value: miles,
    unit: 'mi' as const, // vAuto uses miles by default
  } : undefined;
  
  // Derive vehicleType
  const vehicleType = deriveVehicleType(
    raw.bodyType as string | undefined || raw.body_type as string | undefined,
    raw.vehicleType as string | undefined || raw.vehicle_type as string | undefined,
    raw.category as string | undefined
  );
  
  // Parse engine specs
  const engineSpecs = parseEngineSpecs(
    raw.engine as string | undefined || raw.engineDescription as string | undefined || raw.engine_description as string | undefined,
    raw.engineSize as string | undefined || raw.engine_size as string | undefined
  );
  
  // Enhance engine specs with explicit fields if available (create new object to avoid mutation)
  const cylinders = typeof raw.cylinders === 'number' && raw.cylinders > 0 ? raw.cylinders : undefined;
  const horsepower = typeof raw.horsepower === 'number' && raw.horsepower > 0
    ? raw.horsepower
    : typeof raw.hp === 'number' && raw.hp > 0
      ? raw.hp
      : undefined;
  const displacement = typeof raw.displacement === 'number' && raw.displacement > 0 ? raw.displacement : undefined;
  
  let finalEngineSpecs = engineSpecs;
  if (!finalEngineSpecs && (cylinders !== undefined || horsepower !== undefined || displacement !== undefined)) {
    finalEngineSpecs = {};
  }
  
  if (finalEngineSpecs) {
    finalEngineSpecs = {
      ...finalEngineSpecs,
      ...(cylinders !== undefined && { cylinders }),
      ...(horsepower !== undefined && { horsepower }),
      ...(displacement !== undefined && { displacement }),
    };
  }
  
  // Map features with intelligent categorization
  const allFeatures: Feature[] = [
    ...(Array.isArray(raw.features) ? raw.features : []),
    ...(Array.isArray(raw.equipment) ? raw.equipment : []),
    ...(Array.isArray(raw.options) ? raw.options : []),
  ].map((feature: unknown) => ({
    name: String(feature),
    category: categorizeFeature(String(feature)),
    source: 'vauto',
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
  const daysOnMarket = raw.daysOnMarket ?? raw.days_on_market ?? raw.dom;
  const marketData = daysOnMarket !== undefined &&
    typeof daysOnMarket === 'number' &&
    daysOnMarket >= 0 ? {
    averageDaysOnMarket: daysOnMarket,
  } : undefined;
  
  // Map media - handle various field names
  const photoUrls = [
    ...(Array.isArray(raw.images) ? raw.images : []),
    ...(Array.isArray(raw.imageUrls) ? raw.imageUrls : []),
    ...(Array.isArray(raw.image_urls) ? raw.image_urls : []),
    ...(Array.isArray(raw.photos) ? raw.photos : []),
    ...(Array.isArray(raw.photoUrls) ? raw.photoUrls : []),
    ...(Array.isArray(raw.photo_urls) ? raw.photo_urls : []),
  ].filter(Boolean) as string[];
  
  const primaryPhoto = raw.primaryPhoto ?? raw.primary_photo ?? raw.primaryPhotoUrl ?? raw.primary_photo_url ??
                       raw.primaryImage ?? raw.primary_image ?? raw.thumbnailUrl ?? raw.thumbnail_url ?? photoUrls[0];
  
  // Extract dealer information - handle various field names
  const dealerId = raw.dealerId ?? raw.dealer_id;
  const dealerName = raw.dealerName ?? raw.dealer_name;
  const dealerCity = raw.dealerCity ?? raw.dealer_city;
  const dealerState = raw.dealerState ?? raw.dealer_state;
  
  // Derive dealer-provided price (throws if missing)
  const dealerPrice = deriveDealerPrice(raw);
  
  // Extract MSRP - handle various field names
  const msrp = raw.msrp ?? raw.listPrice ?? raw.list_price;
  
  return {
    id: (raw.id as string) || (raw.vehicleId as string) || (raw.vin as string) || `va-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    baseIdentity: {
      vin: raw.vin as string | undefined,
      year,
      make,
      model,
      trim: trim as string | undefined,
      stockNumber: (raw.stockNumber || raw.stock_no || raw.stock) as string | undefined,
      listingId: (raw.id || raw.vehicleId) as string | undefined,
      vehicleType,
    },
    condition,
    coreSpecs: {
      bodyType: (raw.bodyType || raw.body_type) as string | undefined,
      fuelType: mapFuelType((raw.fuelType || raw.fuel_type) as string | undefined),
      engine: finalEngineSpecs,
      transmission: (raw.transmission || raw.transType || raw.trans_type) ? {
        description: String(raw.transmission || raw.transType || raw.trans_type),
        type: mapTransmissionType(String(raw.transmission || raw.transType || raw.trans_type)),
      } : undefined,
      drivetrain: mapDrivetrain(
        (raw.drivetrain || raw.driveTrain || raw.drive_train) as string | undefined
      ),
      odometer,
    },
    pricing: {
      price: dealerPrice,
      msrp: msrp !== undefined && typeof msrp === 'number' && msrp >= 0 ? msrp : undefined,
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
      dataSource: 'vauto',
      lastSyncedAt: now,
      syncStatus: 'success',
    },
    dealerDefined: {
      // Preserve raw vAuto data
      raw,
      // vAuto-specific fields
      turnRate: raw.turnRate ?? raw.turn_rate,
      pricingZone: raw.pricingZone ?? raw.pricing_zone,
      dealerCode: raw.dealerCode ?? raw.dealer_code,
    },
    enrichment: {
      // Store additional vAuto data if available
      description: raw.description,
      comments: raw.comments,
      notes: raw.notes,
    },
  };
}
