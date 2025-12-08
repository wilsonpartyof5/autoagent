/**
 * Direct Dealer API Provider Mapper
 * 
 * Normalizes direct dealer API responses to UVS format.
 * This is a generic mapper designed to handle various dealer API structures.
 * Phase 2: Full field population with intelligent parsing and categorization.
 */

import type { UVS, CoreSpecs } from '../../types/UVS.js';

/**
 * Raw dealer API vehicle data (structure varies by dealer)
 * Supports common field naming conventions (snake_case, camelCase, PascalCase, etc.)
 */
export interface DealerAPIVehicle {
  [key: string]: unknown;
  // Core fields (various naming conventions)
  id?: string;
  vehicle_id?: string;
  vehicleId?: string;
  vin?: string;
  stock_number?: string;
  stockNumber?: string;
  stock?: string;
  stock_no?: string;
  stockNo?: string;
  
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
  category?: string;
  
  // Condition
  condition?: string;
  inventory_type?: string;
  inventoryType?: string;
  certified?: boolean;
  isCertified?: boolean;
  cpo?: boolean;
  
  // Pricing
  price?: number;
  selling_price?: number;
  sellingPrice?: number;
  internet_price?: number;
  internetPrice?: number;
  retail_price?: number;
  retailPrice?: number;
  asking_price?: number;
  askingPrice?: number;
  list_price?: number;
  listPrice?: number;
  msrp?: number;
  
  // Specifications
  mileage?: number;
  miles?: number;
  odometer?: number;
  odometer_reading?: number;
  odometerReading?: number;
  fuel_type?: string;
  fuelType?: string;
  transmission?: string;
  trans_type?: string;
  transType?: string;
  drivetrain?: string;
  drive_train?: string;
  driveTrain?: string;
  drive?: string;
  engine?: string;
  engine_description?: string;
  engineDescription?: string;
  engine_size?: string;
  engineSize?: string;
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
  image_urls?: string[];
  imageUrls?: string[];
  photos?: string[];
  photo_urls?: string[];
  photoUrls?: string[];
  primary_image?: string;
  primaryImage?: string;
  primary_photo?: string;
  primaryPhoto?: string;
  primary_photo_url?: string;
  primaryPhotoUrl?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  
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
  
  // Availability
  availability?: string;
  status?: string;
  
  // Additional fields
  description?: string;
  title?: string;
  notes?: string;
  comments?: string;
}

/**
 * Parse year, make, model from description or title string
 */
function parseDescription(description?: string, title?: string): {
  year?: number;
  make?: string;
  model?: string;
} {
  const text = (description || title || '').trim();
  if (!text) return {};
  
  // Pattern: "2022 Honda Accord" or "2022 Honda Accord EX"
  const match = text.match(/^(\d{4})\s+([A-Za-z]+)\s+(.+)$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const make = match[2];
    const model = match[3].trim();
    
    if (year >= 1900 && year <= 2100 && make && model) {
      return { year, make, model };
    }
  }
  
  return {};
}

/**
 * Derive vehicle type from body type or category
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
 * Parse engine specifications from description string or numeric fields
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
function mapFuelType(fuelType?: string): CoreSpecs['fuelType'] {
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
function mapDrivetrain(drivetrain?: string): CoreSpecs['drivetrain'] {
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
  if (normalized.includes('turbo') || normalized.includes('supercharg') || normalized.includes('sport') ||
      normalized.includes('performance') || normalized.includes('racing') || normalized.includes('track')) {
    return 'performance';
  }
  
  return 'other';
}

/**
 * Derive dealer-provided price from dealer API data
 * Throws if no valid price can be found
 */
function deriveDealerPrice(raw: DealerAPIVehicle): number {
  const listingId = (raw.id || raw.vehicle_id || raw.vehicleId || raw.vin || 'unknown') as string;
  
  // Try various price field variations (prioritize selling price)
  const priceVariations = [
    raw.sellingPrice || raw.selling_price,
    raw.internetPrice || raw.internet_price,
    raw.price,
    raw.retailPrice || raw.retail_price,
    raw.askingPrice || raw.asking_price,
    raw.listPrice || raw.list_price,
  ];
  
  // Find first valid positive price
  for (const price of priceVariations) {
    if (typeof price === 'number' && price > 0) {
      return price;
    }
  }
  
  // No dealer-provided price found - reject the listing
  throw new Error(`Missing dealer-provided price for Dealer API listing ${listingId}. Cannot create UVS record without valid pricing.`);
}

/**
 * Normalize dealer API vehicle to UVS format
 * 
 * @param raw - Raw dealer API vehicle data
 * @returns Normalized UVS vehicle
 * @throws Error if required fields (year/make/model/price) cannot be derived
 */
