/**
 * MarketCheck Provider Mapper
 * 
 * Normalizes MarketCheck API responses to UVS format.
 * Phase 2: Full field population with intelligent parsing and categorization.
 */

import type { UVS, Feature } from '../../types/UVS.js';
import type { MarketCheckVehicle } from '@autoagent/shared';

/**
 * Extended MarketCheck vehicle type with enrichment data
 * Note: After mergeEnrichment, extra data may be merged into main fields (features, etc.)
 * but extra object itself may not be preserved.
 */
export interface MarketCheckVehicleWithEnrichment extends MarketCheckVehicle {
  extra?: {
    features?: string[];
    specifications?: Record<string, unknown>;
    options?: Array<{ name?: string; code?: string; description?: string; price?: number }>;
    seller_comments?: string;
    description?: string;
  };
  // Build may be extended in detail endpoint with engine field
  build?: (MarketCheckVehicle['build'] & {
    engine?: string;
  }) | undefined;
}

/**
 * Parse year, make, model from MarketCheck heading string
 * Formats: "2022 Toyota Camry", "2022 Honda Accord EX-L", etc.
 */
function parseHeading(heading?: string): { year?: number; make?: string; model?: string; trim?: string } {
  if (!heading) return {};
  
  // Match pattern: "YYYY Make Model [Trim]" or "YYYY Make Model"
  // Example: "2022 Toyota Camry SE" or "2021 Honda Accord EX-L"
  const match = heading.match(/^(\d{4})\s+(.+)$/);
  if (!match) return {};
  
  const year = parseInt(match[1], 10);
  if (isNaN(year) || year < 1900 || year > 2100) return {};
  
  const remaining = match[2]?.trim() || '';
  if (!remaining) return { year };
  
  // Split make and model (typically first word is make, rest is model/trim)
  // Common patterns:
  // - "Toyota Camry" (make, model)
  // - "Toyota Camry SE" (make, model, trim)
  // - "Honda Accord EX-L" (make, model with trim in model name)
  const parts = remaining.split(/\s+/);
  if (parts.length < 2) return { year, make: remaining };
  
  const make = parts[0] || '';
  // Everything after make is model (may include trim)
  const modelWithTrim = parts.slice(1).join(' ') || '';
  
  // Try to extract trim if it looks like a trim level
  // Common trim patterns: SE, LE, EX-L, Limited, etc.
  // For now, return everything as model - trim extraction can be enhanced later
  return { year, make, model: modelWithTrim };
}

/**
 * Normalize MarketCheck vehicle to UVS format
 * 
 * @param raw - Raw MarketCheck vehicle data (may include enrichment data)
 * @returns Normalized UVS vehicle
 * @throws Error if required fields cannot be derived and are missing
 */
