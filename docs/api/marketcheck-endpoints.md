# MarketCheck Cars API v2 Endpoints

**Base URL**: `https://marketcheck-prod.apigee.net`

**Authentication**: Every request must include `api_key` as a query parameter.

> **Endpoint status legend**  
> ✅ Live in Drevvy | ⚠️ Planned (documented, not yet integrated)

---

## 1. `/v2/search/car/active` ✅

Primary search endpoint for active dealer inventory. Returned payload powers our inventory metafields.

### Request Parameters

#### Required
- `api_key` (string): MarketCheck API key

#### Optional
- `dealer_id` (string): Restrict results to a single dealer's inventory. Example: `"12345"`.
  - **Note**: While `dealer_id` is optional for the MarketCheck API (allows general search), it is **required** for Drevvy's dealer inventory sync feature (`/app/setup`). Dealers must obtain their dealer ID from the MarketCheck dashboard before syncing. See `docs/quickstart.md` for instructions on finding your dealer ID.
- `location` (string): Location string for geographic search
  - Format: `"City, State"` or `"City, ST"`
  - Example: `"Seattle, WA"` or `"New York, NY"`
- `zip` (string): ZIP code for location-based search
  - Example: `"98101"`
- `radius` (number): Search radius in miles (default: 50)
  - Example: `50`, `100`
- `latitude` / `longitude` (numbers): Provide with `radius` for precise geo searches.
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
- `sort` (string): Sort order (e.g., `"price"`, `"price_desc"`, `"mileage"`, `"dom"`).
- `page` (number): Page number for pagination (default: 1)
  - Example: `1`, `2`, `3`
- `pageSize` (number): Results per page (default: 20, max: 100)
  - Example: `20`, `50`, `100`

> **Location inputs**  
> Use either `location`, or (`zip` / `radius`), or (`latitude` / `longitude` / `radius`). Supplying multiple patterns can yield undefined behavior.

### Response Structure

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

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique listing identifier |
| `vin` | string? | Vehicle Identification Number |
| `heading` | string? | Listing headline supplied by MarketCheck |
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

### Pagination Behavior

- Default page size: 20
- Maximum page size: 100
- Response includes `num_found` (total matching results) and `page`/`pageSize` for pagination
- Use `page` and `pageSize` parameters to navigate through results

### Important Notes

- MarketCheck enforces per-key throttling (expect 429 when exceeded). Keep requests ≤100/minute with exponential backoff.
- Cache responses when possible; use `cache: 'no-store'` only when you need the latest data on every call.
- `num_found` and `page`/`pageSize` always accompany `listings`; use them to iterate through pages.
- Empty responses return `{ "listings": [], "num_found": 0, "page": 1, "pageSize": 20 }`.

---

## 2. `/v2/listing/car/{id}` ⚠️ (Planned)

Get detailed information for a specific vehicle listing by ID.

### Request Parameters

#### Required (Path)
- `id` (string): Listing ID from search results
  - Example: `"mc-12345"`

#### Required (Query)
- `api_key` (string): MarketCheck API key

#### Optional (Query)
- Additional parameters may be available for filtering or expanding response (not documented in codebase)

### Response Structure

Expected to return a single listing object with the same structure as items in `/v2/search/car/active`, but potentially with additional fields:

- More detailed `build` information
- Extended `price_history`
- Additional `features` or specifications
- Complete `dealer` block with all metadata
- Full `media` array with all photo/video links
- Seller comments or descriptions (if available)

### Differences from Search Response

- Single object instead of array
- May include additional fields not present in search results
- More complete `price_history` timeline
- Potentially more detailed `build` specifications
- Extended feature lists

### Important Notes

- We do **not** call this endpoint yet—verify parameter list and payload with the official MarketCheck docs before shipping.
- Use listing `id` from search results once the endpoint is validated.
- Expect richer seller comments, equipment, and pricing history than the search payload provides.

---

## 3. `/v2/listing/car/{id}/media` ⚠️ (Planned)

Get media assets (photos, videos) for a specific vehicle listing.

