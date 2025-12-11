# MCP Ingestion 500 Error - Investigation Report

## Summary

Investigation setup for identifying the root cause of the MCP ingestion 500 error. All tools and documentation are ready.

## Files Created

1. ✅ `INVESTIGATE_MCP_500_ERROR.md` - Complete investigation guide
2. ✅ `scripts/diagnose-mcp-ingestion-error.sh` - Diagnostic test script
3. ✅ Enhanced error logging in `apps/mcp-server/src/api/ingest.ts`

---

## Task 1: Railway Logs (16:39 UTC)

### How to Access Railway Logs

**Option A: Railway Dashboard (Recommended)**
1. Go to https://railway.app
2. Navigate to: Project → **MCP Server** service
3. Click **"Logs"** tab
4. Filter or scroll to **16:39 UTC** (or convert to your timezone)
5. Look for log entries containing:
   - `ingestion_api_error`
   - `ingestion_service_failed`
   - `/api/ingest/marketcheck`
   - `/api/ingest/marketcheck/fetch-and-ingest`

**What to Capture:**
- Full error messages
- Stack traces
- Database connection errors
- Schema errors (e.g., "relation uvs_vehicles does not exist")

### Expected Log Patterns

```
[timestamp] [event: 'ingestion_api_error']
  provider: 'marketcheck'
  error: 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage'
  stack: 'Error: ...\n    at getSupabaseClient...'
```

OR

```
[timestamp] [event: 'ingestion_service_failed']
  error: 'relation "uvs_vehicles" does not exist'
  stack: ...
```

---

## Task 2: Run Diagnostic Script

### Setup

```bash
cd /Users/mac/AutoAgent

# Set environment variables (replace <token> with actual token)
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>

# Run diagnostic script
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

### What the Script Tests

1. **Health Check** - `/mcp` endpoint
2. **Fetch-and-Ingest** - `/api/ingest/marketcheck/fetch-and-ingest` (end-to-end)
3. **Direct Ingestion** - `/api/ingest/marketcheck` (what dashboard calls)

### Expected Output

```
🔍 Diagnosing MCP Ingestion 500 Error
======================================

MCP Server URL: https://autoagentmcp-server-production.up.railway.app
Token: ***SET***

Test 1: MCP Server Health Check
-------------------------------
Status: 200

Test 2: Fetch-and-Ingest Endpoint
----------------------------------
Status: 500
❌ ERROR RESPONSE:
{
  "error": "...",
  "details": "...",
  "provider": "marketcheck"
}

Test 3: Direct Ingestion Endpoint (/api/ingest/marketcheck)
-----------------------------------------------------------
Status: 500
❌ ERROR RESPONSE (This is the 500 we need to fix):
{
  "error": "...",
  "details": "...",
  "provider": "marketcheck"
}
```

### Capture These Details

- HTTP status codes for each endpoint
- Full error response body (JSON)
- Any stack traces in error details

---

## Task 3: Verify UVS Schema

### Migration File Location

✅ **Migration exists:** `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

### Verify Table Exists in Supabase

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Table Editor**
4. Check if `uvs_vehicles` table exists

**Option B: SQL Query**

Run in Supabase SQL Editor:

```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'uvs_vehicles'
);

-- If table exists, check structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'uvs_vehicles'
ORDER BY ordinal_position;
```

### Required Table Structure

The `uvs_vehicles` table should have these key columns:
- `id` (text, primary key)
- `vin` (text, nullable)
- `year` (integer, not null)
- `make` (text, not null)
- `model` (text, not null)
- `condition` (text, not null)
- `price` (numeric, not null)
- `dealer_name` (text, not null)
- `last_synced_at` (timestamptz, not null)
- `uvs_data` (jsonb, not null) - Full UVS document
- Plus indexes and triggers

### Apply Migration If Missing

If the table doesn't exist, run the migration:

1. **Via Supabase Dashboard:**
   - Go to SQL Editor
   - Copy contents of: `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`
   - Paste and execute

2. **Via Supabase CLI:**
   ```bash
   cd apps/dealer-dashboard
   supabase db push
   ```

---

## Expected Findings

### Most Likely Root Causes

1. **Missing Supabase Environment Variables** (Most Likely)
   - Error: `SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage`
   - Location: `storage.ts:28`
   - Fix: Add env vars to Railway

2. **Missing Database Table**
   - Error: `relation "uvs_vehicles" does not exist`
   - Fix: Run migration `20250228_create_uvs_vehicles.sql`

3. **Database Connection Error**
   - Error: Connection timeout or authentication failure
   - Fix: Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

4. **Schema Mismatch**
   - Error: Column doesn't exist or wrong type
   - Fix: Check migration matches expected schema

---

## Report Template

After completing the investigation, report:

### 1. Railway Logs (16:39 UTC)

```
[Paste error messages and stack traces from logs]

Example:
[2025-12-05 16:39:23.456] [event: 'ingestion_api_error']
  provider: 'marketcheck'
  error: 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage'
  stack: 'Error: SUPABASE_URL...\n    at getSupabaseClient (storage.ts:28:11)'
```

### 2. Diagnostic Script Output

```
Status Codes:
- Health Check: 200
- Fetch-and-Ingest: 500
- Direct Ingestion: 500

Error Response Body:
{
  "error": "...",
  "details": "...",
  "provider": "marketcheck"
}
```

### 3. UVS Schema Status

```
- uvs_vehicles table: [EXISTS / MISSING]
- Migration file: apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql
- If missing: [APPLIED / NOT APPLIED]
```

---

## Next Steps

1. ✅ Investigation tools ready
2. ⏳ **Pull Railway logs** around 16:39 UTC
3. ⏳ **Run diagnostic script** to capture error
4. ⏳ **Verify UVS schema** exists in Supabase
5. ⏳ **Report findings** with stack traces and error details
6. ⏳ **Fix root cause** based on findings
7. ⏳ **Test again** to verify fix

---

## Files Reference

- **Migration:** `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`
- **Storage Code:** `apps/mcp-server/src/ingestion/storage.ts`
- **Ingestion Endpoint:** `apps/mcp-server/src/api/ingest.ts`
- **Diagnostic Script:** `scripts/diagnose-mcp-ingestion-error.sh`
- **Investigation Guide:** `INVESTIGATE_MCP_500_ERROR.md`

