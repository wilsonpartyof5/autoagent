export * from './types';
export * from './marketcheck';
export * from './marketcheck-enrichment';
// Export UVS types (using explicit exports to avoid conflicts)
export type {
  UnifiedVehicle,
  BaseIdentity,
  CoreSpecs,
  DimensionsPerformance,
  Pricing,
  PriceChange,
  Financing,
  FeaturesPackages,
  Package as UVSPackage,
  Option as UVSOption,
  Warranty,
  Media,
  Image,
  History,
  ServiceRecord,
  UVSDealer,
  Location,
  BusinessHours,
  Availability,
  MarketData,
  MarketPriceRange,
  DealerDefined,
  Operational,
  LeadTracking,
  AIGenerated,
  ThirdParty,
  Enrichment,
  Measurement,
  Engine,
  Transmission,
} from './uvs';
export { isUnifiedVehicle } from './uvs';
// Export strict UVS provider schemas and validators
export {
  validateStrictUVS,
  isValidStrictUVS,
  StrictUVSProviderSchema,
  BaseIdentitySchema,
  CoreSpecsSchema,
  PricingSchema,
  LocationSchema,
  OperationalSchema,
  OdometerSchema,
  FuelTypeEnum,
  DrivetrainEnum,
  TransmissionTypeEnum,
  OdometerUnitEnum,
  ConditionEnum,
  VehicleTypeEnum,
} from './uvs-provider-schemas';
export type {
  StrictValidationResult,
  StrictUVSProvider,
} from './uvs-provider-schemas';
// Export analytics types and functions
export type { EventName, EventPayload } from './analytics';
export { generateEventId, generateSessionId, generateRequestId } from './analytics';
export * from './analytics';
// Export analytics validators
export * from './analytics-validators';
// Export unified tracking core
export { validateRequiredIds, prepareEventForInsert, REQUIRED_IDS } from './analytics-tracking-core';
export * from './analytics-tracking-core';
