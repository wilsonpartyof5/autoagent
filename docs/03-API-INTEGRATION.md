# API & Integration Documentation

**Last Updated**: 2025-02-21  
**Status**: ✅ Active Documentation

This document consolidates all API documentation, MarketCheck endpoint guides, and integration contracts.

---

## Table of Contents

1. [Drevvy MCP API](#drevvy-mcp-api)
2. [MarketCheck API Endpoints](#marketcheck-api-endpoints)
3. [API Audit & Validation](#api-audit--validation)
4. [Integration Checklist](#integration-checklist)

---

## Drevvy MCP API

### Overview

Drevvy provides a comprehensive API for vehicle search and lead generation through the MCP (Model Context Protocol) for ChatGPT App integration.

**Base URL**: `http://localhost:8787` (development) or `https://autoagentmcp-server-production.up.railway.app` (production)

### Authentication

The API uses Bearer token authentication for lead submission and dashboard integration.

### MCP Endpoints

#### POST /mcp

Main MCP protocol endpoint for ChatGPT App integration.

##### tools/list

Returns available tools and their schemas.

**Response:**
```json
{
  "tools": [
    {
      "name": "search-vehicles",
      "description": "Search for vehicles based on location, price, make, model, and other criteria",
      "inputSchema": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "Location to search for vehicles (e.g., \"Seattle, WA\", \"New York, NY\")"
          },
          "condition": {
            "type": "string",
            "enum": ["new", "used"],
            "description": "Vehicle condition (new or used)"
          },
          "maxPrice": {
            "type": "number",
            "description": "Maximum price in USD"
          },
          "make": {
            "type": "string",
            "description": "Vehicle make (e.g., \"Toyota\", \"Honda\")"
          },
          "model": {
            "type": "string",
            "description": "Vehicle model (e.g., \"Camry\", \"CR-V\")"
          },
          "radiusMiles": {
            "type": "number",
            "description": "Search radius in miles (default: 50)"
          }
        },
        "required": ["location", "condition"]
      }
    },
    {
      "name": "submit-lead",
      "description": "Submit a lead for a vehicle test drive or quote request",
      "inputSchema": {
        "type": "object",
        "properties": {
          "vehicleId": {
            "type": "string",
            "description": "ID of the vehicle"
          },
          "vin": {
            "type": "string",
            "pattern": "^[A-HJ-NPR-Z0-9]{11,17}$",
            "description": "Vehicle Identification Number (VIN)"
          },
          "dealerId": {
            "type": "string",
            "description": "ID of the dealer (optional)"
          },
          "user": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "Full name"
              },
              "email": {
                "type": "string",
                "format": "email",
                "description": "Email address"
              },
              "phone": {
                "type": "string",
                "description": "Phone number (optional)"
              },
              "preferredTime": {
                "type": "string",
                "description": "Preferred contact time (optional)"
              }
            },
            "required": ["name", "email"]
          },
          "consent": {
            "type": "boolean",
            "description": "User consent to be contacted (must be true)"
          }
        },
        "required": ["vehicleId", "vin", "user", "consent"]
      }
    }
  ]
}
```

##### tools/call

Execute a tool with parameters.

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "search-vehicles",
    "arguments": {
      "location": "Seattle, WA",
      "condition": "used",
      "maxPrice": 30000,
      "make": "Honda"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "mc-123",
        "vin": "1HGCM82633A004352",
        "stockNumber": "AA-1234",
        "listingId": "mc-123",
        "year": 2022,
        "make": "Toyota",
        "model": "Camry",
        "trim": "SE",
        "condition": "used",
        "bodyType": "Sedan",
        "drivetrain": "FWD",
        "fuelType": "Gasoline",
        "transmission": "Automatic",
        "price": 28500,
        "msrp": 32000,
        "priceChangeHistory": [
          {
            "price": 28950,
            "timestamp": "2025-02-20T17:10:00.000Z",
            "source": "marketcheck"
          }
        ],
        "miles": 15000,
        "dealer": {
          "dealerId": "dealer-1",
          "name": "Seattle Auto Center",
          "city": "Seattle",
          "state": "WA",
          "latitude": 47.6062,
          "longitude": -122.3321,
          "phone": "206-555-0100",
          "website": "https://dealer.example.com",
          "address": "123 Main St, Seattle, WA 98101"
        },
        "photoUrls": [
          "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400"
        ],
        "thumbnailUrl": "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400",
        "imageUrl": "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400",
        "features": ["Bluetooth", "Backup Camera", "Lane Assist"],
        "interiorColor": "Black",
        "exteriorColor": "Blue",
        "certified": false,
        "marketAveragePrice": 29200,
        "daysOnMarket": 21,
        "source": "marketcheck",
        "lastSyncedAt": "2025-02-20T17:10:00.000Z",
        "syncStatus": "success",
        "dataSource": "marketcheck-api",
        "leadStatus": "none",
        "createdAt": "2025-02-20T17:10:00.000Z",
        "updatedAt": "2025-02-20T17:10:00.000Z"
      }
    ],
    "totalCount": 10,
    "searchParams": {
      "location": "Seattle, WA",
      "condition": "used",
      "maxPrice": 30000,
      "make": "Honda"
    }
  }
}
```

##### resources/list

Returns available UI resources.

**Response:**
```json
{
  "resources": [
    {
      "uri": "ui://vehicle-results.html",
      "name": "Vehicle Results Widget",
      "description": "Interactive widget displaying vehicle search results",
      "mimeType": "text/html"
    }
  ]
}
```

##### resources/read

Get UI resource content.

**Request:**
```json
{
  "method": "resources/read",
  "params": {
    "uri": "ui://vehicle-results.html"
  }
}
```

**Response:**
```json
{
  "contents": [
    {
      "uri": "ui://vehicle-results.html",
      "mimeType": "text/html",
      "text": "<!DOCTYPE html>..."
    }
  ]
}
```

### Standard Endpoints

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-20T20:11:37.473Z",
  "service": "autoagent-mcp-server",
  "version": "1.0.0"
}
```

#### GET /widget/vehicle-results

Serves the interactive vehicle results widget.

**Response:** HTML content for the Zillow-style vehicle search interface.

### Data Models

#### Vehicle

```typescript
interface Vehicle {
  // Identity
  id: string;
  vin?: string;
  stockNumber?: string;
  listingId?: string;

  // Specs
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition?: 'new' | 'used' | 'certified';
  bodyType?: string;
  drivetrain?: string;
  fuelType?: string;
  transmission?: string;

  // Pricing
  price: number;
  msrp?: number;
  priceChangeHistory?: Array<{ price: number; timestamp: string; source?: string }>;

  // Mileage
  miles?: number;

  // Dealer
  dealer: {
    dealerId?: string;
    name: string;
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    website?: string;
    address?: string;
  };

  // Media
  photoUrls?: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  imageUrl?: string; // primary photo

  // Features & colors
  features?: string[];
  interiorColor?: string;
  exteriorColor?: string;
  certified?: boolean;

  // Market data
  marketAveragePrice?: number;
  daysOnMarket?: number;
  source?: string;

  // Operational metadata
  lastSyncedAt: string;
  syncStatus: 'pending' | 'in_progress' | 'success' | 'failed';
  dataSource: string;

  // Lead tracking
  leadStatus: 'none' | 'submitted' | 'qualified' | 'sold';
  lastLeadAt?: string;
  leadId?: string;

  // Audit
  createdAt: string;
  updatedAt: string;
}
```

#### Lead

```typescript
interface Lead {
  vehicleId: string;
  vin: string;
  dealerId?: string;
  user: {
    name: string;
    email: string;
    phone?: string;
    preferredTime?: string;
  };
  consent: boolean;
}
```

### Error Handling

#### MCP Error Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Invalid search parameters: location: Required"
    }
  ],
  "isError": true
}
```

#### HTTP Error Response

```json
{
  "error": "Internal server error",
  "message": "MarketCheck API error: Request timeout"
}
```

### Rate Limiting

- **Lead Submission**: 5 leads per IP per 24 hours
- **Search Requests**: No rate limiting (cached results)
- **Widget Access**: No rate limiting

### Security

#### PII Encryption
- All user data encrypted with libsodium
- 32-byte encryption key required
- Base64 encoded payloads stored in database

#### VIN Validation
- Pattern: `^[A-HJ-NPR-Z0-9]{11,17}$`
- Excludes I, O, Q characters
- Length validation enforced

#### Consent Management
- Required user consent for lead capture
- Boolean validation enforced
- Audit trail maintained

### Performance

#### Response Times
- Search API: ~200ms average
- Lead submission: <500ms
- Widget loading: <1s
- Health check: <50ms

#### Caching
- Search results: 60-second TTL
- LRU cache: 200 entries maximum
- Cache key: Sorted search parameters

### Testing

#### Unit Tests
```bash
pnpm --filter mcp-server test
```

#### Integration Tests
```bash
# Test MCP protocol
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'

