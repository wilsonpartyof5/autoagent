# Flutter Discover public API

Anonymous, unauthenticated listing search and detail for the Drevvy shopper app
(`apps/drevvy-app`). Host: the Next.js app served at `https://api.drevvy.com`
(Vercel project for `apps/drevvy-backend`).

These routes are **not** the existing key-gated inventory API. The mobile app
must **not** send `INVENTORY_SEARCH_API_KEY`, `x-api-key`, or a Bearer inventory
key. No dart-define secret is required. Shopper JWT is optional and unused: it
does not raise limits and does not unlock Market Intelligence or save.

Base path: `/api/public/discover`

| Route | Auth | Upstream |
| --- | --- | --- |
| `POST /api/public/discover/search` | none (IP + global rate limits) | MarketCheck `search_active_cars` |
| `GET /api/public/discover/listings/{id}` | none (IP + global rate limits) | MarketCheck listing shell only |
| `POST /api/query/chat-search` | **not** exposed here | — |

Ask / chat-search stays on the existing key-protected route. See [Ask / chat-search](#ask--chat-search-not-in-this-beta).

Protected routes that this contract does **not** open:

- `POST /api/inventory/search`, `GET /api/inventory/detail/{id}`, `POST /api/query/chat-search` — still require `INVENTORY_SEARCH_API_KEY`
- `POST /api/consumer/keys/market-save`, `GET|POST /api/consumer/saved-cars` — still require a shopper Supabase JWT
- `/api/dealer/*`, `/api/admin/*` — unchanged

## Headers

Request:

- `Content-Type: application/json` on POST
- No API key header
- No `Authorization` required

Every response includes:

| Header | Meaning |
| --- | --- |
| `RateLimit-Limit` | Max hits in the advertised IP window |
| `RateLimit-Remaining` | Hits left in that window |
| `RateLimit-Reset` | Unix seconds when the IP window resets |
| `RateLimit-Policy` | `ip;w=60, global;w=60, ip-day;w=86400, global-day;w=86400` |
| `Retry-After` | Seconds to wait (429 only) |
| `Access-Control-Allow-Origin` | `*` (Flutter web) |
| `Access-Control-Expose-Headers` | The rate-limit headers above |

`OPTIONS` is allowed for CORS preflight and does not consume a token.

## Limits

| Route | Per IP / 60s | Global / 60s | Per IP / day | Global / day |
| --- | --- | --- | --- | --- |
| Search | 20 | 120 | 200 | 4,000 |
| Detail | 40 | 240 | 400 | 8,000 |

Invalid requests still consume a token (abuse control). MarketCheck is not called until the request is valid and under limit.

Search cost caps (enforced before MarketCheck):

- `radius_miles` default 25, max 50
- `page_size` default 10, max 20
- `page` default 1, max 10
- Filters are allow-listed and `.strict()` (unknown keys → 400)
- Detail loads the **listing shell only** (no VIN decode, no history, no MarketCheck Price)

MarketCheck sales terms forbid caching inventory search and listing detail. These routes do not store those payloads. Simultaneous identical in-flight calls are coalesced by the existing MarketCheck client; that is not a cache.

## POST `/api/public/discover/search`

### Request

```json
{
  "latitude": 35.2271,
  "longitude": -80.8431,
  "radius_miles": 25,
  "page": 1,
  "page_size": 10,
  "filters": {
    "make": "Toyota",
    "model": "RAV4",
    "trim": "XLE",
    "year": 2021,
    "year_min": 2019,
    "year_max": 2024,
    "price_min": 15000,
    "price_max": 35000,
    "miles_max": 60000,
    "condition": "used",
    "body_type": "SUV"
  }
}
```

| Field | Rules |
| --- | --- |
| `latitude`, `longitude` | Required. Finite numbers. Lat `[-90, 90]`, lng `[-180, 180]`. `(0, 0)` is rejected. |
| `radius_miles` | Integer 5–50. Default 25. |
| `page` | Integer 1–10. Default 1. |
| `page_size` | Integer 1–20. Default 10. |
| `filters.make` / `model` / `trim` | Optional strings, length-capped, printable. |
| `filters.year` | Integer 1990–(current year + 1). Do not send with `year_min`/`year_max`. |
| `filters.year_min` / `year_max` | Same year range. `year_min` ≤ `year_max`. |
| `filters.price_min` / `price_max` | Integers 0–500000. `price_min` ≤ `price_max`. |
| `filters.miles_max` | Integer 0–400000. |
| `filters.condition` | `new` \| `used` \| `certified` |
| `filters.body_type` | One of: `Pickup`, `SUV`, `Sedan`, `Minivan`, `Cargo Van`, `Passenger Van`, `Coupe`, `Hatchback`, `Wagon`, `Convertible` |

Unknown fields, ZIP geocoding, filter arrays, and `bounds` are not accepted. Send device GPS (or a city centroid the app already has). ZIP → lat/lng is a later client concern.

### Success `200`

```json
{
  "success": true,
  "data": {
    "listings": [
      {
        "id": "ABC123",
        "vin": "4T1B11HK5JU123456",
        "price": 28990,
        "miles": 41200,
        "msrp": 32110,
        "inventory_type": "used",
        "dom_active": 12,
        "dist": 8.4,
        "build": {
          "year": 2021,
          "make": "Toyota",
          "model": "RAV4",
          "trim": "XLE",
          "body_type": "SUV"
        },
        "media": {
          "photo_links": ["https://images.marketcheck.com/example.jpg"]
        },
        "car_location": {
          "city": "Charlotte",
          "state": "NC",
          "latitude": 35.21,
          "longitude": -80.85
        },
        "colors": {
          "exterior_color": "White",
          "interior_color": "Black"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 42,
      "total_pages": 5,
      "has_next_page": true,
      "has_previous_page": false
    }
  }
}
```

`inventory_type` is `new`, `used`, or `cpo` (certified). `dist` is miles from the request lat/lng. Listings without a VIN or id are dropped. Empty `listings` with `success: true` means no matches — not an error, and not demo data.

Photo URLs never include `api_key`. Credentialed MarketCheck image hosts are rewritten to the existing public signed proxy `/api/inventory/photo`.

## GET `/api/public/discover/listings/{id}`

Path `{id}`: `[A-Za-z0-9_-]{4,64}`.

No `sections`, `vin`, or enrichment query params. The listing shell is enough for a VDP photo/price/spec card. Market Intelligence, rooftop match, dealer chat, and save are **not** on this route.

### Success `200`

Same listing object as search, plus optional `build` spec fields (`drivetrain`, `powertrain_type`, `engine`, `city_mpg`, `highway_mpg`, `seating_capacity`) and optional `extra.features` (capped, contact-scrubbed). `dist` is omitted (no search origin).

## Field allow-list

Returned keys only:

- listing: `id`, `vin`, `price`, `miles`, `msrp`, `inventory_type`, `dom_active`, `dist`, `build`, `media`, `car_location`, `colors`, `extra`
- `build`: `year`, `make`, `model`, `trim`, `body_type`, `drivetrain`, `powertrain_type`, `engine`, `city_mpg`, `highway_mpg`, `seating_capacity`
- `media`: `photo_links`
- `car_location`: `city`, `state`, `latitude`, `longitude`
- `colors`: `exterior_color`, `interior_color`
- `extra`: `features`

Never returned (not exhaustive): dealer name, phone, email, website, street, hours, rating, dealer id, salesperson, `vdp_url`, `stock_no`, Carfax flags, fees, rooftop / network match, seller comments, description, MarketCheck Price, VIN history, API keys.

Flutter `Listing.fromJson` already treats `dealer` as optional. Do not send `dealer`. A later wiring PR should keep `vin` required (this API omits VIN-less rows) and ignore unknown keys.

## Errors

Every error:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "latitude and longitude are required."
  }
}
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Not JSON, unknown fields, malformed body |
| 400 | `INVALID_LOCATION` | Missing/out-of-range/zero-island coordinates or radius |
| 400 | `INVALID_FILTERS` | Filter type, range, or `body_type` / `condition` |
| 400 | `INVALID_PAGINATION` | `page` or `page_size` out of range |
| 400 | `INVALID_ID` | Listing id does not match `[A-Za-z0-9_-]{4,64}` |
| 404 | `LISTING_NOT_FOUND` | Id is well-formed but MarketCheck has no listing |
| 429 | `RATE_LIMITED` | IP or global window exhausted |
| 502 | `UPSTREAM_ERROR` | MarketCheck failed, quota, or timeout. No demo fallback. |
| 503 | `RATE_LIMIT_UNAVAILABLE` | Durable limiter could not run and production refused to fail open |

