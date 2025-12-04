/**
 * Strict Zod Schemas for UVS Provider Validation
 * 
 * These schemas enforce strict validation for provider-normalized UVS payloads:
 * - Required blocks: baseIdentity, pricing, location, operational
 * - Enums: fuelType, drivetrain, transmission.type, odometer unit ("mi"/"km")
 * - Valid ranges/types (e.g., year, price ≥ 0)
 * - Odometer: accept mi/km; fail invalid units
 * 
 * Invalid payloads must be quarantined/logged and not written to UVS.
 */

import { z } from 'zod';
import type { UnifiedVehicle } from './uvs.js';

/**
 * Fuel type enum - matches UVS schema
 */
export const FuelTypeEnum = z.enum([
  'gasoline',
  'diesel',
  'electric',
  'hybrid',
  'plug-in hybrid',
  'flex fuel',
  'natural gas',
  'hydrogen',
  'other',
]);

/**
 * Drivetrain enum - matches UVS schema
 */
export const DrivetrainEnum = z.enum([
  'fwd',
  'rwd',
  'awd',
  '4wd',
  'part-time 4wd',
]);

/**
 * Transmission type enum - matches UVS schema
 */
export const TransmissionTypeEnum = z.enum([
  'automatic',
  'manual',
  'cvt',
  'dual clutch',
  'automated manual',
]);

/**
 * Odometer unit enum - strict validation: only "mi" or "km"
 */
export const OdometerUnitEnum = z.enum(['mi', 'km']);

/**
 * Condition enum - matches UVS schema
 */
export const ConditionEnum = z.enum(['new', 'used', 'certified']);

/**
 * Vehicle type enum - matches UVS schema
 */
export const VehicleTypeEnum = z.enum([
  'car',
  'truck',
  'suv',
  'van',
  'motorcycle',
  'rv',
  'trailer',
  'other',
]);

/**
 * Base Identity Schema - Required block
 * Enforces: year, make, model (required)
 */
export const BaseIdentitySchema = z.object({
  vin: z
    .string()
    .regex(/^[A-HJ-NPR-Z0-9]{11,17}$/i, 'VIN must be 11-17 characters without I/O/Q')
    .optional(),
  year: z
    .number()
    .int('Year must be an integer')
    .min(1900, 'Year must be >= 1900')
    .max(2100, 'Year must be <= 2100'),
  make: z.string().min(1, 'Make is required and cannot be empty'),
  model: z.string().min(1, 'Model is required and cannot be empty'),
  trim: z.string().optional(),
  stockNumber: z.string().optional(),
  listingId: z.string().optional(),
  vehicleType: VehicleTypeEnum.optional(),
});

/**
 * Engine Schema
 */
export const EngineSchema = z.object({
  description: z.string().optional(),
  displacement: z.number().min(0, 'Displacement must be >= 0').optional(),
  cylinders: z
    .number()
    .int('Cylinders must be an integer')
    .min(0, 'Cylinders must be >= 0')
    .max(16, 'Cylinders must be <= 16')
    .optional(),
  horsepower: z
    .number()
    .int('Horsepower must be an integer')
    .min(0, 'Horsepower must be >= 0')
    .optional(),
});

/**
 * Transmission Schema
 * Enforces enum for transmission.type
 */
export const TransmissionSchema = z.object({
  description: z.string().optional(),
  type: TransmissionTypeEnum.optional(),
});

/**
 * Odometer Schema
 * Strict validation: only "mi" or "km" units allowed
 */
export const OdometerSchema = z.object({
  value: z.number().min(0, 'Odometer value must be >= 0'),
  unit: OdometerUnitEnum,
});

/**
 * Core Specs Schema
 * Enforces enums for fuelType, drivetrain, transmission.type, odometer.unit
 */
export const CoreSpecsSchema = z.object({
  bodyType: z.string().optional(),
  fuelType: FuelTypeEnum.optional(),
  engine: EngineSchema.optional(),
  transmission: TransmissionSchema.optional(),
  drivetrain: DrivetrainEnum.optional(),
  odometer: OdometerSchema.optional(),
});

/**
 * Pricing Schema - Required block
 * Enforces: price (required, >= 0)
 */
export const PricingSchema = z.object({
  price: z.number().min(0, 'Price must be >= 0'),
  msrp: z.number().min(0, 'MSRP must be >= 0').optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO 4217 code')
    .default('USD'),
});

/**
 * UVS Dealer Schema (for location.dealer)
 */
export const UVSDealerSchema = z.object({
  dealerId: z.string().optional(),
  name: z.string().min(1, 'Dealer name is required and cannot be empty'),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  street: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  email: z.string().email().optional(),
  hours: z.record(z.string()).optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
});

/**
 * Location Schema - Required block
 * Enforces: dealer (required)
 */
export const LocationSchema = z.object({
  dealer: UVSDealerSchema,
  locationName: z.string().optional(),
  lotNumber: z.string().optional(),
});

/**
 * Operational Schema - Required block
 * Enforces: lastSyncedAt (required, ISO 8601 datetime)
 */
