# Stage 0 — Discovery Report
## OpenAI Query Parsing API for iOS Inventory Search

**Date**: 2025-01-27  
**Status**: Complete — Ready for Stage 1 approval

---

## Files Read

### Core API Files
1. **`apps/dealer-dashboard/src/app/api/inventory/search/route.ts`**
   - Current inventory search API endpoint (`POST /api/inventory/search`)
   - Handles bounds-based search with filters
   - Validates API key via `INVENTORY_SEARCH_API_KEY` env var
   - Supports pagination (default 8 vehicles per page, max 50)

2. **`apps/dealer-dashboard/src/lib/db/uvs-vehicles.ts`**
   - Database layer for UVS vehicle queries
   - `searchUVSVehiclesByBounds()` function (lines 491-731)
   - `UVSVehicleBoundsSearchParams` interface (lines 454-479)
   - Distance calculation and bounds filtering logic

3. **`packages/shared/src/uvs.ts`**
   - Unified Vehicle Schema (UVS) TypeScript types
   - Complete field definitions for `UnifiedVehicle`, `CoreSpecs`, `FeaturesPackages`, etc.

4. **`apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`**
   - Database schema for `uvs_vehicles` table
   - Index definitions for common queries
   - Field mappings from UVS to database columns

### iOS Files
5. **`Autogentic/ViewModels/MapViewModel.swift`**
   - Current iOS app structure (basic stub with hardcoded data)
   - No API integration yet

### Documentation
6. **`docs/IOS_LIVE_APP_PLAN.md`**
   - Confirms inventory search API is live
   - Documents current iOS wiring status

---

## Current Inventory Search API Contract

### Endpoint
```
POST /api/inventory/search
```

### Request Format
```json
{
  "bounds": {
    "north": 34.9855,
    "south": 34.9123,
    "east": -80.9234,
    "west": -81.0123
  },
  "filters": {
    "minPrice": 20000,
    "maxPrice": 80000,
    "make": "GMC",
    "model": "Sierra",
    "year": 2023,
    "minYear": 2020,
    "maxYear": 2024,
    "maxMiles": 50000,
    "condition": "new",
    "dealerId": "12345"
  },
  "pagination": {
    "page": 1,
    "limit": 8
  },
  "userLocation": {
    "latitude": 34.95,
    "longitude": -80.98
  }
}
```

### Response Format
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "mc-123",
        "year": 2023,
        "make": "GMC",
        "model": "Sierra",
        "trim": "SLT",
        "condition": "new",
        "price": 45000,
        "msrp": 48000,
        "miles": 0,
        "bodyType": "Truck",
        "thumbnailUrl": "...",
        "primaryPhotoUrl": "...",
        "location": {
          "latitude": 34.95,
          "longitude": -80.98,
          "dealerName": "ABC Auto",
          "dealerCity": "Charlotte",
          "dealerState": "NC"
        },
        "vin": "1GT..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 8,
      "total": 232,
      "totalPages": 29,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### Authentication
- Header: `x-api-key: <INVENTORY_SEARCH_API_KEY>`
- Or: `Authorization: Bearer <INVENTORY_SEARCH_API_KEY>`

---

## Filterable Fields in UVS Data

### Currently Supported by API (in `filters` object)
✅ **Price**
- `minPrice` (number, >= 0)
- `maxPrice` (number, >= 0)

✅ **Make/Model**
- `make` (string, exact match)
- `model` (string, exact match)

✅ **Year**
- `year` (number, 1900-2100, exact match)
- `minYear` (number, 1900-2100)
- `maxYear` (number, 1900-2100)

✅ **Miles**
- `maxMiles` (number, >= 0)

✅ **Condition**
- `condition` ("new" | "used" | "certified")

✅ **Dealer**
- `dealerId` (string)

### Available in UVS Data (NOT yet exposed in API filters)
📋 **Color** (stored in `featuresPackages`)
- `exteriorColor` (string) — e.g., "Black", "White", "Silver"
- `interiorColor` (string) — e.g., "Black", "Beige"

📋 **Body Type** (stored in `coreSpecs`)
- `bodyType` (string) — e.g., "SUV", "Sedan", "Truck", "Coupe"
- Currently returned in response but not filterable via API

📋 **Trim** (stored in `baseIdentity`)
- `trim` (string) — e.g., "SLT", "LTZ", "Limited"
- Available in database query layer but not in API filters

📋 **Drivetrain** (stored in `coreSpecs`)
- `drivetrain` ("fwd" | "rwd" | "awd" | "4wd" | "part-time 4wd")