Messages are safe to show in the app. They never include secrets or upstream payloads.

## Flutter wiring (later PR)

```dart
// No x-api-key. No Authorization. No dart-define inventory key.
final uri = Uri.parse('$apiBaseUrl/api/public/discover/search');
final response = await http.post(
  uri,
  headers: const {'Content-Type': 'application/json', 'Accept': 'application/json'},
  body: jsonEncode({
    'latitude': lat,
    'longitude': lng,
    'radius_miles': filters.radiusMi ?? 25,
    'page': 1,
    'page_size': 10,
    'filters': {
      if (filters.makes.isNotEmpty) 'make': filters.makes.first,
      if (filters.models.isNotEmpty) 'model': filters.models.first,
      if (filters.yearMin != null) 'year_min': filters.yearMin,
      if (filters.yearMax != null) 'year_max': filters.yearMax,
      if (filters.priceMax != null) 'price_max': filters.priceMax,
      if (filters.milesMax != null) 'miles_max': filters.milesMax,
      if (filters.condition != null) 'condition': filters.condition,
      if (filters.bodyTypes.isNotEmpty) 'body_type': filters.bodyTypes.first,
    },
  }),
);
```

On 429, wait `Retry-After` seconds (fallback: `RateLimit-Reset`). Map `data.listings` through `Listing.fromJson`. Do not call `/api/consumer/keys/market-save` or `/api/consumer/saved-cars` without a shopper session.