# Test vehicle search
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"search-vehicles","arguments":{"location":"Seattle, WA","condition":"used"}}}'
```

---

## MarketCheck API Endpoints

**Base URL**: `https://marketcheck-prod.apigee.net`

**Authentication**: Every request must include `api_key` as a query parameter.

> **Endpoint status legend**  
> ✅ Live in Drevvy | ⚠️ Planned (documented, not yet integrated)

### Endpoint Status

#### Currently Implemented
- ✅ `/v2/search/car/active` - Used in `apps/dealer-dashboard` and `apps/mcp-server`

#### Documented but Not Implemented
- ⚠️ `/v2/listing/car/{id}` - **Status**: Not used in codebase; endpoint path needs verification
- ⚠️ `/v2/listing/car/{id}/media` - **Status**: Not used in codebase; endpoint path needs verification
- ⚠️ `/v2/listing/car/{id}/extra` - **Status**: Not used in codebase; endpoint path needs verification
- ⚠️ `/v2/dealer/{dealer_id}` - **Status**: Not used in codebase; endpoint path needs verification

**Note**: These endpoints are documented for future use. Verify endpoint paths and response structures against official MarketCheck API documentation before implementation.

### `/v2/search/car/active` ✅

Primary search endpoint for active dealer inventory. Returned payload powers our inventory metafields.