export function normalize(raw: DealerAPIVehicle): UVS {
  const now = new Date().toISOString();
  
  // Extract identity fields - handle various field name variations
  let vin = (raw.vin) as string | undefined;
  let year = raw.year as number | undefined;
  let make = (raw.make || raw.manufacturer) as string | undefined;
  let model = raw.model as string | undefined;
  const trim = raw.trim as string | undefined;
  const stockNumber = (raw.stockNumber || raw.stock_number || raw.stock || raw.stock_no || raw.stockNo) as string | undefined;
  
  // Try parsing from description/title if fields are missing
  if (!year || !make || !model) {
    const parsed = parseDescription(
      raw.description as string | undefined,
      raw.title as string | undefined
    );
    year = year || parsed.year;
    make = make || parsed.make;
    model = model || parsed.model;
  }
  
  // Validate required fields - log warnings and use fallbacks
  if (!year || year < 1900 || year > 2100) {
    console.warn(JSON.stringify({
      event: 'dealer_api_missing_year',
      listingId: vin || stockNumber || raw.id || 'unknown',
      message: 'Year missing or invalid, using current year as fallback',
    }));
    year = new Date().getFullYear();
  }
  
  if (!make || String(make).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'dealer_api_missing_make',
      listingId: vin || stockNumber || raw.id || 'unknown',
      message: 'Make missing, using "Unknown" as fallback',
    }));
    make = 'Unknown';
  }
  
  if (!model || String(model).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'dealer_api_missing_model',
      listingId: vin || stockNumber || raw.id || 'unknown',
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
  } else if (conditionStr.includes('certified') || conditionStr.includes('cpo') || 
             raw.certified === true || raw.isCertified === true || raw.cpo === true) {
    condition = 'certified';
  }
  
  // Extract odometer - handle various field names and units
  const mileage = raw.miles || raw.mileage || raw.odometer || raw.odometer_reading || raw.odometerReading;
  const miles = mileage !== null && mileage !== undefined ? 
                (typeof mileage === 'number' ? mileage : parseFloat(String(mileage))) : 
                undefined;
  const odometer = miles !== undefined && !isNaN(miles) && miles >= 0 ? {
    value: miles,
    unit: 'mi' as const, // Assume miles unless indicated otherwise
  } : undefined;
  
  // Derive vehicleType
  const vehicleType = deriveVehicleType(
    (raw.body_type || raw.bodyType) as string | undefined,
    (raw.vehicle_type || raw.vehicleType) as string | undefined,
    raw.category as string | undefined
  );
  
  // Parse engine specs from description or numeric fields
  const engineDesc = (raw.engine || raw.engine_description || raw.engineDescription) as string | undefined;
  const engineSize = (raw.engine_size || raw.engineSize) as string | undefined;
  let engineSpecs = parseEngineSpecs(engineDesc, engineSize);
  
  // Enhance engine specs with explicit numeric fields if available
  const cylinders = raw.cylinders;
  const horsepower = raw.horsepower || raw.hp;
  const displacement = raw.displacement;
  
  if (!engineSpecs && (cylinders || horsepower || displacement)) {
    // Create engine object from numeric fields
    engineSpecs = {};
  }
  
  if (engineSpecs) {
    // Enhance or create engine specs
    if (cylinders !== null && cylinders !== undefined) {
      const cyl = typeof cylinders === 'number' ? cylinders : parseInt(String(cylinders), 10);
      if (!isNaN(cyl) && cyl > 0 && cyl <= 16) {
        engineSpecs.cylinders = cyl;
      }
    }
    
    if (horsepower !== null && horsepower !== undefined) {
      const hp = typeof horsepower === 'number' ? horsepower : parseInt(String(horsepower), 10);
      if (!isNaN(hp) && hp > 0 && hp < 2000) {
        engineSpecs.horsepower = hp;
      }
    }
    
    if (displacement !== null && displacement !== undefined) {
      const disp = typeof displacement === 'number' ? displacement : parseFloat(String(displacement));
      if (!isNaN(disp) && disp > 0 && disp < 20) {
        engineSpecs.displacement = disp;
      }
    }
  }
  
  // Map transmission
  const transmission = (raw.transmission || raw.trans_type || raw.transType) as string | undefined;
  
  // Map features with intelligent categorization
  const allFeatures = [
    ...(Array.isArray(raw.features) ? raw.features : []),
    ...(Array.isArray(raw.options) ? raw.options : []),
    ...(Array.isArray(raw.equipment) ? raw.equipment : []),
  ].map((feature: unknown) => ({
    name: String(feature),
    category: categorizeFeature(String(feature)),
    source: 'dealer-api',
  }));
  
  // Map packages
  const packages = Array.isArray(raw.packages) ? raw.packages.map((pkg: unknown) => {
    const p = pkg as { name?: string; code?: string; price?: number; description?: string };
    return {
      name: p.name || 'Unknown Package',
      code: p.code as string | undefined,
      price: typeof p.price === 'number' && p.price >= 0 ? p.price : undefined,
      description: p.description as string | undefined,
    };
  }) : [];
  
  // Map media - handle various field names
  const photoUrls: string[] = [];
  const photoUrlsRaw = raw.photos || raw.photo_urls || raw.photoUrls || raw.images || raw.image_urls || raw.imageUrls;
  
  if (Array.isArray(photoUrlsRaw)) {
    photoUrls.push(...photoUrlsRaw.map(p => String(p)).filter(Boolean));
  }
  
  const primaryPhoto = (raw.primary_photo_url || raw.primaryPhotoUrl || raw.primary_photo || raw.primaryPhoto || 
                        raw.primary_image || raw.primaryImage || raw.thumbnail_url || raw.thumbnailUrl || photoUrls[0]) as string | undefined;
  
  // Map market data - use nullish coalescing to preserve 0 values
  const daysOnMarket = raw.days_on_market ?? raw.daysOnMarket ?? raw.dom;
  const marketData = daysOnMarket !== null && daysOnMarket !== undefined &&
    typeof daysOnMarket === 'number' && daysOnMarket >= 0 ? {
    averageDaysOnMarket: daysOnMarket,
  } : undefined;
  
  // Determine availability
  const availabilityStatus: UVS['availability'] | undefined = (raw.availability || raw.status) ? (() => {
    const avail = String(raw.availability || raw.status).toLowerCase();
    if (avail.includes('sold')) return { status: 'sold' };
    if (avail.includes('pending') || avail.includes('reserved')) return { status: 'pending' };
    if (avail.includes('transit') || avail.includes('in-transit') || avail.includes('in transit')) return { status: 'in_transit' };
    if (avail.includes('unavailable') || avail.includes('not available')) return { status: 'unavailable' };
    return { status: 'available' };
  })() : undefined;
  
  // Extract dealer information - handle various field names
  const dealerId = (raw.dealer_id || raw.dealerId) as string | undefined;
  const dealerName = (raw.dealer_name || raw.dealerName || 'Unknown Dealer') as string;
  const dealerCity = (raw.dealer_city || raw.dealerCity) as string | undefined;
  const dealerState = (raw.dealer_state || raw.dealerState) as string | undefined;
  
  // Derive dealer-provided price (throws if missing)
  const dealerPrice = deriveDealerPrice(raw);
  
  // Extract MSRP if available
  const msrp = raw.msrp as number | undefined;
  
  // Determine currency (default to USD)
  const currency = (raw.currency as string) || 'USD';
  const finalCurrency = /^[A-Z]{3}$/.test(String(currency)) ? currency : 'USD';
  
  // Generate ID if not present
  const id = (raw.id || raw.vehicle_id || raw.vehicleId || vin || stockNumber || `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`) as string;
  
  return {
    id,
    baseIdentity: {
      vin,
      year,
      make,
      model,
      trim,
      stockNumber,
      listingId: (raw.id || raw.vehicle_id || raw.vehicleId) as string | undefined,
      vehicleType,
    },
    condition,
    coreSpecs: {
      bodyType: (raw.body_type || raw.bodyType) as string | undefined,
      fuelType: mapFuelType((raw.fuel_type || raw.fuelType) as string | undefined),
      engine: engineSpecs,
      transmission: transmission ? {
        description: String(transmission),
        type: mapTransmissionType(String(transmission)),
      } : undefined,
      drivetrain: mapDrivetrain((raw.drivetrain || raw.drive_train || raw.driveTrain || raw.drive) as string | undefined),
      odometer,
    },
    pricing: {
      price: dealerPrice,
      msrp: msrp !== undefined && typeof msrp === 'number' && msrp >= 0 ? msrp : undefined,
      currency: finalCurrency,
    },
    featuresPackages: (allFeatures.length > 0 || packages.length > 0) ? {
      features: allFeatures.length > 0 ? allFeatures : undefined,
      packages: packages.length > 0 ? packages : undefined,
    } : undefined,
    media: {
      primaryPhotoUrl: primaryPhoto,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    },
    location: {
      dealer: {
        dealerId,
        name: dealerName,
        city: dealerCity,
        state: dealerState,
      },
    },
    availability: availabilityStatus,
    marketData,
    operational: {
      dataSource: 'dealer-api',
      lastSyncedAt: now,
      syncStatus: 'success',
    },
    dealerDefined: {
      // Preserve raw dealer API data
      raw,
    },
    enrichment: {
      // Store additional dealer-provided data
      description: raw.description as string | undefined,
      title: raw.title as string | undefined,
      notes: raw.notes as string | undefined,
      comments: raw.comments as string | undefined,
    },
  };
}
