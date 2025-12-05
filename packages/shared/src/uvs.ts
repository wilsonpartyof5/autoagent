/**
 * Unified Vehicle Schema (UVS) TypeScript Types
 * 
 * Provider-agnostic types for vehicle inventory data supporting multiple sources:
 * MarketCheck, Homenet, vAuto, Dealer Inspire, Dealer.com, OEM feeds, dealer CSV/API, CDK/Reynolds.
 * 
 * All interfaces use camelCase naming convention and readonly properties where applicable.
 * Use optional chaining when accessing nested properties.
 */

/**
 * Base vehicle identity information
 */
export interface BaseIdentity {
  readonly vin?: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly trim?: string;
  readonly stockNumber?: string;
  readonly listingId?: string;
  readonly serialNumber?: string;
  readonly vehicleType?: 'car' | 'truck' | 'suv' | 'van' | 'motorcycle' | 'rv' | 'trailer' | 'other';
}

/**
 * Measurement with unit
 */
export interface Measurement {
  readonly value: number;
  readonly unit: 'inches' | 'feet' | 'meters' | 'millimeters' | 'pounds' | 'kilograms' | 'mph' | 'km/h';
}

/**
 * Engine specifications
 */
export interface Engine {
  readonly displacement?: number;
  readonly cylinders?: number;
  readonly horsepower?: number;
  readonly torque?: number;
  readonly aspiration?: 'naturally aspirated' | 'turbocharged' | 'supercharged' | 'twin-turbo' | 'electric';
  readonly description?: string;
}

/**
 * Transmission specifications
 */
export interface Transmission {
  readonly type?: 'automatic' | 'manual' | 'cvt' | 'automated manual' | 'dual clutch';
  readonly speeds?: number;
  readonly description?: string;
}

/**
 * Core vehicle specifications
 */
export interface CoreSpecs {
  readonly bodyType?: string;
  readonly doors?: number;
  readonly seatingCapacity?: number;
  readonly fuelType?: 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'plug-in hybrid' | 'flex fuel' | 'natural gas' | 'hydrogen' | 'other';
  readonly engine?: Engine;
  readonly transmission?: Transmission;
  readonly drivetrain?: 'fwd' | 'rwd' | 'awd' | '4wd' | 'part-time 4wd';
  readonly miles?: number;
  readonly kilometers?: number;
}

/**
 * Dimensions and performance metrics
 */
export interface DimensionsPerformance {
  readonly length?: Measurement;
  readonly width?: Measurement;
  readonly height?: Measurement;
  readonly wheelbase?: Measurement;
  readonly groundClearance?: Measurement;
  readonly curbWeight?: Measurement;
  readonly towingCapacity?: Measurement;
  readonly payloadCapacity?: Measurement;
  readonly fuelEconomy?: {
    readonly city?: number;
    readonly highway?: number;
    readonly combined?: number;
    readonly unit?: 'mpg' | 'l/100km' | 'kWh/100mi' | 'mi/kWh';
    readonly epaEstimate?: boolean;
  };
  readonly acceleration?: {
    readonly zeroToSixty?: number;
    readonly zeroToHundred?: number;
  };
  readonly topSpeed?: Measurement;
}

/**
 * Price change history entry
 */
export interface PriceChange {
  readonly price: number;
  readonly timestamp: string; // ISO 8601 datetime string
  readonly source?: string;
  readonly reason?: string;
}

/**
 * Financing information
 */
export interface Financing {
  readonly monthlyPayment?: number;
  readonly apr?: number;
  readonly termMonths?: number;
  readonly downPayment?: number;
}

/**
 * Pricing information
 */
export interface Pricing {
  readonly price: number;
  readonly msrp?: number;
  readonly invoicePrice?: number;
  readonly internetPrice?: number;
  readonly retailPrice?: number;
  readonly wholesalePrice?: number;
  readonly currency?: string; // ISO 4217 currency code
  readonly priceChangeHistory?: readonly PriceChange[];
  readonly priceNote?: string;
  readonly financing?: Financing;
}

/**
 * Option package
 */
export interface Package {
  readonly name?: string;
  readonly code?: string;
  readonly description?: string;
  readonly price?: number;
}

/**
 * Vehicle option
 */
export interface Option {
  readonly name?: string;
  readonly code?: string;
  readonly description?: string;
  readonly price?: number;
}

/**
 * Warranty information
 */
export interface Warranty {
  readonly type?: 'manufacturer' | 'extended' | 'dealer' | 'limited' | 'none';
  readonly months?: number;
  readonly miles?: number;
  readonly description?: string;
}

/**
 * Features, options, and packages
 */
