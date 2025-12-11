# Sync Inventory 500 Error - Fix Report

## Problem Summary

The "Sync Inventory" button is failing with 500 errors at multiple stages:

1. **MCP fetch-and-ingest endpoint** → 500
2. **Fallback: MarketCheck API fetch** → ✅ 200 (works - fetched 229 vehicles)
3. **UVS ingestion call** (`/api/ingest/marketcheck`) → ❌ 500 (FAILING)
4. **Analytics errors**: Missing `analytics_sessions` and `analytics_events` tables (PGRST205) - Noise, not blocking

## Root Cause Analysis

The ingestion endpoint (`/api/ingest/marketcheck`) requires **Supabase configuration** to store vehicles. Looking at the code:

### Required Environment Variables (Railway MCP Server):

1. **`SUPABASE_URL`** or **`NEXT_PUBLIC_SUPABASE_URL`** - Supabase project URL
2. **`SUPABASE_SERVICE_ROLE_KEY`** or **`SUPABASE_ANON_KEY`** - Supabase authentication key

The storage functions throw errors if these are missing:
- `storage.ts:28` - "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage"
- `storage.ts:35` - "Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY) must be set"

### Error Flow:

1. Dashboard calls `fetchAndIngestMarketCheckInventory()`
2. That calls MCP server `/api/ingest/marketcheck/fetch-and-ingest` → 500
3. Falls back to legacy sync
4. Legacy sync fetches from MarketCheck → ✅ 200 (229 vehicles)
5. Legacy sync calls MCP `/api/ingest/marketcheck` → ❌ 500
6. Error: Missing Supabase config or database connection issue

## Solution Steps

### Step 1: Test the Endpoint Directly

Use the diagnostic script to capture the actual error:

```bash
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

This will show:
- Health check status
- Fetch-and-ingest endpoint error
- **Direct ingestion endpoint error (the 500 we need to fix)**

### Step 2: Verify Railway Environment Variables

Check Railway MCP Server environment variables:

**Required:**
- ✅ `MARKETCHECK_API_KEY` - Should be set
- ✅ `INGESTION_API_TOKEN` - Should match Vercel token
- ⚠️ **`SUPABASE_URL`** - **CHECK IF SET**
- ⚠️ **`SUPABASE_SERVICE_ROLE_KEY`** - **CHECK IF SET**

**Optional but needed for ingestion:**
- `SUPABASE_ANON_KEY` - Alternative to service role key (limited functionality)

**To check:**
1. Go to Railway → MCP Server service
2. Variables tab
3. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

### Step 3: Set Missing Environment Variables

If missing, add to Railway:

```
SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Step 4: Verify Database Connection

Test that the MCP server can connect to Supabase:

```bash
# Test from Railway logs or via test script
# Should not see "Supabase key must be set" errors
```

### Step 5: Check Database Schema

Verify `uvs_vehicles` table exists in Supabase:
- Go to Supabase Dashboard → Table Editor
- Check for `uvs_vehicles` table
- If missing, run migration: `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

### Step 6: Silence Analytics Errors (Optional)

Analytics errors are noise - they don't block ingestion. To silence:

1. **Option A**: Create analytics tables (run migration)
   ```bash
   # Run: apps/dealer-dashboard/supabase/migrations/20250301_create_analytics_tables.sql
   ```

2. **Option B**: Make analytics tracking more resilient (already done - errors are caught)

## Enhanced Error Logging

I've enhanced the ingestion endpoint error logging to provide:
- Full stack traces
- Error context (vehicle count, options)
- Detailed error messages

The error response now includes:
```json
{
  "error": "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage",
  "details": "Error: SUPABASE_URL...\n    at getSupabaseClient...",
  "provider": "marketcheck"
}
```

## Testing After Fix

1. **Test direct endpoint:**
   ```bash
   ./scripts/test-sync-endpoint.sh 11042155 myrockhillgmc.com
   ```

2. **Test from dashboard:**
   - Go to `/app/setup`
   - Click "Sync Inventory"
   - Should see success message with vehicle count

3. **Verify logs:**
   - Check Railway logs for ingestion success
   - Should see: `ingestion_service_completed` with `stored: X`

## Expected Results

After fixing Supabase configuration:

✅ `/api/ingest/marketcheck` returns 200 with:
```json
{
  "success": true,
  "summary": {
    "fetched": 229,
    "valid": 200,
    "invalid": 29,
    "stored": 200
  }
}
```

✅ Dashboard sync completes successfully

✅ Vehicles appear in `/app/inventory`

## Next Steps

1. ✅ Enhanced error logging added
2. ⏳ Test endpoint directly to capture actual error
3. ⏳ Verify Railway env vars (Supabase config)
4. ⏳ Fix missing configuration
5. ⏳ Test end-to-end sync
6. ⏳ Silence analytics errors (optional)

## Files Modified

1. `apps/mcp-server/src/api/ingest.ts` - Enhanced error logging
2. `scripts/diagnose-mcp-ingestion-error.sh` - New diagnostic script
3. `SYNC_ERROR_FIX_REPORT.md` - This document