#### Request Parameters

##### Required
- `api_key` (string): MarketCheck API key

##### Optional (Dealer Filter)
- `dealer_id` (string): Restrict results to a single dealer's inventory. Example: `"12345"`.
  - **Note**: While `dealer_id` is optional for the MarketCheck API (allows general search), it is **required** for Drevvy's dealer inventory sync feature (`/app/setup`). Dealers must obtain their dealer ID from the MarketCheck dashboard before syncing. See `docs/01-CORE-DOCUMENTATION.md` for instructions on finding your dealer ID.

##### Optional (Location - Mutually Exclusive)
- `location` (string): Location string for geographic search
  - Format: `"City, State"` or `"City, ST"`
  - Example: `"Seattle, WA"` or `"New York, NY"`
  - **Note**: If both `location` and `zip` are provided, `location` takes precedence
- `zip` (string): ZIP code for location-based search
  - Example: `"98101"`
  - **Note**: Use with `radius` for geographic filtering
- `radius` (number): Search radius in miles (default: 50, only effective with `zip` or `location`)
  - Example: `50`, `100`
- `latitude` / `longitude` (numbers): Provide with `radius` for precise geo searches.

##### Optional (Vehicle Filters)
- `car_type` (string): Vehicle condition filter
  - Allowed values: `"new"`, `"used"`
  - Note: Omit for all conditions
- `make` (string): Vehicle make filter
  - Example: `"Toyota"`, `"Honda"`
- `model` (string): Vehicle model filter
  - Example: `"Camry"`, `"RAV4"`
- `price_range` (string): Price range filter
  - Format: `"min-max"`
  - Example: `"0-30000"`, `"20000-50000"`
- `year` (string): Year filter (`"2023"` or `"2019-2024"`).
- `trim` (string): Trim level filter (e.g., `"XLE"`).
- `body_type` (string): Body style (`"SUV"`, `"Sedan"`).
- `drivetrain` (string): `"AWD"`, `"FWD"`, `"RWD"`, etc.
- `fuel_type` (string): `"Gasoline"`, `"Hybrid"`, `"Electric"`, etc.
- `transmission` (string): `"Automatic"`, `"Manual"`, `"CVT"`, etc.
- `certified` (string): `"true"` or `"false"` for CPO inventory.
- `miles_range` (string): Mileage range (`"0-60000"`).
- `only_photos` (string): `"true"` to require listings with photo assets.

##### Optional (Sorting & Pagination)
- `sort` (string): Sort order (e.g., `"price"`, `"price_desc"`, `"mileage"`, `"dom"`).
- `page` (number): Page number for pagination (default: 1)
  - Example: `1`, `2`, `3`
- `pageSize` (number): Results per page (default: 20, max: 100)
  - Example: `20`, `50`, `100`

> **Location inputs**  
> Use either `location`, or (`zip` / `radius`), or (`latitude` / `longitude` / `radius`). Supplying multiple patterns can yield undefined behavior.

#### Response Structure