export interface FeaturesPackages {
  readonly features?: readonly string[];
  readonly packages?: readonly Package[];
  readonly options?: readonly Option[];
  readonly interiorColor?: string;
  readonly exteriorColor?: string;
  readonly interiorColorCode?: string;
  readonly exteriorColorCode?: string;
  readonly certified?: boolean;
  readonly certificationType?: 'cpo' | 'manufacturer certified' | 'dealer certified' | 'other';
  readonly warranty?: Warranty;
}

/**
 * Image metadata
 */
export interface Image {
  readonly url: string;
  readonly type?: 'exterior' | 'interior' | 'engine' | 'other';
  readonly caption?: string;
  readonly sortOrder?: number;
}

/**
 * Media assets
 */
export interface Media {
  readonly photoUrls?: readonly string[];
  readonly thumbnailUrl?: string;
  readonly primaryPhotoUrl?: string;
  readonly videoUrl?: string;
  readonly virtualTourUrl?: string;
  readonly windowStickerUrl?: string;
  readonly buildSheetUrl?: string;
  readonly carfaxUrl?: string;
  readonly images?: readonly Image[];
}

/**
 * Service record
 */
export interface ServiceRecord {
  readonly date?: string; // ISO 8601 date string
  readonly mileage?: number;
  readonly service?: string;
  readonly location?: string;
}

/**
 * Vehicle history
 */
export interface History {
  readonly accidentHistory?: boolean;
  readonly accidentCount?: number;
  readonly ownerCount?: number;
  readonly serviceHistory?: boolean;
  readonly serviceRecords?: readonly ServiceRecord[];
  readonly titleStatus?: 'clean' | 'salvage' | 'rebuilt' | 'flood' | 'fire' | 'hail' | 'lien' | 'unknown';
  readonly titleState?: string; // US state code
  readonly previousUse?: 'personal' | 'commercial' | 'lease' | 'rental' | 'fleet' | 'government' | 'taxi' | 'other';
  readonly inServiceDate?: string; // ISO 8601 date string
  readonly lastOwnedDate?: string; // ISO 8601 date string
}

/**
 * Business hours (day of week -> hours string)
 */
export interface BusinessHours {
  readonly [day: string]: string;
}

/**
 * Dealer information
 * 
 * Note: This is a separate interface from the Dealer type in types.ts.
 * For UVS, Dealer is nested within Location.
 */
export interface UVSDealer {
  readonly dealerId?: string;
  readonly name: string;
  readonly address?: string;
  readonly street?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zip?: string;
  readonly country?: string; // ISO 3166-1 alpha-2 country code
  readonly latitude?: number;
  readonly longitude?: number;
  readonly phone?: string;
  readonly website?: string;
  readonly email?: string;
  readonly hours?: BusinessHours;
  readonly rating?: number;
  readonly reviewCount?: number;
}

/**
 * Location information
 */
export interface Location {
  readonly dealer: UVSDealer;
  readonly locationName?: string;
  readonly lotNumber?: string;
}

/**
 * Availability status
 */
export interface Availability {
  readonly status?: 'available' | 'pending' | 'sold' | 'in_transit' | 'on_order' | 'hold' | 'unavailable';
  readonly isLive?: boolean;
  readonly publishedAt?: string; // ISO 8601 datetime string
  readonly publishedBy?: string;
  readonly availableDate?: string; // ISO 8601 date string
  readonly inTransitDate?: string; // ISO 8601 date string
  readonly onLotDate?: string; // ISO 8601 date string
  readonly soldDate?: string; // ISO 8601 date string
  readonly daysOnMarket?: number;
  readonly daysOnLot?: number;
}

/**
 * Market price range
 */
export interface MarketPriceRange {
  readonly low?: number;
  readonly high?: number;
}

/**
 * Market analysis data
 */
export interface MarketData {
  readonly marketAveragePrice?: number;
  readonly marketPriceRange?: MarketPriceRange;
  readonly competitivePosition?: 'below_market' | 'at_market' | 'above_market';
  readonly turnRate?: number;
  readonly marketRank?: number;
  readonly similarListings?: number;
}

/**
 * Dealer-defined custom fields
 */
export interface DealerDefined {
  readonly customFields?: Readonly<Record<string, unknown>>;
  readonly internalNotes?: string;
  readonly salesperson?: string;
  readonly salespersonId?: string;
  readonly priority?: number;
  readonly tags?: readonly string[];
  readonly sourceSystem?: string;
  readonly sourceSystemId?: string;
}

/**
 * Operational sync metadata
 */
export interface Operational {
  readonly dataSource?: string;
  readonly source?: string;
  readonly lastSyncedAt: string; // ISO 8601 datetime string
  readonly syncStatus?: 'pending' | 'in_progress' | 'success' | 'failed';
  readonly syncError?: string;
  readonly syncRetryCount?: number;
  readonly createdAt?: string; // ISO 8601 datetime string
  readonly updatedAt?: string; // ISO 8601 datetime string
}