`DrevvyConfig.apiBaseUrl` already exists. Point it at the API origin. Do not add `INVENTORY_SEARCH_API_KEY` to dart-define.

## Ask / chat-search (not in this beta)

Anonymous Ask would need the AI Gateway (`AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN`), query parse, geocode, MarketCheck, and an assistant completion per message. Cost and prompt-injection exposure are much higher than a structured search POST. Bounding it safely means a separate, stricter quota, a token cap, and no tool-calling that can reach dealer or save routes.

This beta leaves Ask on `POST /api/query/chat-search` (shared key, iOS). Flutter Shop search uses the public Discover routes. A later signed-in Ask can use the shopper JWT plus per-user caps.

## Server env (names only)

The new routes read these **server** variables. None of them go in the app.

| Name | Role |
| --- | --- |
| `MARKETCHECK_API_KEY` | Upstream MarketCheck. Required for 200s. |
| `MARKETCHECK_MCP_URL` | Optional. Defaults to the hosted MCP URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Durable rate-limit store. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role writes to the rate-limit table. |
| `DREVVY_PUBLIC_ORIGIN` | Optional. Absolute origin for signed photo URLs. |

`INVENTORY_SEARCH_API_KEY` is **not** required and must not be placed in the Flutter app for these routes. `AI_GATEWAY_API_KEY` is unused here.

Preview: if `MARKETCHECK_API_KEY` is missing on the Preview environment, search/detail return `502 UPSTREAM_ERROR`. Do not copy production secrets into Preview from this change. If Supabase URL/service role are missing, the limiter falls back to process-local counts so a Preview smoke test can still run; that fallback is not multi-instance durable until `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present and migration `public_discover_rate_limits` is applied.