### Request Parameters

#### Required (Path)
- `id` (string): Listing ID
  - Example: `"mc-12345"`

#### Required (Query)
- `api_key` (string): MarketCheck API key

### Response Structure (Inferred)

```json
{
  "listing_id": "mc-12345",
  "media": {
    "photo_links": [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg",
      "https://example.com/photo3.jpg"
    ],
    "primary_photo_url": "https://example.com/primary.jpg",
    "thumbnail": {
      "url": "https://example.com/thumb.jpg",
      "width": 200,
      "height": 150
    },
    "video_url": "https://example.com/video.mp4",
    "video_thumbnail_url": "https://example.com/video-thumb.jpg"
  },
  "total_photos": 15,
  "total_videos": 1
}
```

### Media Fields

| Field | Type | Description |
|-------|------|-------------|
| `photo_links` | string[] | Array of full-resolution photo URLs |
| `primary_photo_url` | string? | Primary/featured photo URL |
| `thumbnail.url` | string? | Thumbnail image URL |
| `thumbnail.width` | number? | Thumbnail width in pixels |
| `thumbnail.height` | number? | Thumbnail height in pixels |
| `video_url` | string? | Video URL (if available) |
| `video_thumbnail_url` | string? | Video thumbnail/preview image |
| `total_photos` | number? | Total number of photos available |
| `total_videos` | number? | Total number of videos available |

### Important Notes

- Not yet integrated. Confirm request/response details before calling this endpoint from production code.
- Media responses may follow different throttling rules—keep requests serialized with ample spacing.
- CDN URLs are generally long-lived; cache media references for 24h+ once confirmed.

---

## 4. `/v2/listing/car/{id}/extra` ⚠️ (Planned)

Get additional vehicle details, options, features, and seller comments.

### Request Parameters

#### Required (Path)
- `id` (string): Listing ID
  - Example: `"mc-12345"`

#### Required (Query)
- `api_key` (string): MarketCheck API key

### Response Structure (Inferred)

```json
{
  "listing_id": "mc-12345",
  "features": [
    "Bluetooth",
    "Backup Camera",
    "Navigation System",
    "Sunroof",
    "Leather Seats"
  ],
  "options": [
    {
      "name": "Premium Package",
      "code": "PKG-PREM",
      "description": "Includes navigation, sunroof, and premium audio"
    }
  ],
  "seller_comments": "One owner, garage kept, no accidents. Clean Carfax available.",
  "description": "Beautiful 2022 Toyota Camry LE with low miles...",
  "specifications": {
    "engine": "2.5L 4-Cylinder",
    "horsepower": 203,
    "torque": 184,
    "mpg_city": 28,
    "mpg_highway": 39,
    "fuel_capacity": 15.8
  },
  "warranty": {
    "type": "CPO",
    "remaining_months": 24,
    "remaining_miles": 50000
  },
  "history": {
    "accidents": 0,
    "owners": 1,
    "service_records": 5
  }
}
```

### Extra Fields

| Field | Type | Description |
|-------|------|-------------|
| `features` | string[] | Expanded feature list (beyond basic features in listing) |
| `options` | array? | Array of option packages with name, code, description |
| `seller_comments` | string? | Dealer/seller comments or notes |
| `description` | string? | Full vehicle description |
| `specifications` | object? | Detailed specifications (engine, MPG, etc.) |
| `warranty` | object? | Warranty information (type, remaining time/miles) |
| `history` | object? | Vehicle history (accidents, owners, service records) |

### Important Notes

- Structure above is illustrative—verify with the live endpoint before use.
- `seller_comments` often contain HTML; sanitize for UI rendering.
- Specification/history payloads vary by data source; populate defaults defensively.

---

## 5. `/v2/dealer/{dealer_id}` ⚠️ (Planned)

Get dealer metadata and location information for attribution.

### Request Parameters

#### Required (Path)
- `dealer_id` (string): Dealer ID (from listing `dealer.id`)
  - Example: `"12345"` or `12345`