📋 **Fuel Type** (stored in `coreSpecs`)
- `fuelType` ("gasoline" | "diesel" | "electric" | "hybrid" | "plug-in hybrid" | "flex fuel" | "natural gas" | "hydrogen" | "other")

📋 **Min Miles** (stored in `coreSpecs.miles`)
- `minMiles` (supported in database layer but not in API filters)

### Database Indexes
- ✅ Indexed: `make`, `model`, `year`, `price`, `condition`, `miles`, `dealer_latitude`, `dealer_longitude`
- ✅ Composite indexes: `(make, model, year)`, `(condition, price)`
- ⚠️ **Body type, color, trim**: Stored in JSONB (`uvs_data`) — requires JSONB queries (slower)

---

## Where to Add New API Route

### Location
```
apps/dealer-dashboard/src/app/api/query/parse/route.ts
```

### Rationale
- Follows Next.js App Router convention (`/api/query/parse` → `/api/query/parse/route.ts`)
- Separate from `/api/inventory/search` to maintain single responsibility
- Can reuse existing API key validation pattern from inventory search

### Route Structure
```
apps/dealer-dashboard/src/app/api/
├── inventory/
│   ├── search/
│   │   └── route.ts          (existing)
│   └── sync/
│       └── route.ts
└── query/                     (NEW)
    └── parse/
        └── route.ts           (NEW - Stage 1)
```

---

## Gaps & Constraints

### ✅ Good News
1. **API foundation is solid**: Existing `/api/inventory/search` has comprehensive validation and error handling
2. **Database indexes**: Well-indexed for common filters (make, model, year, price, condition)
3. **UVS schema is comprehensive**: All needed fields exist in the data structure
4. **Authentication pattern**: API key validation already implemented and reusable

### ⚠️ Constraints & Considerations

1. **Color/Body Type Filtering**
   - Colors and body types are stored in JSONB (`uvs_data`)
   - Requires JSONB containment queries: `query.contains('uvs_data', { coreSpecs: { bodyType: 'SUV' } })`
   - Performance may be slower than indexed column queries
   - **Recommendation**: Start with make/model/price/year/miles/condition for Stage 1, add color/bodyType in Stage 2 if needed

2. **Missing API Filter Fields**
   - Current API filters don't expose: `bodyType`, `exteriorColor`, `interiorColor`, `trim`, `drivetrain`, `fuelType`, `minMiles`
   - **Gap**: Query parser may want to extract these, but API doesn't support them yet
   - **Recommendation for Stage 1**: Parse query but only return filters that API supports. Log unsupported filters for future enhancement.

3. **Color Normalization**
   - UVS stores colors as free-form strings: "Black", "BLACK", "Jet Black", etc.
   - **Gap**: No standardization — "red" might not match "Fire Red"
   - **Recommendation**: In Stage 1 parsing, normalize to common color names, but only if we add color filtering to the API

4. **iOS Integration Points**
   - Current iOS app (`MapViewModel.swift`) has no API integration yet
   - **Gap**: Need to identify where chat input triggers search
   - **Recommendation**: Stage 2 will require iOS app structure discovery

5. **OpenAI API Key**
   - Need to confirm `OPENAI_API_KEY` environment variable is available
   - **Gap**: May need to add to Vercel env vars for production

6. **Query Parsing Schema**
   - Need strict JSON schema that matches API filter contract
   - **Gap**: Must align parser output with `/api/inventory/search` filters exactly
   - **Recommendation**: Use OpenAI function calling or structured outputs for strict schema

---

## Recommended Filter Schema for Query Parser

Based on current API capabilities, the parser should extract:

```typescript
interface ParsedFilters {
  // Price range
  minPrice?: number;
  maxPrice?: number;
  
  // Vehicle identity
  make?: string;
  model?: string;
  year?: number;          // Exact year
  minYear?: number;       // Year range start
  maxYear?: number;       // Year range end
  
  // Condition
  condition?: 'new' | 'used' | 'certified';
  
  // Mileage
  maxMiles?: number;
  
  // Future fields (parse but don't send to API yet)
  bodyType?: string;      // For logging/future use
  exteriorColor?: string; // For logging/future use
  trim?: string;          // For logging/future use
}
```

---

## Next Steps for Stage 1

1. ✅ Create `/api/query/parse` endpoint
2. ✅ Add OpenAI server-side integration
3. ✅ Define strict JSON schema matching API filter contract
4. ✅ Add validation and normalization (clamp ranges, normalize makes/models)
5. ✅ Return parsed filters in response
6. ✅ Add error handling and fallback behavior

**Ready for Stage 1 approval?** ✅

