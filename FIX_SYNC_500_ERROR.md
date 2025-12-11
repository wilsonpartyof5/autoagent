# Fix Sync Inventory 500 Error - Action Plan

## Problem Summary

**Main Issue:** `/api/ingest/marketcheck` endpoint returns 500 error  
**Secondary Issue:** Analytics errors (PGRST205) - noise, not blocking

## Root Cause

The UVS ingestion endpoint requires **Supabase configuration** to store vehicles in the database. The error occurs in `storage.ts` when Supabase credentials are missing.

## Quick Fix Steps

### 1. Verify Railway Environment Variables

Go to Railway → MCP Server service → Variables tab

**Required for ingestion:**
- ✅ `MARKETCHECK_API_KEY` 
- ✅ `INGESTION_API_TOKEN` 
- ❌ **`SUPABASE_URL`** - **CHECK IF MISSING**
- ❌ **`SUPABASE_SERVICE_ROLE_KEY`** - **CHECK IF MISSING**

### 2. Add Missing Supabase Config to Railway

If missing, add:

```
SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Get service role key from: Supabase Dashboard → Settings → API → service_role key

### 3. Test the Fix

```bash
# Test endpoint directly
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

Should see:
- ✅ Direct Ingestion: 200 (not 500)

### 4. Test Dashboard Sync

1. Go to dashboard → `/app/setup`
2. Click "Sync Inventory"
3. Should complete successfully

## Enhanced Error Logging

Error messages now include:
- Full stack traces
- Error context
- Detailed messages

Check Railway logs for errors like:
```
SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage
```

## Analytics Errors (Optional Fix)

Analytics errors (PGRST205) are noise - tracking code already handles them gracefully. To silence:

**Option 1:** Run analytics migration (creates tables)
```sql
-- Run: apps/dealer-dashboard/supabase/migrations/20250301_create_analytics_tables.sql
```

**Option 2:** Ignore them (they don't block ingestion)

## Files Changed

1. ✅ `apps/mcp-server/src/api/ingest.ts` - Enhanced error logging
2. ✅ `scripts/diagnose-mcp-ingestion-error.sh` - Diagnostic script
3. ✅ `SYNC_ERROR_FIX_REPORT.md` - Detailed analysis
4. ✅ `FIX_SYNC_500_ERROR.md` - This quick reference

## Next Actions

1. ✅ Enhanced error logging
2. ⏳ **Check Railway env vars** (most likely fix needed)
3. ⏳ Add Supabase config if missing
4. ⏳ Test endpoint directly
5. ⏳ Verify dashboard sync works
6. ⏳ Optional: Fix analytics errors

## Expected Error Message

If Supabase is missing, you'll see:
```
"SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage"
```

This confirms the root cause - add the env vars above and redeploy.