export function normalize(raw: MarketCheckVehicleWithEnrichment): UVS {
  const now = new Date().toISOString();
  
  // Extract year, make, model from build first, fallback to heading parsing
  let year = raw.build?.year;
  let make = raw.build?.make;
  let model = raw.build?.model;
  let trim = raw.build?.trim;
  
  // If build data is missing, try parsing from heading
  if (!year || !make || !model) {
    const parsed = parseHeading(raw.heading);
    year = year || parsed.year;
    make = make || parsed.make;
    model = model || parsed.model;
    trim = trim || parsed.trim;
  }
  
  // Validate required fields - log warning if missing but try to provide defaults
  if (!year || year < 1900 || year > 2100) {
    console.warn(JSON.stringify({
      event: 'marketcheck_missing_year',
      listingId: raw.id,
      heading: raw.heading,
      build: raw.build,
      message: 'Year missing or invalid, using current year as fallback',
    }));
    year = new Date().getFullYear(); // Fallback to current year
  }
  
  if (!make || make.trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'marketcheck_missing_make',
      listingId: raw.id,
      heading: raw.heading,
      build: raw.build,
      message: 'Make missing, using "Unknown" as fallback',
    }));
    make = 'Unknown';
  }
  
  if (!model || model.trim().length === 0) {
    console.warn(JSON.stringify({
      event: 'marketcheck_missing_model',
      listingId: raw.id,
      heading: raw.heading,
      build: raw.build,
      message: 'Model missing, using "Vehicle" as fallback',
    }));
    model = 'Vehicle';
  }
  
  // Ensure strings are trimmed
  make = make.trim();
  model = model.trim();
  
  // Determine condition
  let condition: 'new' | 'used' | 'certified' = 'used';
  if (raw.inventory_type === 'new') {
    condition = 'new';
  } else if (raw.inventory_type === 'cpo' || raw.certified === true) {
    condition = 'certified';
  }
  
  // Extract odometer - normalize to miles (MarketCheck uses miles by default)
  const miles = raw.miles ?? raw.mileage;
  const odometer = miles !== undefined && miles >= 0 ? {
    value: miles,
    unit: 'mi' as const,
  } : undefined;
  
  // Derive vehicleType from body_type
  const vehicleType = deriveVehicleType(raw.build?.body_type);
  
  // Parse engine specs from description or specifications
  const engineSpecs = parseEngineSpecs(
    raw.build?.engine,
    raw.extra?.specifications
  );
  
  // Map features with intelligent categorization
  // Note: mergeEnrichment merges extra.features into raw.features, so we use raw.features
  const features: Feature[] = (raw.features || []).map(feature => ({
    name: feature,
    category: categorizeFeature(feature),
    source: 'marketcheck',
  }));
  
  // Map packages from enrichment if available (includes prices now)
  // Note: extra.options may not be preserved after mergeEnrichment, but we check anyway
  const packages = (raw.extra?.options || []).map(opt => ({
    name: opt.name || 'Unknown Package',
    code: opt.code,
    price: typeof opt.price === 'number' && opt.price >= 0 ? opt.price : undefined,
    description: opt.description,
  }));
  
  // Determine availability status
  const availabilityStatus = determineAvailability(raw);
  
  // Map market data
  const marketData = raw.dom !== undefined && raw.dom >= 0 ? {
    averageDaysOnMarket: raw.dom,
  } : undefined;
  
  return {
    id: raw.id || raw.vin || `mc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    baseIdentity: {
      vin: raw.vin,
      year,
      make,
      model,
      trim,
      stockNumber: raw.stock_no,
      listingId: raw.id,
      vehicleType,
    },
    condition,
    coreSpecs: {
      bodyType: raw.build?.body_type,
      fuelType: mapFuelType(raw.build?.fuel_type),
      engine: engineSpecs,
      transmission: raw.build?.transmission ? {
        description: raw.build.transmission,
        type: mapTransmissionType(raw.build.transmission),
      } : undefined,
      drivetrain: mapDrivetrain(raw.build?.drivetrain || raw.build?.drive_train),
      odometer,
    },
    pricing: {
      price: deriveDealerPrice(raw),
      msrp: raw.msrp && raw.msrp >= 0 ? raw.msrp : undefined,
      currency: 'USD', // MarketCheck is primarily USD
    },
    featuresPackages: (features.length > 0 || packages.length > 0) ? {
      features: features.length > 0 ? features : undefined,
      packages: packages.length > 0 ? packages : undefined,
    } : undefined,
    media: {
      primaryPhotoUrl: raw.media?.primary_photo_url || raw.media?.thumbnail?.url,
      photoUrls: raw.media?.photo_links?.filter(Boolean),
    },
    location: {
      dealer: {
        dealerId: raw.dealer?.id?.toString(),
        name: raw.dealer?.name || 'Unknown Dealer',
        city: raw.dealer?.city,
        state: raw.dealer?.state,
      },
    },
    availability: availabilityStatus,
    marketData,
    operational: {
      dataSource: 'marketcheck-api',
      lastSyncedAt: now,
      syncStatus: 'success',
    },
    dealerDefined: {
      // Preserve raw MarketCheck data for reference
      raw: raw,
      dom: raw.dom,
      source: raw.source,
      heading: raw.heading,
      certified: raw.certified,
      exterior_color: raw.exterior_color,
      interior_color: raw.interior_color,
    },
    enrichment: {
      // Store enrichment data if available
      detail: raw,
      extra: raw.extra,
      media: raw.media,
      market_data: raw.market_data,
    },
  };
}

/**
 * Map fuel type string to UVS enum
 */
function mapFuelType(fuelType?: string): 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'plug-in hybrid' | 'flex fuel' | 'natural gas' | 'hydrogen' | 'other' | undefined {
  if (!fuelType) return undefined;
  
  const normalized = fuelType.toLowerCase();
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
  
  const normalized = transmission.toLowerCase();
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
  
  const normalized = drivetrain.toLowerCase();
  if (normalized === 'fwd' || normalized.includes('front')) return 'fwd';
  if (normalized === 'rwd' || normalized.includes('rear')) return 'rwd';
  if (normalized === 'awd' || normalized.includes('all wheel')) return 'awd';
  if (normalized === '4wd' || normalized.includes('four wheel')) return '4wd';
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'part-time 4wd';
  return undefined;
}

/**
 * Derive vehicle type from body type string
 */
function deriveVehicleType(bodyType?: string): 'car' | 'truck' | 'suv' | 'van' | 'motorcycle' | 'rv' | 'trailer' | 'other' | undefined {
  if (!bodyType) return undefined;
  
  const normalized = bodyType.toLowerCase();
  
  // Map common body types to vehicle types
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
    return 'car'; // Wagons are typically cars
  }
  
  // Default to other if we can't determine
  return 'other';
}

/**
 * Parse engine specifications from description string or specifications object
 */
function parseEngineSpecs(
  engineDescription?: string,
  specifications?: Record<string, unknown>
): { description?: string; displacement?: number; cylinders?: number; horsepower?: number } | undefined {
  let displacement: number | undefined;
  let cylinders: number | undefined;
  let horsepower: number | undefined;
  
  // Try to extract from specifications first (more reliable)
  if (specifications) {
    // Common specification keys
    if (typeof specifications.displacement === 'number' && specifications.displacement > 0) {
      displacement = specifications.displacement;
    } else if (typeof specifications.engine_displacement === 'number' && specifications.engine_displacement > 0) {
      displacement = specifications.engine_displacement;
    }
    
    if (typeof specifications.cylinders === 'number' && specifications.cylinders > 0) {
      cylinders = specifications.cylinders;
    } else if (typeof specifications.engine_cylinders === 'number' && specifications.engine_cylinders > 0) {
      cylinders = specifications.engine_cylinders;
    }
    
    if (typeof specifications.horsepower === 'number' && specifications.horsepower > 0) {
      horsepower = specifications.horsepower;
    } else if (typeof specifications.engine_horsepower === 'number' && specifications.engine_horsepower > 0) {
      horsepower = specifications.engine_horsepower;
    } else if (typeof specifications.hp === 'number' && specifications.hp > 0) {
      horsepower = specifications.hp;
    }
  }
  
  // If no specs found, try to parse from description string
  if (!displacement && !cylinders && !horsepower && engineDescription) {
    const desc = engineDescription.toLowerCase();
    
    // Parse displacement (e.g., "3.5L", "2.0L", "3.5")
    const displacementMatch = desc.match(/(\d+\.?\d*)\s*[l]?/i);
    if (displacementMatch) {
      const parsedDisplacement = parseFloat(displacementMatch[1]);
      if (parsedDisplacement > 0 && parsedDisplacement < 20) { // Sanity check
        displacement = parsedDisplacement;
      }
    }
    
    // Parse cylinders (e.g., "V6", "I4", "V8", "6-cylinder")
    const cylinderMatch = desc.match(/(?:v|inline|i|in-line|straight|w)?(\d+)[\s-]?cyl/i) || 
                         desc.match(/(\d+)[\s-]?cylinder/i);
    if (cylinderMatch) {
      const parsedCylinders = parseInt(cylinderMatch[1], 10);
      if (parsedCylinders > 0 && parsedCylinders <= 16) { // Sanity check
        cylinders = parsedCylinders;
      }
    } else if (desc.includes('v6') || desc.includes('v-6')) {
      cylinders = 6;
    } else if (desc.includes('v8') || desc.includes('v-8')) {
      cylinders = 8;
    } else if (desc.includes('v4') || desc.includes('v-4') || desc.includes('i4') || desc.includes('l4')) {
      cylinders = 4;
    } else if (desc.includes('v12') || desc.includes('v-12')) {
      cylinders = 12;
    } else if (desc.includes('v10') || desc.includes('v-10')) {
      cylinders = 10;
    }
    
    // Parse horsepower (e.g., "250hp", "300 HP", "252 hp")
    const hpMatch = desc.match(/(\d+)\s*hp/i) || desc.match(/(\d+)\s*horsepower/i);
    if (hpMatch) {
      const parsedHorsepower = parseInt(hpMatch[1], 10);
      if (parsedHorsepower > 0 && parsedHorsepower < 2000) { // Sanity check
        horsepower = parsedHorsepower;
      }
    }
  }
  
  // Return engine specs if we have at least a description OR parsed specs
  if (!engineDescription && !displacement && !cylinders && !horsepower) {
    return undefined;
  }
  
  return {
    ...(engineDescription && { description: engineDescription }),
    ...(displacement !== undefined && { displacement }),
    ...(cylinders !== undefined && { cylinders }),
    ...(horsepower !== undefined && { horsepower }),
  };
}

/**
 * Categorize feature based on keywords
 */
function categorizeFeature(feature: string): 'safety' | 'interior' | 'exterior' | 'convenience' | 'technology' | 'entertainment' | 'performance' | 'other' {
  if (!feature) return 'other';
  
  const normalized = feature.toLowerCase();
  
  // Safety features
  if (normalized.includes('safety') || normalized.includes('airbag') || normalized.includes('air bag') ||
      normalized.includes('backup camera') || normalized.includes('back-up camera') || normalized.includes('rearview') ||
      normalized.includes('blind spot') || normalized.includes('blindspot') || normalized.includes('lane assist') ||
      normalized.includes('lane keep') || normalized.includes('lane departure') || normalized.includes('collision') ||
      normalized.includes('brake') || normalized.includes('parking assist') || normalized.includes('parking aid') ||
      normalized.includes('sensor') || normalized.includes('abs') || normalized.includes('traction') ||
      normalized.includes('stability') || normalized.includes('emergency') || normalized.includes('pedestrian') ||
      normalized.includes('cross traffic') || normalized.includes('automatic emergency')) {
    return 'safety';
  }
  
  // Technology features
  if (normalized.includes('bluetooth') || normalized.includes('navigation') || normalized.includes('nav') ||
      normalized.includes('gps') || normalized.includes('apple carplay') || normalized.includes('android auto') ||
      normalized.includes('usb') || normalized.includes('wifi') || normalized.includes('wireless') ||
      normalized.includes('screen') || normalized.includes('display') || normalized.includes('touch') ||
      normalized.includes('infotainment') || normalized.includes('connectivity') || normalized.includes('app') ||
      normalized.includes('smart') || normalized.includes('sync') || normalized.includes('entune') ||
      normalized.includes('uconnect') || normalized.includes('mylink')) {
    return 'technology';
  }
  
  // Entertainment features
  if (normalized.includes('radio') || normalized.includes('stereo') || normalized.includes('speaker') ||
      normalized.includes('audio') || normalized.includes('sound') || normalized.includes('premium') ||
      normalized.includes('bose') || normalized.includes('harman') || normalized.includes('jbl') ||
      normalized.includes('cd') || normalized.includes('dvd') || normalized.includes('hd') ||
      normalized.includes('satellite') || normalized.includes('sirius') || normalized.includes('xm')) {
    return 'entertainment';
  }
  
  // Convenience features
  if (normalized.includes('keyless') || normalized.includes('remote start') || normalized.includes('push button') ||
      normalized.includes('power') && (normalized.includes('window') || normalized.includes('door') || normalized.includes('liftgate') || normalized.includes('tailgate')) ||
      normalized.includes('cruise control') || normalized.includes('adaptive cruise') || normalized.includes('heated') ||
      normalized.includes('cooled') || normalized.includes('ventilated') || normalized.includes('memory') ||
      normalized.includes('tilt') || normalized.includes('telescope') || normalized.includes('adjustable') ||
      normalized.includes('automatic') && (normalized.includes('climate') || normalized.includes('air') || normalized.includes('temp')) ||
      normalized.includes('rain sensing') || normalized.includes('auto-dimming') || normalized.includes('homelink') ||
      normalized.includes('garage door') || normalized.includes('hands-free') || normalized.includes('trunk') ||
      normalized.includes('cargo') || normalized.includes('storage') || normalized.includes('compartment')) {
    return 'convenience';
  }
  
  // Exterior features
  if (normalized.includes('sunroof') || normalized.includes('moonroof') || normalized.includes('panoramic') ||
      normalized.includes('roof rack') || normalized.includes('running board') || normalized.includes('running boards') ||
      normalized.includes('wheel') && normalized.includes('alloy') || normalized.includes('chrome') ||
      normalized.includes('fog light') || normalized.includes('fog lamp') || normalized.includes('led') ||
      normalized.includes('halo') || normalized.includes('xenon') || normalized.includes('h.i.d.') ||
      normalized.includes('spoiler') || normalized.includes('wing') || normalized.includes('stripe') ||
      normalized.includes('paint') || normalized.includes('clearcoat') || normalized.includes('metallic')) {
    return 'exterior';
  }
  
  // Interior features
  if (normalized.includes('leather') || normalized.includes('cloth') || normalized.includes('fabric') ||
      normalized.includes('seat') || normalized.includes('steering') || normalized.includes('wheel') ||
      normalized.includes('wood') || normalized.includes('trim') || normalized.includes('dashboard') ||
      normalized.includes('console') || normalized.includes('door panel') || normalized.includes('headliner') ||
      normalized.includes('carpet') || normalized.includes('floor mat') || normalized.includes('cargo') ||
      normalized.includes('cupholder') || normalized.includes('cup holder')) {
    return 'interior';
  }
  
  // Performance features
  if (normalized.includes('sport') || normalized.includes('racing') || normalized.includes('performance') ||
      normalized.includes('turbo') || normalized.includes('supercharg') || normalized.includes('super charge') ||
      normalized.includes('suspension') || normalized.includes('brake') && (normalized.includes('upgrade') || normalized.includes('high-performance')) ||
      normalized.includes('exhaust') || normalized.includes('intake') || normalized.includes('chip') ||
      normalized.includes('tuned') || normalized.includes('mod') || normalized.includes('upgrade')) {
    return 'performance';
  }
  
  return 'other';
}

/**
 * Derive dealer-provided price from MarketCheck listing
 * Tries price field first, then price_history (most recent), then rejects if none found
 * 
 * @param raw - MarketCheck vehicle data
 * @returns Valid dealer-provided price
 * @throws Error if no dealer-provided price can be found
 */
function deriveDealerPrice(raw: MarketCheckVehicleWithEnrichment): number {
  const listingId = raw.id || raw.vin || 'unknown';
  
  // Primary: Use current price if available and positive
  if (typeof raw.price === 'number' && raw.price > 0) {
    return raw.price;
  }
  
  // Fallback: Use most recent price from price_history if available
  if (raw.price_history && raw.price_history.length > 0) {
    // Find most recent valid price
    const validPrices = raw.price_history
      .filter(entry => typeof entry.price === 'number' && entry.price > 0)
      .sort((a, b) => {
        // Sort by timestamp (most recent first)
        const aTime = typeof a.timestamp === 'number' ? a.timestamp : 
                     typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0;
        const bTime = typeof b.timestamp === 'number' ? b.timestamp :
                     typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      });
    
    if (validPrices.length > 0 && validPrices[0].price) {
      console.warn(JSON.stringify({
        event: 'marketcheck_price_from_history',
        listingId,
        price: validPrices[0].price,
        message: 'Using price from price_history as dealer-provided price',
      }));
      return validPrices[0].price;
    }
  }
  
  // No dealer-provided price found - reject the listing
  throw new Error(`Missing dealer-provided price for listing ${listingId}. Cannot create UVS record without valid pricing.`);
}

/**
 * Determine availability status from MarketCheck data
 */
function determineAvailability(raw: MarketCheckVehicle): UVS['availability'] | undefined {
  // MarketCheck doesn't explicitly provide availability status
  // Default to 'available' as most listings are active
  // Could be enhanced if MarketCheck adds availability fields
  
  // If price is 0 or missing, might indicate unavailable
  if (raw.price === 0 || raw.price === null || raw.price === undefined) {
    return { status: 'unavailable' };
  }
  
  // Default to available
  return { status: 'available' };
}