```json
{
  "listings": [
    {
      "id": "mc-12345",
      "vin": "1HGBH41JXMN109186",
      "stock_no": "STK-001",
      "heading": "2022 Toyota Camry LE",
      "price": 28500,
      "msrp": 32000,
      "dom": 45,
      "inventory_type": "used",
      "certified": false,
      "exterior_color": "Midnight Black",
      "interior_color": "Charcoal",
      "mileage": 15000,
      "miles": 15000,
      "source": "marketcheck",
      "price_history": [
        {
          "price": 29000,
          "timestamp": 1704067200,
          "source": "marketcheck"
        }
      ],
      "media": {
        "photo_links": [
          "https://example.com/photo1.jpg",
          "https://example.com/photo2.jpg"
        ],
        "primary_photo_url": "https://example.com/primary.jpg",
        "thumbnail": {
          "url": "https://example.com/thumb.jpg"
        },
        "video_url": "https://example.com/video.mp4"
      },
      "features": [
        "Bluetooth",
        "Backup Camera",
        "Navigation System"
      ],
      "market_data": {
        "market_average_price": 28000
      },
      "dealer": {
        "id": "12345",
        "name": "ABC Auto Sales",
        "street": "123 Main St",
        "address": "123 Main St",
        "city": "Seattle",
        "state": "WA",
        "zip": "98101",
        "latitude": 47.6062,
        "longitude": -122.3321,
        "phone": "206-555-1234",
        "website": "https://abcautosales.com"
      },
      "build": {
        "year": 2022,
        "make": "Toyota",
        "model": "Camry",
        "trim": "LE",
        "body_type": "Sedan",
        "drivetrain": "FWD",
        "drive_train": "FWD",
        "fuel_type": "Gasoline",
        "transmission": "Automatic"
      }
    }
  ],
  "num_found": 150,
  "page": 1,
  "pageSize": 20
}
```

#### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique listing identifier |
| `vin` | string? | Vehicle Identification Number |
| `heading` | string? | Vehicle title/heading |
| `stock_no` | string? | Dealer stock number |
| `price` | number? | Current asking price |
| `msrp` | number? | Manufacturer's Suggested Retail Price |
| `dom` / `days_on_market` | number? | Days on market |
| `miles` / `mileage` | number? | Vehicle mileage |
| `features` | string[]? | Array of feature descriptions |
| `media.photo_links` | string[]? | Array of photo URLs |
| `media.primary_photo_url` | string? | Primary photo URL |
| `media.thumbnail.url` | string? | Thumbnail image URL |
| `media.video_url` | string? | Video URL if available |
| `dealer.name` | string | Dealer name (required in response) |
| `dealer.id` | string \| number? | Dealer identifier |
| `dealer.address` / `dealer.street` | string? | Street address |
| `dealer.city` | string? | City |
| `dealer.state` | string? | State abbreviation |
| `dealer.zip` | string? | ZIP code |
| `dealer.latitude` | number \| string? | Latitude coordinate (often stringified) |
| `dealer.longitude` | number \| string? | Longitude coordinate (often stringified) |
| `dealer.phone` | string? | Phone number |
| `dealer.website` | string? | Website URL |
| `build.year` | number? | Model year |
| `build.make` | string? | Vehicle make |
| `build.model` | string? | Vehicle model |
| `build.trim` | string? | Trim level |
| `build.body_type` | string? | Body type (Sedan, SUV, etc.) |
| `build.drivetrain` / `build.drive_train` | string? | Drivetrain (FWD, RWD, AWD) |
| `build.fuel_type` | string? | Fuel type |
| `build.transmission` | string? | Transmission type |
| `inventory_type` | "new" \| "used" \| "cpo"? | Inventory condition |
| `certified` | boolean? | CPO certification status |
| `exterior_color` | string? | Exterior color |
| `interior_color` | string? | Interior color |
| `price_history` | array? | Array of price change records |
| `market_data.market_average_price` | number? | Market average price |
| `source` | string? | Data source identifier |

#### Field Name Variations

- `dom` and `days_on_market` may both appear (use `dom` if available)
- `miles` and `mileage` may both appear (use `miles` if available)
- `drivetrain` and `drive_train` may both appear (prefer `drivetrain`)

#### Pagination Behavior

- Default page size: 20
- Maximum page size: 100
- Response includes `num_found` (total matching results) and `page`/`pageSize` for pagination
- Use `page` and `pageSize` parameters to navigate through results

#### Important Notes

- MarketCheck enforces per-key throttling (expect 429 when exceeded). Keep requests ≤100/minute with exponential backoff.
- Cache responses when possible; use `cache: 'no-store'` only when you need the latest data on every call.
- `num_found` and `page`/`pageSize` always accompany `listings`; use them to iterate through pages.
- Empty responses return `{ "listings": [], "num_found": 0, "page": 1, "pageSize": 20 }`.

