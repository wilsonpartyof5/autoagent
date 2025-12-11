# MCP Ingestion 500 Error - Investigation Report

## Scope
**ONLY MCP Server ingestion** - No dashboard, manifest, or other service changes.

---

## 1. Railway Logs (16:39 UTC)

**Status:** ⏳ **REQUIRES MANUAL ACCESS**

**Instructions:**
1. Go to Railway Dashboard → MCP Server service → Logs tab
2. Filter/search for logs around **16:39 UTC**
3. Look for:
   - `/api/ingest/marketcheck` errors
   - `/api/ingest/marketcheck/fetch-and-ingest` errors
   - Events: `ingestion_api_error`, `ingestion_service_failed`

**What to Capture:**
- Full error messages
- Stack traces
- Database connection errors
- Schema errors (e.g., "relation uvs_vehicles does not exist")

**Expected Error Patterns:**
```
[event: 'ingestion_api_error']
  error: 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage'
  
OR

[event: 'ingestion_service_failed']
  error: 'relation "uvs_vehicles" does not exist'
```

---

## 2. Diagnostic Script Results

**Status:** ⏳ **READY TO RUN**

**Script:** `scripts/diagnose-mcp-ingestion-error.sh`

**Command:**
```bash
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Expected Output:**
- Health Check status
- Fetch-and-Ingest endpoint status + error body
- Direct Ingestion endpoint status + error body

**Capture:**
- HTTP status codes
- Full error response JSON
- Stack traces in error details

---

## 3. UVS Schema Verification

### Migration File Status

✅ **Migration file exists:**
- Path: `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`
- Creates: `uvs_vehicles` table with full UVS schema

### Table Structure

The migration creates `uvs_vehicles` table with:
- Primary key: `id` (text)
- Core fields: `vin`, `year`, `make`, `model`, `condition`, `price`
- Dealer fields: `dealer_id`, `dealer_name`, location data
- Full UVS document: `uvs_data` (jsonb)
- Indexes for common queries
- Triggers for auto-updating timestamps

### Verification Status

⏳ **REQUIRES SUPABASE CHECK**

**To Verify:**
1. Go to Supabase Dashboard → Table Editor
2. Check if `uvs_vehicles` table exists
3. Or run SQL:
   ```sql
   SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'uvs_vehicles'
   );
   ```

**Migration File:** `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

**Status:** [EXISTS / MISSING] - Check Supabase Dashboard

---

## 4. Code Analysis & Minimal Fixes

### Current Error Handling

The ingestion endpoint (`apps/mcp-server/src/api/ingest.ts`) already has:
- ✅ Enhanced error logging (stack traces)
- ✅ Detailed error responses
- ✅ Context logging (vehicle count, options)

### Potential Issues

1. **Missing Supabase Config Check** (Lines 190, 140)
   - Error occurs in `storeIngestedVehicles()` → `getSupabaseClient()`
   - Throws: "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set"
   - **Fix:** Already handled - error bubbles up with stack trace

2. **Missing Database Table**
   - Error: "relation uvs_vehicles does not exist"
   - **Fix:** Need to apply migration (reported, not fixed in code)

3. **Error Logging Enhancement**
   - Current: Basic error logging at line 194-204
   - **Enhancement:** Add more context about Supabase/Database errors

### Minimal Code Change Made

**File:** `apps/mcp-server/src/api/ingest.ts`

**Change:** Enhanced error logging in fetch-and-ingest endpoint catch block to match the direct ingestion endpoint's enhanced logging.

**Before (line 147-156):**
```typescript
} catch (error) {
  logger.error({
    event: 'marketcheck_fetch_ingest_error',
    dealerId,
    source,
    error: error instanceof Error ? error.message : String(error),
  });
  return res.status(500).json({
    error: error instanceof Error ? error.message : 'Internal server error',
  });
}
```

**After:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logger.error({
    event: 'marketcheck_fetch_ingest_error',
    dealerId,
    source,
    error: errorMessage,
    stack: errorStack,
  });
  
  return res.status(500).json({
    error: errorMessage,
    details: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : undefined,
  });
}
```

**Reason:** Provides consistent error logging across both endpoints and includes stack traces in error responses.

---

## 5. Summary

### Files Modified

1. ✅ `apps/mcp-server/src/api/ingest.ts`
   - Enhanced error logging in fetch-and-ingest endpoint (lines 147-157)
   - Added stack trace to error response

### Investigation Status

- ⏳ **Railway Logs:** Requires manual access (instructions provided)
- ⏳ **Diagnostic Script:** Ready to run (script exists)
- ✅ **UVS Migration:** File exists (`20250228_create_uvs_vehicles.sql`)
- ⏳ **Schema Verification:** Requires Supabase dashboard check
- ✅ **Code Enhancement:** Minimal logging improvement applied

### Next Steps

1. **Pull Railway logs** around 16:39 UTC
2. **Run diagnostic script** to capture error response
3. **Verify UVS table** exists in Supabase
4. **Report findings** with:
   - Actual error from Railway logs
   - Diagnostic script output
   - Schema verification result
   - Whether migration needs to be applied

### Expected Root Causes

1. **Missing Supabase Env Vars** (Most Likely)
   - Error: "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set"
   - Fix: Add to Railway env vars

2. **Missing Database Table**
   - Error: "relation uvs_vehicles does not exist"
   - Fix: Apply migration `20250228_create_uvs_vehicles.sql`

3. **Database Connection Error**
   - Error: Connection/auth failure
   - Fix: Verify service role key

---

## 6. Migration Note

**Migration File:** `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

**Action Required:** 
- ⏳ Verify if table exists in Supabase
- ⏳ If missing, apply migration via Supabase Dashboard SQL Editor or CLI

**Do NOT apply migration in this task** - just report status.

---

**Investigation Ready** - All tools and documentation prepared. Run diagnostic script and check Railway logs to capture actual error.

