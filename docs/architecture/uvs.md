# Unified Vehicle Schema (UVS) Architecture

## Overview

The Unified Vehicle Schema (UVS) is a provider-agnostic data model designed to represent vehicle inventory data from multiple sources in a standardized format. It supports integration with:

- **MarketCheck API** - Third-party inventory aggregation
- **Homenet** - Dealer website platform
- **vAuto** - Inventory management and pricing tools
- **Dealer Inspire** - Digital marketing platform
- **Dealer.com** - Website and marketing solutions
- **OEM Feeds** - Manufacturer direct feeds
- **Dealer CSV/API** - Custom dealer integrations
- **CDK/Reynolds** - DMS (Dealer Management Systems)

The schema is extensible via an enrichment block, allowing AI-generated enhancements and provider-specific metadata to be preserved without breaking the core structure.

## Design Principles

1. **Provider-Agnostic**: Core fields work across all data sources
2. **Backward Compatible**: Existing Vehicle schema can map to UVS
3. **Extensible**: Enrichment block allows growth without breaking changes
4. **Type-Safe**: Full TypeScript support with readonly interfaces
5. **Practical**: Covers real-world fields from major providers
6. **Immutable**: Readonly properties promote data integrity

## Schema Structure

The UVS is organized into logical sections:

```
UnifiedVehicle
├── id (required)
├── baseIdentity (required: year, make, model)
├── condition (optional)
├── coreSpecs (optional)
├── dimensionsPerformance (optional)
├── pricing (required: price)
├── featuresPackages (optional)
├── media (optional)
├── history (optional)
├── location (required: dealer.name)
├── availability (optional)
├── marketData (optional)
├── dealerDefined (optional)
├── operational (required: lastSyncedAt)
├── leadTracking (optional)
└── enrichment (optional, extensible)
```

## Field Naming Conventions

### camelCase

All fields use **camelCase** naming convention:

- ✅ `baseIdentity`, `coreSpecs`, `priceChangeHistory`
- ❌ `base_identity`, `CoreSpecs`, `price_change_history`

### Units

Measurements always include explicit units:

- **Length/Distance**: `inches`, `feet`, `meters`, `millimeters`
- **Weight**: `pounds`, `kilograms`
- **Speed**: `mph`, `km/h`
- **Fuel Economy**: `mpg`, `l/100km`, `kWh/100mi`, `mi/kWh`
- **Currency**: ISO 4217 codes (e.g., `USD`, `CAD`, `EUR`)

### Dates and Times

All timestamps use **ISO 8601** format:

- Datetime: `2024-01-15T10:30:00Z`
- Date: `2024-01-15`
- Stored as strings for JSON compatibility

### Enumerations

Enums use lowercase with underscores for multi-word values:

- Condition: `'new'`, `'used'`, `'certified'`
- Status: `'available'`, `'in_transit'`, `'on_order'`
- Fuel Type: `'plug-in hybrid'`, `'flex fuel'`

## Required vs Optional Fields

### Required Fields

**Top Level:**
- `id` - Unique identifier
- `baseIdentity` - Core identification
- `pricing.price` - Current price
- `location.dealer.name` - Dealer name
- `operational.lastSyncedAt` - Sync timestamp

**Within baseIdentity:**
- `year` - Model year
- `make` - Manufacturer
- `model` - Model name

**Within pricing:**
- `price` - Current asking price

**Within location.dealer:**
- `name` - Dealer name

**Within operational:**
- `lastSyncedAt` - Last sync timestamp

### Optional Fields

All other fields are optional to support partial data from various sources. Use optional chaining when accessing nested properties:

```typescript
const trim = vehicle.baseIdentity?.trim;
const mileage = vehicle.coreSpecs?.miles;
const engineHp = vehicle.coreSpecs?.engine?.horsepower;
```

## Section Details

### Base Identity

Core vehicle identification information. Only `year`, `make`, and `model` are required.

```typescript
baseIdentity: {
  year: 2023,
  make: 'Toyota',
  model: 'Camry',
  vin: '1HGBH41JXMN109186', // Optional but highly recommended
  trim: 'LE',
  stockNumber: 'STK-12345',
  listingId: 'mc-abc123'
}
```

### Condition

Vehicle condition/type classification:

- `'new'` - New vehicle
- `'used'` - Pre-owned vehicle
- `'certified'` - CPO/Manufacturer Certified Pre-Owned

### Core Specs

Essential vehicle specifications:

- Body type, doors, seating
- Fuel type (gasoline, diesel, electric, hybrid, etc.)
- Engine details (displacement, cylinders, horsepower)
- Transmission (type, speeds)
- Drivetrain (FWD, RWD, AWD, 4WD)
- Mileage/odometer

