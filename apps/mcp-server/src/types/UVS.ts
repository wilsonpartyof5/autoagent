/**
 * Unified Vehicle Schema (UVS) TypeScript Types
 * 
 * Generated from unifiedVehicleSchema.json - DO NOT MODIFY MANUALLY
 * Provider-agnostic types for vehicle inventory normalization.
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
  readonly vehicleType?: 'car' | 'truck' | 'suv' | 'van' | 'motorcycle' | 'rv' | 'trailer' | 'other';
}

/**
 * Engine specifications
 */
export interface Engine {
  readonly description?: string;
  readonly displacement?: number;
  readonly cylinders?: number;
  readonly horsepower?: number;
}

/**
 * Transmission specifications
 */
export interface Transmission {
  readonly description?: string;
  readonly type?: 'automatic' | 'manual' | 'cvt' | 'dual clutch' | 'automated manual';
}

/**
 * Odometer reading
 */
export interface Odometer {
  readonly value: number;
  readonly unit: 'mi' | 'km';
}

/**
 * Core vehicle specifications
 */
export interface CoreSpecs {
  readonly bodyType?: string;
  readonly fuelType?: 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'plug-in hybrid' | 'flex fuel' | 'natural gas' | 'hydrogen' | 'other';
  readonly engine?: Engine;
  readonly transmission?: Transmission;
  readonly drivetrain?: 'fwd' | 'rwd' | 'awd' | '4wd' | 'part-time 4wd';
  readonly odometer?: Odometer;
}

/**
 * Pricing information
 */
export interface Pricing {
  readonly price: number;
  readonly msrp?: number;
  readonly currency?: string; // ISO 4217 currency code (3 letters, defaults to USD)
}

/**
 * Feature with category
 */
export interface Feature {
  readonly name: string;
  readonly code?: string;
  readonly category?: 'safety' | 'interior' | 'exterior' | 'convenience' | 'technology' | 'entertainment' | 'performance' | 'other';
  readonly description?: string;
  readonly source?: string;
}

/**
 * Option package
 */
export interface Package {
  readonly name?: string;
  readonly code?: string;
  readonly price?: number;
  readonly description?: string;
}

/**
 * Features and packages
 */
export interface FeaturesPackages {
  readonly features?: readonly Feature[];
  readonly packages?: readonly Package[];
}

/**
 * Media assets
 */
export interface Media {
  readonly primaryPhotoUrl?: string;
  readonly photoUrls?: readonly string[];
}

/**
 * Dealer information
 */
export interface Dealer {
  readonly dealerId?: string;
  readonly name: string;
  readonly city?: string;
  readonly state?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

/**
 * Location information
 */
export interface Location {
  readonly dealer: Dealer;
}

/**
 * Availability status
 */
export interface Availability {
  readonly status?: 'available' | 'pending' | 'sold' | 'in_transit' | 'unavailable';
}

/**
 * Market data
 */
export interface MarketData {
  readonly averageDaysOnMarket?: number;
}

/**
 * Operational metadata
 */
export interface Operational {
  readonly dataSource?: string;
  readonly lastSyncedAt: string; // ISO 8601 datetime string
  readonly syncStatus?: 'pending' | 'success' | 'failed';
}

/**
 * Dealer-defined custom metadata (additional properties allowed)
 */
export interface DealerDefined {
  readonly [key: string]: unknown;
}

/**
 * Enrichment data (additional properties allowed)
 */
export interface Enrichment {
  readonly [key: string]: unknown;
}

/**
 * Unified Vehicle Schema (UVS) - Complete vehicle inventory record
 * 
 * This is the primary interface representing a unified vehicle inventory item.
 * All fields are readonly to promote immutability.
 */
export interface UVS {
  /** Internal unique vehicle ID. Required. */
  readonly id: string;

  /** Core identification fields. Required. */
  readonly baseIdentity: BaseIdentity;

  /** Vehicle condition. Required. */
  readonly condition: 'new' | 'used' | 'certified';

  /** Essential vehicle specifications. Optional. */
  readonly coreSpecs?: CoreSpecs;

  /** Pricing information. Required. */
  readonly pricing: Pricing;

  /** Structured features and options. Optional. */
  readonly featuresPackages?: FeaturesPackages;

  /** Media assets. Optional. */
  readonly media?: Media;

  /** Physical location and dealer information. Required. */
  readonly location: Location;

  /** Availability status. Optional. */
  readonly availability?: Availability;

  /** Simplified competitive data. Optional. */
  readonly marketData?: MarketData;

  /** Operational sync metadata. Required. */
  readonly operational: Operational;

  /** Dealer custom metadata. Optional. */
  readonly dealerDefined?: DealerDefined;

  /** AI or third-party enhancements. Optional. */
  readonly enrichment?: Enrichment;
}