### Planned Endpoints (Not Yet Implemented)

#### `/v2/listing/car/{id}` ⚠️

**⚠️ Status**: This endpoint is documented but not currently used in the Drevvy codebase. Verify endpoint path and response structure against official MarketCheck API documentation before implementation.

**Use Case**: Get detailed information for a specific vehicle listing by ID.

#### `/v2/listing/car/{id}/media` ⚠️

**⚠️ Status**: This endpoint is documented but not currently used in the Drevvy codebase. Verify endpoint path and response structure against official MarketCheck API documentation before implementation.

**Use Case**: Get media assets (photos, videos) for a specific vehicle listing.

#### `/v2/listing/car/{id}/extra` ⚠️

**⚠️ Status**: This endpoint is documented but not currently used in the Drevvy codebase. Verify endpoint path and response structure against official MarketCheck API documentation before implementation.

**Use Case**: Get additional details (seller comments, option packages, specifications) for a specific vehicle listing.

#### `/v2/dealer/{dealer_id}` ⚠️

**⚠️ Status**: This endpoint is documented but not currently used in the Drevvy codebase. Verify endpoint path and response structure against official MarketCheck API documentation before implementation.

**Use Case**: Get dealer information including hours, ratings, and metadata.

---

## API Audit & Validation

### Critical Findings

#### ✅ Endpoint Coverage
- **Only 1 of 5 endpoints is actually used**: `/v2/search/car/active`
- **4 endpoints documented but not implemented**: `/listing/{id}`, `/listing/{id}/media`, `/listing/{id}/extra`, `/dealer/{dealer_id}`

#### ⚠️ Parameter Issues
1. **`dealer_id` incorrectly marked as REQUIRED** - It's optional (only needed for dealer-specific sync)
2. **Missing optional parameters**: `year`, `transmission`, `drivetrain`, `body_type`, `fuel_type`, `certified`, `miles`, `sort`
3. **`location` vs `zip`+`radius`** - Mutual exclusivity not documented

#### ⚠️ Response Structure
- Response wrapper structure unclear (should be `{ listings: [], num_found: number, page: number, pageSize: number }`)
- Field name variations not documented (`dom` vs `days_on_market`, `miles` vs `mileage`)
- Missing `heading` field in documentation

### Validation Checklist

Before relying on this documentation:

- [ ] Test `/v2/search/car/active` with actual API call
- [ ] Verify response structure matches documented format
- [ ] Confirm pagination max (100?)
- [ ] Test all optional parameters
- [ ] Validate rate limits (if available in official docs)
- [ ] Verify unused endpoint paths against official docs
- [ ] Test response structures for unused endpoints (if implementing)

### Questions to Resolve

1. **Do we need the listing/dealer endpoints for inventory metafields?**
   - If `/v2/search/car/active` provides all required data, consider removing unused endpoints
   - If we need seller comments, extended photos, or dealer hours, implement them

2. **What are the actual MarketCheck API rate limits?**
   - Needed for proper throttling and error handling

3. **Is 100 the actual maximum pageSize?**
   - Codebase uses 100, but need to verify against official docs

---

## Integration Checklist

### Pre-Integration

- [ ] Obtain MarketCheck API key
- [ ] Verify API key has required permissions
- [ ] Test API connectivity with sample request
- [ ] Review rate limits and throttling requirements
- [ ] Understand response structure and field variations

### Integration Steps

- [ ] Implement `/v2/search/car/active` endpoint integration
- [ ] Handle pagination (max 100 per page)
- [ ] Implement rate limiting and exponential backoff
- [ ] Normalize response fields (handle `dom` vs `days_on_market`, etc.)
- [ ] Map MarketCheck response to Drevvy Vehicle schema
- [ ] Implement error handling for API failures
- [ ] Add caching layer (60s TTL recommended)
- [ ] Test with various search parameters
- [ ] Verify dealer-specific filtering works correctly

### Post-Integration

- [ ] Monitor API usage and rate limits
- [ ] Track error rates and response times
- [ ] Document any API quirks or edge cases
- [ ] Consider implementing unused endpoints if needed
- [ ] Update documentation with actual response examples

---

**Related Documentation**:
- Core Documentation: `docs/01-CORE-DOCUMENTATION.md`
- Deployment Guides: `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`
- MarketCheck Integration: `docs/05-MARKETCHECK-INTEGRATION.md`