### Dimensions & Performance

Physical dimensions and performance metrics:

- Length, width, height, wheelbase
- Weight (curb weight, payload, towing)
- Fuel economy (city, highway, combined)
- Acceleration (0-60 mph, 0-100 km/h)
- Top speed

All measurements include explicit units.

### Pricing

Pricing information with currency support:

- `price` (required) - Current asking price
- `msrp` - Manufacturer's Suggested Retail Price
- `invoicePrice` - Dealer invoice
- `internetPrice` - Special internet pricing
- `priceChangeHistory` - Historical price changes
- `financing` - Monthly payment, APR, terms

Currency defaults to USD but supports ISO 4217 codes.

### Features & Packages

Vehicle features, options, and packages:

- `features` - Array of feature descriptions
- `packages` - Installed option packages with codes/prices
- `options` - Individual options/accessories
- Colors (interior/exterior) with optional OEM codes
- Certification and warranty information

### Media

Vehicle media assets:

- `photoUrls` - Array of photo URLs
- `thumbnailUrl` - Thumbnail image
- `primaryPhotoUrl` - Primary/featured photo (legacy support)
- `videoUrl` - Video walkaround/test drive
- `virtualTourUrl` - 360° virtual tour
- `windowStickerUrl` - Monroney sticker
- `buildSheetUrl` - Build sheet
- `carfaxUrl` - Carfax/AutoCheck report
- `images` - Structured array with metadata (type, caption, sort order)

### History

Vehicle history and ownership:

- Accident history (boolean, count)
- Owner count
- Service history and records
- Title status (clean, salvage, rebuilt, etc.)
- Previous use (personal, commercial, lease, rental, fleet, etc.)
- In-service date, last owned date

### Location

Physical location and dealer information:

- **Dealer** (name required):
  - Address (street, city, state, zip, country)
  - Coordinates (latitude, longitude)
  - Contact (phone, website, email)
  - Business hours
  - Rating and review count

- Location details:
  - `locationName` - Specific lot/location name
  - `lotNumber` - Lot identifier

### Availability

Vehicle availability status and timing:

- `status` - `'available'`, `'pending'`, `'sold'`, `'in_transit'`, `'on_order'`, `'hold'`, `'unavailable'`
- `isLive` - Whether listing is published
- `publishedAt` - Publication timestamp
- `availableDate` - Expected availability (for in-transit vehicles)
- `daysOnMarket` - Days listing has been active
- `daysOnLot` - Days vehicle has been on lot

### Market Data

Market analysis and competitive data:

- `marketAveragePrice` - Market average for similar vehicles
- `marketPriceRange` - Low/high price range
- `competitivePosition` - Below/at/above market
- `turnRate` - Expected inventory turn rate (days)
- `marketRank` - Price rank within market
- `similarListings` - Count of similar vehicles

### Dealer-Defined Fields

Dealer-specific custom fields:

- `customFields` - Arbitrary key-value pairs
- `internalNotes` - Internal notes (not customer-facing)
- `salesperson` - Assigned salesperson
- `priority` - Inventory priority/ranking
- `tags` - Dealer-defined tags/categories
- `sourceSystem` - Source system identifier (CDK, Reynolds, Homenet)
- `sourceSystemId` - Vehicle ID in source system

### Operational

Operational sync and tracking metadata:

- `dataSource` - Provider (e.g., `'marketcheck-api'`, `'vauto'`, `'homenet'`)
- `lastSyncedAt` (required) - Last sync timestamp
- `syncStatus` - `'pending'`, `'in_progress'`, `'success'`, `'failed'`
- `syncError` - Error message from failed sync
- `syncRetryCount` - Number of retry attempts
- `createdAt`, `updatedAt` - Record timestamps

### Lead Tracking

Lead generation and tracking:

- `leadStatus` - `'none'`, `'submitted'`, `'qualified'`, `'contacted'`, `'sold'`
- `leadId` - Associated lead identifier
- `lastLeadAt` - Timestamp of last lead submission
- `leadCount` - Total number of leads generated

### Enrichment Block

Extensible block for AI-generated and third-party enhanced data:

#### AI Generated

AI-generated enhancements:

- `description` - AI-generated vehicle description
- `seoTitle` - SEO-optimized title
- `seoDescription` - SEO meta description
- `sellingPoints` - Key selling points
- `recommendedPrice` - AI-suggested optimal price

#### Provider Specific

Raw provider-specific data preserved for reference:

- Arbitrary key-value pairs
- Preserves original structure for debugging/reference

#### Third Party

Third-party enriched data:

- `carfax` - Carfax report data
- `autocheck` - AutoCheck report data
- `kbb` - Kelley Blue Book data
- Extensible for other providers

