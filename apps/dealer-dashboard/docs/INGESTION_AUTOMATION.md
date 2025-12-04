# MarketCheck Ingestion Automation

This document describes the automated ingestion flow for MarketCheck inventory sync.

## Overview

The ingestion system uses the MCP server's `/api/ingest/marketcheck/fetch-and-ingest` endpoint, which handles both fetching from MarketCheck and ingesting into UVS in a single call.

## Server Action

**File:** `apps/dealer-dashboard/src/app/app/setup/actions.ts`

**Function:** `fetchAndIngestMarketCheckInventory`

This server action:
- Calls the MCP server endpoint `POST /api/ingest/marketcheck/fetch-and-ingest`
- Sends dealerId, source (optional), zip, radiusMiles, condition
- Returns ingestion summary (fetched, stored, valid, invalid)
- Updates dealership sync status in the database

**Usage:**
```typescript
const result = await fetchAndIngestMarketCheckInventory({
  dealerId: '11042155',
  source: 'myrockhillgmc.com', // optional
  zip: '29730', // optional
  radiusMiles: 50, // optional, default 50
  condition: 'all', // optional, 'all' | 'new' | 'used'
});
```

## Onboarding Trigger

When a dealer completes onboarding, the `syncMarketCheckInventory` function automatically uses the new `fetch-and-ingest` endpoint. The UI component at `apps/dealer-dashboard/src/components/dashboard/setup/inventory-sync.tsx` calls this function when the user clicks "Sync MarketCheck Inventory".

**Flow:**
1. User enters dealer ID and clicks sync
2. `syncMarketCheckInventory` is called
3. It calls `fetchAndIngestMarketCheckInventory` (new automated flow)
4. If that fails, it falls back to legacy sync for backward compatibility
5. UI displays success/error message with import count

## Nightly Refresh

**Endpoint:** `POST /api/ingest/nightly`

**File:** `apps/dealer-dashboard/src/app/api/ingest/nightly/route.ts`

This endpoint:
- Iterates all active dealerships with MarketCheck dealer IDs
- Calls `fetchAndIngestMarketCheckInventory` for each
- Logs results and returns summary

**Authentication:**
- Requires `Authorization: Bearer <INGESTION_API_TOKEN>` header, OR
- Requires `X-Cron-Secret: <INGESTION_API_TOKEN>` header (for Vercel cron)

### Setting Up Vercel Cron

Add to `vercel.json` in the dealer-dashboard app:

```json
{
  "crons": [
    {
      "path": "/api/ingest/nightly",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs daily at 2 AM UTC. To customize:
- `0 2 * * *` = Daily at 2 AM UTC
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Weekly on Sunday at midnight

**Environment Variable:**
Set `INGESTION_API_TOKEN` in Vercel environment variables. The cron job will automatically include this as the `X-Cron-Secret` header.

### Setting Up Railway Cron

Use Railway's cron job feature to POST to the endpoint:

```bash
curl -X POST https://your-domain.com/api/ingest/nightly \
  -H "Authorization: Bearer $INGESTION_API_TOKEN"
```

Or use Railway's scheduled tasks with a script that calls the endpoint.

### Manual Trigger

```bash
curl -X POST https://your-domain.com/api/ingest/nightly \
  -H "Authorization: Bearer <INGESTION_API_TOKEN>"
```

## Required Environment Variables

All environment variables must be set in Railway (for MCP server) and Vercel (for dealer dashboard):

### MCP Server (Railway)

- `MARKETCHECK_API_KEY` - MarketCheck API key (required)
- `INGESTION_API_TOKEN` - Token for authenticating ingestion API requests (optional but recommended)
- `MCP_SERVER_URL` or `INGESTION_SERVICE_URL` - Not needed (server knows its own URL)

### Dealer Dashboard (Vercel)

- `MCP_SERVER_URL` or `INGESTION_SERVICE_URL` - URL of the MCP server (e.g., `https://autoagentmcp-server-production.up.railway.app`)
- `INGESTION_API_TOKEN` or `MCP_SERVER_TOKEN` - Token for authenticating with MCP server (must match MCP server's `INGESTION_API_TOKEN`)
- `MARKETCHECK_API_KEY` - Not needed (MCP server handles MarketCheck API calls)

**Note:** `DASHBOARD_INGEST_TOKEN` is NOT needed for this flow. It's only used for lead ingestion.

## Response Format

### fetchAndIngestMarketCheckInventory

```typescript
{
  success: true,
  fetched: number,      // Vehicles fetched from MarketCheck
  imported: number,     // Vehicles stored in UVS
  valid: number,        // Valid vehicles
  invalid: number,      // Invalid vehicles
  summary: {            // Full ingestion summary
    stored: number,
    updated: number,
    valid: number,
    invalid: number,
    // ... other fields
  }
}
```

### Nightly Refresh Endpoint

```json
{
  "ok": true,
  "message": "Nightly refresh complete: 5 succeeded, 0 failed",
  "processed": 5,
  "succeeded": 5,
  "failed": 0,
  "totalImported": 1234,
  "results": [
    {
      "dealershipId": "uuid",
      "dealershipName": "Rock Hill GMC",
      "dealerId": "11042155",
      "success": true,
      "fetched": 226,
      "imported": 226,
      "valid": 226,
      "invalid": 0
    }
  ],
  "errors": [] // Only present if there are errors
}
```

## Error Handling

- If `fetch-and-ingest` fails, `syncMarketCheckInventory` falls back to legacy sync
- Nightly refresh continues processing other dealerships even if one fails
- All errors are logged with context (dealership ID, dealer ID, error message)

## Monitoring

Check logs for:
- `[fetchAndIngestMarketCheckInventory]` - Individual sync operations
- `[nightly-ingest]` - Nightly refresh operations

Success indicators:
- `✅ Successfully synced` - Individual dealership sync succeeded
- `Nightly refresh complete` - All dealerships processed