#### Required (Query)
- `api_key` (string): MarketCheck API key

### Response Structure (Inferred)

```json
{
  "dealer": {
    "id": "12345",
    "name": "ABC Auto Sales",
    "street": "123 Main St",
    "address": "123 Main St, Suite 100",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "latitude": 47.6062,
    "longitude": -122.3321,
    "phone": "206-555-1234",
    "phone_formatted": "(206) 555-1234",
    "website": "https://abcautosales.com",
    "email": "info@abcautosales.com",
    "hours": {
      "monday": "9:00 AM - 7:00 PM",
      "tuesday": "9:00 AM - 7:00 PM",
      "wednesday": "9:00 AM - 7:00 PM",
      "thursday": "9:00 AM - 7:00 PM",
      "friday": "9:00 AM - 7:00 PM",
      "saturday": "9:00 AM - 6:00 PM",
      "sunday": "Closed"
    },
    "rating": 4.5,
    "review_count": 127,
    "inventory_count": 150
  }
}
```

### Dealer Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string \| number | Dealer identifier |
| `name` | string | Dealer business name |
| `street` | string? | Street address |
| `address` | string? | Full formatted address |
| `city` | string? | City |
| `state` | string? | State abbreviation |
| `zip` | string? | ZIP code |
| `latitude` | number \| string? | Latitude coordinate |
| `longitude` | number \| string? | Longitude coordinate |
| `phone` | string? | Phone number (raw) |
| `phone_formatted` | string? | Formatted phone number |
| `website` | string? | Website URL |
| `email` | string? | Contact email |
| `hours` | object? | Business hours by day of week |
| `rating` | number? | Average rating (0-5) |
| `review_count` | number? | Number of reviews |
| `inventory_count` | number? | Current inventory count |

### Important Notes

- Endpoint path inferred from MarketCheck docs—confirm exact route and fields before implementation.
- Pull `dealer.id` from the search payload once verified.
- Coordinates may arrive as strings; parse defensively.
- Dealer metadata changes infrequently; cache aggressively after verification.

---

## General API Notes

### Authentication
- All endpoints require `api_key` as a query parameter
- API key should be stored as environment variable (`MARKETCHECK_API_KEY`)
- Never expose API key in client-side code

### Rate Limiting
- Not explicitly documented; implement conservative throttling
- Recommended: 100 requests/minute per API key
- Use exponential backoff for 429 (Too Many Requests) responses

### Error Handling
- Standard HTTP status codes (200, 400, 401, 404, 500, etc.)
- Error responses may include `error` or `message` fields
- Handle network timeouts (recommended: 2-5 second timeout)

### Caching Recommendations
- Search results: 5-15 minutes (depending on freshness requirements)
- Listing details: 1-5 minutes
- Media URLs: 24+ hours (URLs typically stable)
- Dealer metadata: 1-24 hours (changes infrequently)

### Base URL
- Production: `https://marketcheck-prod.apigee.net`
- May have staging/sandbox URLs for testing
- Store in environment variable (`MARKETCHECK_BASE_URL`)

---

## Integration Checklist

- [ ] Store API key in server-side environment variable
- [ ] Implement rate limiting/throttling
- [ ] Add request timeout handling (2-5 seconds)
- [ ] Handle pagination for search results
- [ ] Normalize response data to internal schema
- [ ] Cache responses appropriately
- [ ] Handle missing/optional fields gracefully
- [ ] Log API errors for debugging
- [ ] Implement retry logic with exponential backoff
- [ ] Validate required parameters before requests
- [ ] **Optional Enrichment**: Set `MARKETCHECK_ENRICH_LISTINGS=1` to enable detail enrichment (calls `/v2/listing/car/{id}`, `/v2/listing/car/{id}/media`, `/v2/listing/car/{id}/extra`, `/v2/dealer/{dealer_id}` endpoints). When enabled, the inventory sync pipeline will hydrate listings with additional photos, extended features, seller comments, and dealer metadata. Enrichment is best-effort and failures are logged but do not block sync.
