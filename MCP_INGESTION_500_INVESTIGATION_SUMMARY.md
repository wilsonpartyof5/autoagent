# MCP Ingestion 500 Error - Investigation Summary

## Scope
**ONLY MCP Server ingestion code** - No dashboard, manifest, or other service changes.

---

## Status

### 1. Railway Logs (16:39 UTC)
⏳ **Requires Manual Access**

**Action:** Check Railway Dashboard → MCP Server → Logs tab around 16:39 UTC

**Look for:**
- Events: `ingestion_api_error`, `ingestion_service_failed`
- Endpoints: `/api/ingest/marketcheck`, `/api/ingest/marketcheck/fetch-and-ingest`
- Errors: Database connection, missing env vars, schema errors

**Capture:** Full error messages and stack traces

---

### 2. Diagnostic Script
✅ **Ready to Run**

**Script:** `scripts/diagnose-mcp-ingestion-error.sh`

**Run:**
```bash
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Captures:**
- HTTP status codes
- Full error response JSON
- Stack traces in error details

---

### 3. UVS Schema Verification

✅ **Migration File Exists:**
- Path: `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`
- Creates: `uvs_vehicles` table with full UVS schema

⏳ **Table Verification Required:**

**Check in Supabase:**
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'uvs_vehicles'
);
```

**Status:** [PENDING - Check Supabase Dashboard]

---

## Code Changes Made

### File: `apps/mcp-server/src/api/ingest.ts`

**Change:** Enhanced error logging in fetch-and-ingest endpoint (lines 147-157)

**Improvement:**
- Added stack trace logging
- Added stack trace to error response (first 5 lines)
- Consistent error format with direct ingestion endpoint

**Before:**
```typescript
logger.error({
  event: 'marketcheck_fetch_ingest_error',
  error: error.message,
});
return res.status(500).json({
  error: error.message,
});
```

**After:**
```typescript
logger.error({
  event: 'marketcheck_fetch_ingest_error',
  error: errorMessage,
  stack: errorStack,
});
return res.status(500).json({
  error: errorMessage,
  details: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : undefined,
});
```

**Reason:** Provides consistent error logging and includes stack traces in responses for debugging.

---

## Files Modified

1. ✅ `apps/mcp-server/src/api/ingest.ts` - Enhanced error logging

**No other files modified** - Scope limited to ingestion endpoint only.

---

## Expected Root Causes

### 1. Missing Supabase Environment Variables (Most Likely)

**Error:**
```
SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage
```

**Location:** `storage.ts:28`

**Fix:** Add to Railway env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. Missing Database Table

**Error:**
```
relation "uvs_vehicles" does not exist
```

**Fix:** Apply migration:
- `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

### 3. Database Connection Error

**Error:** Connection timeout or authentication failure

**Fix:** Verify service role key is correct

---

## Next Steps

1. ⏳ **Check Railway logs** around 16:39 UTC for actual error
2. ⏳ **Run diagnostic script** to capture error response
3. ⏳ **Verify UVS table** exists in Supabase
4. ⏳ **Report findings:**
   - Railway log error/stack
   - Diagnostic script result (status + body)
   - Schema check result (exists/missing)
   - Whether migration needs to be applied

---

## Summary

- ✅ Enhanced error logging (stack traces)
- ✅ Diagnostic script ready
- ✅ UVS migration file identified
- ⏳ Railway logs (requires manual access)
- ⏳ Schema verification (requires Supabase check)
- ✅ Minimal code change applied (logging only)

**All investigation tools prepared. Run diagnostic script and check Railway logs to capture actual error.**

