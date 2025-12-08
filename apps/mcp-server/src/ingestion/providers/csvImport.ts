/**
 * CSV Import Provider Mapper
 * 
 * Normalizes CSV-imported vehicle data to UVS format.
 * Assumes CSV has been parsed to a flat object structure.
 * Phase 2: Full field population with intelligent parsing and categorization.
 */

import type { UVS, CoreSpecs } from '../../types/UVS';

/**
 * CSV row as parsed object (column names may vary widely)
 * Supports common CSV column name variations (VIN/vin/Vin, Year/year/YEAR, etc.)
 */
export interface CSVVehicleRow {
  [key: string]: string | number | null | undefined;
  // Common CSV column names:
  // VIN, Year, Make, Model, Trim, Stock, Price, MSRP, Condition, Mileage, etc.
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
 * Derive dealer-provided price from CSV row
 * Throws if no valid price can be found
 */
function deriveDealerPrice(raw: CSVVehicleRow): number {
  const listingId = (raw.id || raw.ID || raw.VIN || raw.vin || raw['Listing ID'] || 'unknown') as string;
  
  // Try various price field variations (prioritize selling price)
  const priceVariations = [
    raw['Selling Price'] as number,
    raw.sellingPrice as number,
    raw['Selling_Price'] as number,
    raw.Price as number,
    raw.price as number,
    raw.PRICE as number,
    raw['List Price'] as number,
    raw.listPrice as number,
    raw['List_Price'] as number,
    raw['Retail Price'] as number,
    raw.retailPrice as number,
    raw['Retail_Price'] as number,
    raw['Internet Price'] as number,
    raw.internetPrice as number,
    raw['Internet_Price'] as number,
  ];
  
  // Find first valid positive price
  for (const price of priceVariations) {
    if (typeof price === 'number' && price > 0) {
      return price;
    }
    // Try parsing string values
    if (price !== null && price !== undefined) {
      const parsed = typeof price === 'string' ? parseFloat(price) : Number(price);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  
  // No dealer-provided price found - reject the listing
  throw new Error(`Missing dealer-provided price for CSV listing ${listingId}. Cannot create UVS record without valid pricing.`);
}

/**
 * Normalize CSV vehicle row to UVS format
 * 
 * @param raw - CSV row as parsed object
 * @returns Normalized UVS vehicle
 * @throws Error if required fields (year/make/model/price) cannot be derived
 */
export function normalize(raw: CSVVehicleRow): UVS {
  const now = new Date().toISOString();
  
  // Extract identity fields - handle various CSV column name variations
  let vin = (raw.VIN || raw.vin || raw.Vin || raw['VIN Number'] || raw['VIN_Number']) as string | undefined;
  let year: number | undefined = typeof raw.Year === 'number' ? raw.Year : 
                                  typeof raw.year === 'number' ? raw.year :
                                  typeof raw.YEAR === 'number' ? raw.YEAR :
                                  raw.Year ? parseInt(String(raw.Year), 10) : undefined;
  let make = (raw.Make || raw.make || raw.MAKE || raw.Manufacturer || raw.manufacturer) as string | undefined;
  let model = (raw.Model || raw.model || raw.MODEL) as string | undefined;
  const trim = (raw.Trim || raw.trim || raw.TRIM || raw['Trim Level'] || raw['Trim_Level']) as string | undefined;
  const stockNumber = (raw.Stock || raw.stock || raw.STOCK || raw['Stock Number'] || raw['Stock_Number'] || raw['Stock No'] || raw['Stock_No']) as string | undefined;
  
  // Try parsing from description/title if fields are missing
  if (!year || !make || !model) {
    const parsed = parseDescription(
      (raw.Description || raw.description || raw.DESC || raw.desc) as string | undefined,
      (raw.Title || raw.title || raw.TITLE) as string | undefined
    );
    year = year || parsed.year;
    make = make || parsed.make;
    model = model || parsed.model;
  }
  
  // Validate required fields - log warnings and use fallbacks
  if (!year || year < 1900 || year > 2100) {
    console.warn(JSON.stringify({
      event: 'csv_missing_year',
      listingId: vin || stockNumber || 'unknown',
      message: 'Year missing or invalid, using current year as fallback',
    }));
    year = new Date().getFullYear();
  }
  
  if (!make || String(make).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'csv_missing_make',
      listingId: vin || stockNumber || 'unknown',
      message: 'Make missing, using "Unknown" as fallback',
    }));
    make = 'Unknown';
  }
  
