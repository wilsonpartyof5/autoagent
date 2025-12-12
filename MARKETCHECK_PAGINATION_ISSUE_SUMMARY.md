# MarketCheck Pagination Issue - Summary for Next Session

## Problem Statement
Only **10 vehicles** are being imported to the dealer dashboard, but MarketCheck reports **232 vehicles** available for the dealer (`myrockhillgmc.com`, dealerId: `11042155`).

## What We've Done So Far

### 1. Initial Investigation
- **Confirmed the issue**: Dashboard "Re-sync Inventory" button only imports 10 vehicles
- **Verified the flow works**: Dashboard → Vercel API → Railway MCP Server → MarketCheck API → Database
- **Confirmed UVS validation is NOT the problem**: All 10 vehicles pass validation (`valid: 10, invalid: 0`)

### 2. Root Cause Identified
- MarketCheck API only returns **first page (10 listings)** by default
- Our code was not paginating through all pages
- MarketCheck reports `num_found: 232` but only returns 10 listings per page

### 3. Pagination Implementation
**File Modified**: `apps/mcp-server/src/api/ingest.ts`

**Changes Made**:
- Added auto-pagination loop to fetch all pages from MarketCheck
- Implemented duplicate detection using vehicle IDs/VINs
- Added safety limits: `maxPages = 50`, `maxVehicles = 5000`
- Added logging for each page fetch

**Key Logic** (lines 123-198):
```typescript
while (pagesFetched < maxPages && allVehicles.length < maxVehicles) {
  // Fetch page
  // Track unique vehicles
  // Stop if no new vehicles found (duplicate detection)
  // Stop if we've fetched all vehicles (num_found reached)
}
```

### 4. Deployment
- **Committed**: `mcp: paginate MarketCheck fetch-and-ingest` (commit `e425d29`)
- **Pushed to `origin/main`**: Triggers Railway (Dockerfile) and Vercel auto-deploys

## Current Issue

### The Problem
After deployment, pagination is **stopping too early**. Railway logs show:

```
No new vehicles were discovered on this page; stopping pagination
```

**Result**: Still only 10 vehicles imported (same as before)

### Why It's Failing
The pagination logic stops when `newOnThisPage === 0` (line 184 in `ingest.ts`). This happens because:

1. **MarketCheck API pagination issue**: The `page` parameter might not be working correctly, OR
2. **MarketCheck is returning duplicates**: Page 2 returns the same 10 vehicles as page 1, OR
3. **Wrong pagination parameters**: MarketCheck might use `start`/`rows` instead of `page`/`pageSize`

### Current Code Behavior
- **Page 1**: Fetches 10 vehicles, all unique → `newOnThisPage = 10` ✅
- **Page 2**: Fetches 10 vehicles, but all are duplicates (already in `seenIds`) → `newOnThisPage = 0` ❌
- **Result**: Loop breaks immediately after page 1

## Next Steps to Fix

### 1. Investigate MarketCheck API Pagination
- Check MarketCheck API documentation for correct pagination parameters
- Verify if they use `start`/`rows` instead of `page`/`pageSize`
- Check if the `/v2/car/dealer/inventory/active` endpoint supports pagination differently

### 2. Debug the Pagination
- Add more detailed logging to see what MarketCheck returns on page 2
- Log the actual vehicle IDs/VINs from each page
- Verify if MarketCheck is actually returning different vehicles or the same ones

### 3. Potential Fixes
- **Option A**: Use `start` and `rows` parameters instead of `page` and `pageSize`
- **Option B**: Check if MarketCheck requires a different endpoint for pagination
- **Option C**: Adjust duplicate detection logic (maybe using a different unique identifier)

## Key Files

1. **`apps/mcp-server/src/api/ingest.ts`** (lines 46-268)
   - Main endpoint: `POST /api/ingest/marketcheck/fetch-and-ingest`
   - Contains pagination logic (lines 123-198)

2. **`apps/dealer-dashboard/src/app/app/setup/actions.ts`**
   - Frontend function: `fetchAndIngestMarketCheckInventory`
   - Calls Railway MCP endpoint

3. **`apps/dealer-dashboard/src/components/dashboard/inventory/resync-button.tsx`**
   - UI component with "Re-sync Inventory" button

## Test Results

### Vercel Logs (from CSV)
```
[fetchAndIngestMarketCheckInventory] Fetch and ingest complete: {
  dealerId: '11042155',
  source: 'myrockhillgmc.com',
  fetched: 10,
  stored: 10,
  valid: 10,
  invalid: 0
}
```

### Railway Logs
```
No new vehicles were discovered on this page; stopping pagination
{"level":30,"event":"ingestion_completed","total":10,"valid":10,"invalid":0}
```

## MarketCheck API Details

- **Endpoint**: `/v2/car/dealer/inventory/active`
- **Base URL**: `https://mc-api.marketcheck.com`
- **Parameters Used**:
  - `api_key`: (from env)
  - `source`: `myrockhillgmc.com`
  - `page`: 1, 2, 3, ...
  - `pageSize`: 100

- **Expected Response**:
  - `num_found`: 232 (total available)
  - `listings`: Array of vehicles (10 per page)

## Questions to Answer

1. Does MarketCheck `/v2/car/dealer/inventory/active` support `page`/`pageSize` parameters?
2. Should we use `start`/`rows` instead?
3. Is MarketCheck actually returning different vehicles on page 2, or the same ones?
4. Do we need to use a different MarketCheck endpoint for full inventory?

## Related Documentation

- Check `docs/05-MARKETCHECK-INTEGRATION.md` for API details
- Check `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` for dealer-specific notes