**All enrichment fields are optional and can be extended without breaking changes.**

## Provider-Specific Metadata

Provider-specific fields should be stored in the `enrichment.providerSpecific` block:

```typescript
enrichment: {
  providerSpecific: {
    marketcheck: {
      id: 'mc-12345',
      heading: '2023 Toyota Camry LE',
      dom: 45,
      // ... MarketCheck-specific fields
    },
    vauto: {
      vAutoId: 'va-67890',
      pricingZone: 'west-coast',
      // ... vAuto-specific fields
    }
  }
}
```

This preserves provider context without polluting the core schema.

## Validation

The schema includes JSON Schema validation rules:

- String patterns (VIN, currency codes, state codes)
- Numeric ranges (years, mileage, prices)
- Required field enforcement
- Enum value constraints
- Date/time format validation

TypeScript types provide compile-time validation:

```typescript
import type { UnifiedVehicle } from '@autoagent/shared';

function processVehicle(vehicle: UnifiedVehicle) {
  // TypeScript ensures correct structure
  const price = vehicle.pricing.price; // number, required
  const trim = vehicle.baseIdentity?.trim; // string | undefined
}
```

## Migration from Existing Vehicle Schema

The existing `Vehicle` schema in `packages/shared/src/types.ts` can be mapped to UVS:

```typescript
// Existing Vehicle
interface Vehicle {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  price: number;
  // ... other fields
}

// Maps to UnifiedVehicle
const unified: UnifiedVehicle = {
  id: vehicle.id,
  baseIdentity: {
    vin: vehicle.vin,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    stockNumber: vehicle.stockNumber,
    listingId: vehicle.listingId
  },
  pricing: {
    price: vehicle.price,
    msrp: vehicle.msrp,
    priceChangeHistory: vehicle.priceChangeHistory
  },
  // ... map other fields
};
```

## TypeScript Usage

### Import Types

```typescript
import type {
  UnifiedVehicle,
  BaseIdentity,
  Pricing,
  Location,
  Enrichment
} from '@autoagent/shared';
```

### Optional Chaining

Always use optional chaining for nested properties:

```typescript
const vehicle: UnifiedVehicle = { /* ... */ };

// Safe access to optional fields
const engineHp = vehicle.coreSpecs?.engine?.horsepower;
const cityMpg = vehicle.dimensionsPerformance?.fuelEconomy?.city;
const lastPriceChange = vehicle.pricing.priceChangeHistory?.[0];
```

### Type Guards

Use the provided type guard to validate objects:

```typescript
import { isUnifiedVehicle } from '@autoagent/shared';

if (isUnifiedVehicle(data)) {
  // TypeScript knows data is UnifiedVehicle
  console.log(data.pricing.price);
}
```

## Extension Points

The schema is designed for extension:

1. **Enrichment Block**: Add new fields under `enrichment`
2. **Dealer-Defined**: Use `dealerDefined.customFields` for arbitrary data
3. **Provider-Specific**: Store in `enrichment.providerSpecific`
4. **Future Schema Versions**: Add new top-level optional sections

## Best Practices

1. **Always validate**: Use JSON Schema or TypeScript types
2. **Use optional chaining**: Protect against undefined nested fields
3. **Preserve provider data**: Store in `enrichment.providerSpecific`
4. **Normalize units**: Convert to schema-standard units
5. **ISO 8601 dates**: Always use ISO format for timestamps
6. **Immutable data**: Treat objects as readonly
7. **Extensible design**: Add new fields via enrichment block

## Open Questions & Assumptions

### Assumptions

1. **Primary market**: US-focused (USD default, miles, MPG), but supports international
2. **Single dealer per vehicle**: Each vehicle has one primary dealer location
3. **Price currency**: Defaults to USD, but supports ISO 4217 codes
4. **Measurement units**: Mixed units supported (imperial/metric) with explicit unit specification

### Open Questions

1. **Multi-location dealers**: Should we support multiple lot locations per vehicle?
2. **Auction data**: Should we include auction history/details?
3. **Financing terms**: Should financing be more detailed (lender info, incentives)?
4. **Warranty details**: Should warranty include coverage details (powertrain, bumper-to-bumper)?
5. **Vehicle modifications**: Should we track aftermarket modifications?
6. **Trade-in details**: Should we include trade-in vehicle information?

These can be addressed in future schema versions or via enrichment extensions.

## References

- JSON Schema: `docs/schema/unified-vehicle.schema.json`
- TypeScript Types: `packages/shared/src/uvs.ts`
- Existing Vehicle Schema: `packages/shared/src/types.ts`
- MarketCheck API Docs: `docs/api/marketcheck-endpoints.md`

