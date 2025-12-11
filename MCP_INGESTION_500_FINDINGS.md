# MCP Ingestion 500 Error - Investigation Findings

## Scope
**ONLY MCP Server ingestion** - No dashboard or other service changes.

---

## 1. Railway Logs Status

⏳ **REQUIRES MANUAL ACCESS**

**Access Instructions:**
- Go to Railway Dashboard → MCP Server service → Logs tab
- Filter/search for logs around **16:39 UTC**
- Look for: `ingestion_api_error`, `ingestion_service_failed` events

**What to Capture:**
- Full error message
- Stack trace
- Any database/schema errors

**Status:** Waiting for Railway log access to capture actual error.

---

## 2. Diagnostic Script

✅ **READY TO RUN**

**Command:**
```bash
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Expected Output:**
- Health Check: 200 (or error)
- Fetch-and-Ingest: 500 (expected) + error body
- Direct Ingestion: 500 (expected) + error body

**Status:** Script exists and is ready. Needs to be run to capture actual error.

---

## 3. UVS Schema Verification

✅ **Migration File Identified**

**File:** `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

**Creates:** `uvs_vehicles` table with:
- Primary key: `id` (text)
- Core fields: vin, year, make, model, condition, price
- Dealer info: dealer_id, dealer_name, location
- Full UVS document: `uvs_data` (jsonb)
- Indexes and triggers

⏳ **Table Status: UNKNOWN** (Requires Supabase Dashboard check)

**To Verify:**
1. Supabase Dashboard → Table Editor
2. Check if `uvs_vehicles` exists
3. Or run SQL:
   ```sql
   SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'uvs_vehicles'
   );
   ```

**If Missing:** Apply migration `20250228_create_uvs_vehicles.sql` in Supabase SQL Editor.

---

## 4. Code Changes Made

### File: `apps/mcp-server/src/api/ingest.ts`

**Change:** Enhanced error logging in fetch-and-ingest endpoint (lines 147-157)

**What Changed:**
- Added stack trace to logger.error()
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
const errorMessage = error instanceof Error ? error.message : String(error);
const errorStack = error instanceof Error ? error.stack : undefined;

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

**Reason:** Provides stack traces in logs and error responses for easier debugging.

---

## 5. Expected Root Causes

Based on code analysis, most likely errors:

### A. Missing Supabase Environment Variables
**Error:** `SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage`  
**Location:** `storage.ts:28`  
**Fix:** Add env vars to Railway

### B. Missing Database Table
**Error:** `relation "uvs_vehicles" does not exist`  
**Fix:** Apply migration `20250228_create_uvs_vehicles.sql`

### C. Database Connection Error
**Error:** Connection timeout or auth failure  
**Fix:** Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

---

## 6. Summary Report Template

After investigation, report:

### MCP Log Error/Stack
```
[Paste error from Railway logs around 16:39 UTC]
```

### Diagnostic Script Result
```
Status Codes:
- Health: XXX
- Fetch-and-Ingest: XXX
- Direct Ingestion: XXX

Error Body:
[Paste full JSON response]
```

### Schema Check Result
```
- uvs_vehicles table: [EXISTS / MISSING]
- Migration file: 20250228_create_uvs_vehicles.sql
- Needs application: [YES / NO]
```

### Code/Logging Changes
```
- Enhanced error logging in fetch-and-ingest endpoint
- Added stack traces to error responses
- File: apps/mcp-server/src/api/ingest.ts (lines 147-157)
```

### Migration Status
```
- Migration file exists: YES
- Table exists: [PENDING VERIFICATION]
- Needs application: [PENDING]
```

---

## Files Modified

1. ✅ `apps/mcp-server/src/api/ingest.ts` - Enhanced error logging only

**No other files modified** - Scope strictly limited to MCP ingestion.

---

**Status:** Investigation tools ready. Waiting for Railway logs and diagnostic script output to identify root cause.

