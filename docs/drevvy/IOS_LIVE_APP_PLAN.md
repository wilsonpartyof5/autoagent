# iOS Live App Plan (Staging + Production)

## Purpose
Establish a production-ready path for the Autogentic iOS app to use live inventory at scale without modifying the MCP server (reserved for ChatGPT tooling).

## Scope
- iOS app uses a dedicated Inventory Search API.
- Inventory is stored in Supabase (UVS schema).
- Ingestion and sync jobs run in Railway.
- MCP is not used for the iOS app data plane.

## Why This Approach
- Scales to 1M+ vehicles with bounding-box queries and indexing.
- Clean separation between app data plane (API) and ChatGPT tooling (MCP).
- Supports staging + production with minimal friction.

## Environments
### Staging
- Vercel (API + dashboard)
- Supabase (staging database)
- Railway (staging ingestion jobs)

### Production
- Vercel (API + dashboard)
- Supabase (production database)
- Railway (production ingestion jobs)

## Data Flow (Live Inventory)
1) MarketCheck -> Railway ingestion
2) Normalize into UVS -> Supabase (uvs_vehicles)
3) Vercel API -> Supabase queries (bounds + filters)
4) iOS app -> Vercel API (map + cards)

## Stage Plan
### Stage 0 (Discovery) - Complete
- Confirmed UVS storage in Supabase
- Confirmed lat/lng fields: dealer_latitude, dealer_longitude
- Confirmed no public inventory search API exists

### Stage 1 (API Contract + Environment Plan) - Approved
- Build Inventory Search API for iOS app
- Add staging + production environments

### Stage 2 (API Implementation) - Complete
- Create `POST /api/inventory/search`
- Support bounds + filters + pagination
- Return minimal fields for map + cards
 - Live API returns 8 vehicles per request by default

### Stage 3 (Helper + Tests) - Pending
- Add bounds helper in `uvs-vehicles.ts`
- Provide curl/test script for verification

### Stage 4 (Scale Prep) - Pending
- Provide index recommendations
- Add caching and pagination defaults

## iOS Wiring Updates (Current)
- Input bar restored to root ZStack (global, outside chat scroll)
- API error decoding now matches `{ code, message }`
- Embedded vehicle cards show 8 results (from API limit)
- Live API integration uses Info.plist key: `INVENTORY_SEARCH_API_KEY`

## Query Parsing Integration (In Progress)
### Stage 1 (Query Parsing API) - ✅ Complete
- Created `POST /api/query/parse` endpoint
- OpenAI integration with structured outputs
- Validates and normalizes filters

### Stage 2 (iOS Integration) - ✅ Complete
- Added query parse models and service
- Integrated into ChatViewModel.send()
- Merges parsed filters into inventory search

### Stage 3 (UX + Fallbacks) - ✅ Complete
- Loading state (`isSearching`) with "Searching..." indicator
- No results state ("No matches found, try broadening filters")
- Improved parse failure fallback (keyword filtering preserved)
- Loading and no-results overlays in MapToolView

## Next UX/Data Enhancements
- Images in vehicle cards (primary photo URL)
- User-visible error state for API failures (vs. console logging only)

## Non-Goals
- No changes to MCP
- No direct Supabase calls from iOS
- No AI/LLM logic in this stage

## Open Questions
- API auth method for mobile app (API key vs JWT) — using API key for now
- Filter set for v1 (price, make/model, condition, color) — v1 supports core filters; LLM parsing TBD
- Map bounds precision and pagination defaults — default limit is 8 for mobile