export const OperationalSchema = z.object({
  dataSource: z.string().optional(),
  source: z.string().optional(),
  lastSyncedAt: z.string().datetime('lastSyncedAt must be a valid ISO 8601 datetime'),
  syncStatus: z.enum(['pending', 'in_progress', 'success', 'failed']).optional(),
  syncError: z.string().optional(),
  syncRetryCount: z.number().int().min(0).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Feature Schema
 */
export const FeatureSchema = z.object({
  name: z.string().min(1, 'Feature name is required'),
  code: z.string().optional(),
  category: z
    .enum([
      'safety',
      'interior',
      'exterior',
      'convenience',
      'technology',
      'entertainment',
      'performance',
      'other',
    ])
    .optional(),
  description: z.string().optional(),
  source: z.string().optional(),
});

/**
 * Package Schema
 */
export const PackageSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  price: z.number().min(0, 'Package price must be >= 0').optional(),
  description: z.string().optional(),
});

/**
 * Features Packages Schema
 */
export const FeaturesPackagesSchema = z.object({
  features: z.array(FeatureSchema).optional(),
  packages: z.array(PackageSchema).optional(),
});

/**
 * Media Schema
 */
export const MediaSchema = z.object({
  primaryPhotoUrl: z.string().url().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  virtualTourUrl: z.string().url().optional(),
  windowStickerUrl: z.string().url().optional(),
  buildSheetUrl: z.string().url().optional(),
  carfaxUrl: z.string().url().optional(),
  images: z.array(
    z.object({
      url: z.string().url(),
      type: z.enum(['exterior', 'interior', 'engine', 'other']).optional(),
      caption: z.string().optional(),
      sortOrder: z.number().int().optional(),
    })
  ).optional(),
});

/**
 * Availability Schema
 */
export const AvailabilitySchema = z.object({
  status: z
    .enum(['available', 'pending', 'sold', 'in_transit', 'on_order', 'hold', 'unavailable'])
    .optional(),
  isLive: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
  publishedBy: z.string().optional(),
  availableDate: z.string().optional(),
  inTransitDate: z.string().optional(),
  onLotDate: z.string().optional(),
  soldDate: z.string().optional(),
  daysOnMarket: z.number().int().min(0).optional(),
  daysOnLot: z.number().int().min(0).optional(),
});

/**
 * Market Data Schema
 */
export const MarketDataSchema = z.object({
  marketAveragePrice: z.number().min(0).optional(),
  marketPriceRange: z
    .object({
      low: z.number().min(0).optional(),
      high: z.number().min(0).optional(),
    })
    .optional(),
  competitivePosition: z
    .enum(['below_market', 'at_market', 'above_market'])
    .optional(),
  turnRate: z.number().optional(),
  marketRank: z.number().int().min(0).optional(),
  similarListings: z.number().int().min(0).optional(),
});

/**
 * Dealer Defined Schema - allows additional properties
 */
export const DealerDefinedSchema = z.record(z.unknown()).optional();

/**
 * Enrichment Schema - allows additional properties
 */
export const EnrichmentSchema = z.record(z.unknown()).optional();

/**
 * Strict UVS Provider Schema
 * 
 * Enforces all required blocks:
 * - baseIdentity (required)
 * - pricing (required)
 * - location (required)
 * - operational (required)
 * 
 * Enforces all enums:
 * - fuelType
 * - drivetrain
 * - transmission.type
 * - odometer.unit ("mi"/"km")
 * 
 * Validates ranges/types:
 * - year: 1900-2100
 * - price: >= 0
 */
export const StrictUVSProviderSchema = z.object({
  id: z.string().min(1, 'Vehicle ID is required'),
  baseIdentity: BaseIdentitySchema,
  condition: ConditionEnum,
  coreSpecs: CoreSpecsSchema.optional(),
  pricing: PricingSchema,
  featuresPackages: FeaturesPackagesSchema.optional(),
  media: MediaSchema.optional(),
  location: LocationSchema,
  availability: AvailabilitySchema.optional(),
  marketData: MarketDataSchema.optional(),
  operational: OperationalSchema,
  dealerDefined: DealerDefinedSchema,
  enrichment: EnrichmentSchema,
});

/**
 * Validation result type
 */
export interface StrictValidationResult {
  valid: boolean;
  errors?: z.ZodError;
  data?: UnifiedVehicle;
  errorDetails?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Validate provider-normalized UVS payload against strict schema
 * 
 * @param data - Data to validate
 * @param provider - Provider name for logging
 * @returns Validation result with valid flag, errors (if any), and parsed data
 */
export function validateStrictUVS(
  data: unknown,
  provider?: string
): StrictValidationResult {
  const result = StrictUVSProviderSchema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      data: result.data as UnifiedVehicle,
    };
  }

  // Format error details for structured logging
  const errorDetails = result.error.errors.map((err) => ({
    path: err.path.join('.') || 'root',
    message: err.message,
    code: err.code,
  }));

  return {
    valid: false,
    errors: result.error,
    errorDetails,
  };
}

/**
 * Type guard to check if data is valid strict UVS
 */
export function isValidStrictUVS(data: unknown): data is UnifiedVehicle {
  return validateStrictUVS(data).valid;
}

/**
 * Export schema types for use in tests
 */
export type StrictUVSProvider = z.infer<typeof StrictUVSProviderSchema>;