  if (!model || String(model).trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'csv_missing_model',
      listingId: vin || stockNumber || 'unknown',
      message: 'Model missing, using "Vehicle" as fallback',
    }));
    model = 'Vehicle';
  }
  
  // Ensure strings are trimmed
  make = String(make).trim();
  model = String(model).trim();
  
  // Determine condition
  let condition: 'new' | 'used' | 'certified' = 'used';
  const conditionStr = String(raw.Condition || raw.condition || raw.CONDITION || raw['Inventory Type'] || raw.inventoryType || raw['Inventory_Type'] || 'used').toLowerCase();
  if (conditionStr.includes('new')) {
    condition = 'new';
  } else if (conditionStr.includes('certified') || conditionStr.includes('cpo') || conditionStr.includes('certified pre-owned')) {
    condition = 'certified';
  }
  
  // Extract odometer - handle various field names and units
  const mileage = raw.Mileage || raw.mileage || raw.MILEAGE || raw.Miles || raw.miles || raw.MILES || 
                  raw.Odometer || raw.odometer || raw.ODOMETER || raw['Odometer Reading'] || raw['Odometer_Reading'];
  const miles = mileage !== null && mileage !== undefined ? 
                (typeof mileage === 'number' ? mileage : parseFloat(String(mileage))) : 
                undefined;
  const odometer = miles !== undefined && !isNaN(miles) && miles >= 0 ? {
    value: miles,
    unit: 'mi' as const, // Assume miles unless CSV indicates otherwise
  } : undefined;
  
  // Derive vehicleType
  const vehicleType = deriveVehicleType(
    (raw['Body Type'] || raw.bodyType || raw.BodyType || raw['Body_Type']) as string | undefined,
    (raw['Vehicle Type'] || raw.vehicleType || raw.VehicleType || raw['Vehicle_Type']) as string | undefined,
    (raw.Category || raw.category || raw.CATEGORY) as string | undefined
  );
  
  // Parse engine specs from description or numeric fields
  const engineDesc = (raw.Engine || raw.engine || raw.ENGINE || raw['Engine Description'] || raw['Engine_Description'] || raw.engineDescription) as string | undefined;
  const engineSize = (raw['Engine Size'] || raw.engineSize || raw['Engine_Size'] || raw.EngineSize) as string | undefined;
  let engineSpecs = parseEngineSpecs(engineDesc, engineSize);
  
  // Enhance engine specs with explicit numeric fields if available
  const cylinders = raw.Cylinders || raw.cylinders || raw.CYLINDERS || raw['# Cylinders'] || raw['#_Cylinders'];
  const horsepower = raw.Horsepower || raw.horsepower || raw.HORSEPOWER || raw.HP || raw.hp || raw['HP'] || raw['Horse Power'] || raw['Horse_Power'];
  const displacement = raw.Displacement || raw.displacement || raw.DISPLACEMENT || raw['Engine Displacement'] || raw['Engine_Displacement'];
  
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
  const transmission = (raw.Transmission || raw.transmission || raw.TRANSMISSION || raw['Trans Type'] || raw['Trans_Type'] || raw.transType) as string | undefined;
  
  // Map features - CSV may have comma-separated string or array
  const featuresRaw = raw.Features || raw.features || raw.FEATURES || raw.Options || raw.options || raw.OPTIONS || raw.Equipment || raw.equipment || raw.EQUIPMENT;
  let allFeatures: Array<{ name: string; category: 'safety' | 'interior' | 'exterior' | 'convenience' | 'technology' | 'entertainment' | 'performance' | 'other'; source: string }> = [];
  
  if (Array.isArray(featuresRaw)) {
    allFeatures = featuresRaw.map((feature: unknown) => ({
      name: String(feature),
      category: categorizeFeature(String(feature)),
      source: 'csv-import',
    }));
  } else if (typeof featuresRaw === 'string') {
    // Split comma-separated features
    const featureList = featuresRaw.split(',').map(f => f.trim()).filter(Boolean);
    allFeatures = featureList.map(feature => ({
      name: feature,
      category: categorizeFeature(feature),
      source: 'csv-import',
    }));
  }
  
  // Map packages - CSV may have structured data or comma-separated string
  const packagesRaw = raw.Packages || raw.packages || raw.PACKAGES;
  const packages: Array<{ name: string; code?: string; price?: number; description?: string }> = [];
  
  if (Array.isArray(packagesRaw)) {
    packages.push(...packagesRaw.map((pkg: unknown) => {
      const p = pkg as { name?: string; code?: string; price?: number | string; description?: string };
      const price = p.price !== null && p.price !== undefined ? 
                   (typeof p.price === 'number' ? p.price : parseFloat(String(p.price))) : 
                   undefined;
      return {
        name: String(p.name || 'Unknown Package'),
        code: p.code as string | undefined,
        price: price !== undefined && !isNaN(price) && price >= 0 ? price : undefined,
        description: p.description as string | undefined,
      };
    }));
  }
  
  // Map media - handle various field names
  const photoUrls: string[] = [];
  const photoUrlsRaw = raw.Photos || raw.photos || raw.PHOTOS || raw['Photo URLs'] || raw['Photo_URLs'] || raw.photoUrls || raw['Photo Links'] || raw['Photo_Links'];
  
  if (Array.isArray(photoUrlsRaw)) {
    photoUrls.push(...photoUrlsRaw.map(p => String(p)).filter(Boolean));
  } else if (typeof photoUrlsRaw === 'string') {
    // Split comma-separated URLs
    photoUrls.push(...photoUrlsRaw.split(',').map(p => p.trim()).filter(Boolean));
  }
  
  const primaryPhoto = (raw['Primary Photo'] || raw.primaryPhoto || raw['Primary_Photo'] || raw['Primary Photo URL'] || raw['Primary_Photo_URL'] || raw.primaryPhotoUrl || raw['Image URL'] || raw['Image_URL'] || raw.imageUrl || photoUrls[0]) as string | undefined;
  
  // Map market data - use nullish coalescing to preserve 0 values
  const daysOnMarket = raw['Days On Market'] ?? raw.daysOnMarket ?? raw['Days_On_Market'] ?? raw.DOM ?? raw.dom ?? raw.DaysOnMarket;
  const marketData = daysOnMarket !== null && daysOnMarket !== undefined &&
    typeof daysOnMarket === 'number' && daysOnMarket >= 0 ? {
    averageDaysOnMarket: daysOnMarket,
  } : (typeof daysOnMarket === 'string' ? (() => {
    const parsed = parseFloat(daysOnMarket);
    return !isNaN(parsed) && parsed >= 0 ? { averageDaysOnMarket: parsed } : undefined;
  })() : undefined);
  
  // Determine availability
  const availability = raw.Availability || raw.availability || raw.AVAILABILITY || raw.Status || raw.status || raw.STATUS;
  const availabilityStatus: UVS['availability'] | undefined = availability ? (() => {
    const avail = String(availability).toLowerCase();
    if (avail.includes('sold')) return { status: 'sold' };
    if (avail.includes('pending') || avail.includes('reserved')) return { status: 'pending' };
    if (avail.includes('transit') || avail.includes('in-transit') || avail.includes('in transit')) return { status: 'in_transit' };
    if (avail.includes('unavailable') || avail.includes('not available')) return { status: 'unavailable' };
    return { status: 'available' };
  })() : undefined;
  
  // Extract dealer information - handle various field names
  const dealerId = (raw.dealerId || raw.dealer_id || raw['Dealer ID'] || raw['Dealer_ID'] || raw.DealerId) as string | undefined;
  const dealerName = (raw['Dealer Name'] || raw.dealerName || raw['Dealer_Name'] || raw.Dealer || raw.dealer || raw.DEALER || raw['Dealership Name'] || raw['Dealership_Name'] || raw.dealershipName) as string | undefined;
  const dealerCity = (raw['Dealer City'] || raw.dealerCity || raw['Dealer_City'] || raw.City || raw.city) as string | undefined;
  const dealerState = (raw['Dealer State'] || raw.dealerState || raw['Dealer_State'] || raw.State || raw.state || raw.STATE) as string | undefined;
  
  // Derive dealer-provided price (throws if missing)
  const dealerPrice = deriveDealerPrice(raw);
  
  // Extract MSRP if available
  const msrpRaw = raw.MSRP || raw.msrp || raw.MSRP || raw['MSRP'] || raw['List Price'] || raw.listPrice || raw['List_Price'];
  const msrp = msrpRaw !== null && msrpRaw !== undefined ? 
               (typeof msrpRaw === 'number' ? msrpRaw : parseFloat(String(msrpRaw))) : 
               undefined;
  
  // Determine currency (default to USD)
  const currency = (raw.Currency || raw.currency || raw.CURRENCY || raw['Currency Code'] || raw['Currency_Code'] || 'USD') as string;
  const finalCurrency = /^[A-Z]{3}$/.test(String(currency)) ? currency : 'USD';
  
  // Generate ID if not present
  const id = (raw.id || raw.ID || raw['Listing ID'] || raw['Listing_ID'] || raw.listingId || vin || stockNumber || `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`) as string;
  
  return {
    id,
    baseIdentity: {
      vin,
      year,
      make,
      model,
      trim,
      stockNumber,
      listingId: (raw['Listing ID'] || raw['Listing_ID'] || raw.listingId || raw.id || raw.ID) as string | undefined,
      vehicleType,
    },
    condition,
    coreSpecs: {
      bodyType: (raw['Body Type'] || raw.bodyType || raw.BodyType || raw['Body_Type']) as string | undefined,
      fuelType: mapFuelType((raw['Fuel Type'] || raw.fuelType || raw.FuelType || raw['Fuel_Type']) as string | undefined),
      engine: engineSpecs,
      transmission: transmission ? {
        description: String(transmission),
        type: mapTransmissionType(String(transmission)),
      } : undefined,
      drivetrain: mapDrivetrain((raw.Drivetrain || raw.drivetrain || raw.DRIVETRAIN || raw.Drive || raw.drive || raw.DRIVE) as string | undefined),
      odometer,
    },
    pricing: {
      price: dealerPrice,
      msrp: msrp !== undefined && !isNaN(msrp) && msrp >= 0 ? msrp : undefined,
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
        name: (dealerName || 'Unknown Dealer') as string,
        city: dealerCity as string | undefined,
        state: dealerState as string | undefined,
      },
    },
    availability: availabilityStatus,
    marketData,
    operational: {
      dataSource: 'csv-import',
      lastSyncedAt: now,
      syncStatus: 'success',
    },
    dealerDefined: {
      // Preserve all CSV data for reference
      raw,
    },
    enrichment: {
      // Store additional CSV data if available
      description: (raw.Description || raw.description || raw.DESC || raw.desc) as string | undefined,
      title: (raw.Title || raw.title || raw.TITLE) as string | undefined,
      notes: (raw.Notes || raw.notes || raw.NOTES || raw['Dealer Notes'] || raw['Dealer_Notes'] || raw.dealerNotes) as string | undefined,
    },
  };
}