/**
 * Lead tracking data
 */
export interface LeadTracking {
  readonly leadStatus?: 'none' | 'submitted' | 'qualified' | 'contacted' | 'sold';
  readonly leadId?: string;
  readonly lastLeadAt?: string; // ISO 8601 datetime string
  readonly leadCount?: number;
}

/**
 * AI-generated enrichment data
 */
export interface AIGenerated {
  readonly description?: string;
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly sellingPoints?: readonly string[];
  readonly recommendedPrice?: number;
  readonly [key: string]: unknown; // Allow extensibility
}

/**
 * Third-party enrichment data
 */
export interface ThirdParty {
  readonly carfax?: Readonly<Record<string, unknown>>;
  readonly autocheck?: Readonly<Record<string, unknown>>;
  readonly kbb?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown; // Allow extensibility
}

/**
 * Enrichment block for extensible data
 */
export interface Enrichment {
  readonly aiGenerated?: AIGenerated;
  readonly providerSpecific?: Readonly<Record<string, unknown>>;
  readonly thirdParty?: ThirdParty;
  readonly [key: string]: unknown; // Allow extensibility
}

/**
 * Unified Vehicle Schema (UVS) - Complete vehicle inventory record
 * 
 * This is the primary interface representing a unified vehicle inventory item
 * that can be sourced from multiple providers (MarketCheck, Homenet, vAuto, etc.)
 * 
 * All fields are readonly to promote immutability. Use optional chaining
 * when accessing nested properties.
 * 
 * @example
 * ```typescript
 * const vehicle: UnifiedVehicle = {
 *   id: 'veh-123',
 *   baseIdentity: {
 *     year: 2023,
 *     make: 'Toyota',
 *     model: 'Camry',
 *     vin: '1HGBH41JXMN109186'
 *   },
 *   condition: 'new',
 *   pricing: { price: 28500 },
 *   dealer: { name: 'ABC Auto Sales' },
 *   lastSyncedAt: '2024-01-15T10:00:00Z'
 * };
 * 
 * // Use optional chaining
 * const trim = vehicle.baseIdentity?.trim;
 * const mileage = vehicle.coreSpecs?.miles;
 * ```
 */
export interface UnifiedVehicle {
  /** Unique internal inventory identifier */
  readonly id: string;

  /** Core vehicle identification (year, make, model required) */
  readonly baseIdentity: BaseIdentity;

  /** Vehicle condition/type (required) */
  readonly condition: 'new' | 'used' | 'certified';

  /** Essential vehicle specifications */
  readonly coreSpecs?: CoreSpecs;

  /** Dimensions and performance metrics */
  readonly dimensionsPerformance?: DimensionsPerformance;

  /** Pricing information (price required) */
  readonly pricing: Pricing;

  /** Features, options, and packages */
  readonly featuresPackages?: FeaturesPackages;

  /** Media assets (photos, videos, etc.) */
  readonly media?: Media;

  /** Vehicle history and ownership */
  readonly history?: History;

  /** Physical location and dealer information */
  readonly location: Location;

  /** Availability status */
  readonly availability?: Availability;

  /** Market analysis data */
  readonly marketData?: MarketData;

  /** Dealer-defined custom fields */
  readonly dealerDefined?: DealerDefined;

  /** Operational sync metadata */
  readonly operational: Operational;

  /** Lead tracking data */
  readonly leadTracking?: LeadTracking;

  /** Extensible enrichment block */
  readonly enrichment?: Enrichment;
}

/**
 * Type guard to check if an object is a valid UnifiedVehicle
 */
export function isUnifiedVehicle(value: unknown): value is UnifiedVehicle {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const v = value as Partial<UnifiedVehicle>;

  return (
    typeof v.id === 'string' &&
    typeof v.baseIdentity === 'object' &&
    v.baseIdentity !== null &&
    typeof (v.baseIdentity as Partial<BaseIdentity>).year === 'number' &&
    typeof (v.baseIdentity as Partial<BaseIdentity>).make === 'string' &&
    typeof (v.baseIdentity as Partial<BaseIdentity>).model === 'string' &&
    typeof v.condition === 'string' &&
    (v.condition === 'new' || v.condition === 'used' || v.condition === 'certified') &&
    typeof v.pricing === 'object' &&
    v.pricing !== null &&
    typeof (v.pricing as Partial<Pricing>).price === 'number' &&
    typeof v.location === 'object' &&
    v.location !== null &&
    typeof (v.location as Partial<Location>).dealer === 'object' &&
    (v.location as Partial<Location>).dealer !== null &&
    typeof ((v.location as Partial<Location>).dealer as Partial<UVSDealer>).name === 'string' &&
    typeof v.operational === 'object' &&
    v.operational !== null &&
    typeof (v.operational as Partial<Operational>).lastSyncedAt === 'string'
  );
}

