# Investigate MCP Ingestion 500 Error - Action Plan

## Goal
Identify and fix the MCP ingestion 500 error by capturing Railway logs, testing the endpoint, and verifying UVS schema.

## Timeline
Error occurred around **16:39 UTC** (based on logs)

---

## Task 1: Pull Railway Logs Around 16:39 UTC

### Option A: Railway Dashboard (Easiest)

1. Go to https://railway.app
2. Navigate to your project → **MCP Server** service
3. Click **"Logs"** tab
4. Filter or scroll to logs around **16:39 UTC** (convert to your timezone)
5. Look for these endpoints:
   - `/api/ingest/marketcheck/fetch-and-ingest`
   - `/api/ingest/marketcheck`
6. Capture:
   - Full error messages
   - Stack traces
   - Any database connection errors
   - Schema-related errors

### Option B: Railway CLI

```bash
# Install Railway CLI if not installed
npm install -g @railway/cli

# Login
railway login

# Link to project
cd apps/mcp-server
railway link

# Get logs around 16:39 UTC
# Note: Railway CLI logs are time-filtered, you may need to use dashboard for historical logs
railway logs --service mcp-server --follow
```

### What to Look For in Logs

**Error patterns:**
- `ingestion_api_error` events
- `ingestion_service_failed` events
- Database connection errors
- Schema errors (missing tables/columns)
- Supabase client errors

**Key log entries:**
```
[event: 'ingestion_api_error']
[event: 'ingestion_service_failed']
[error: 'SUPABASE_URL...']
[error: 'relation "uvs_vehicles" does not exist']
```

---

## Task 2: Run Diagnostic Script

### Setup

```bash
cd /Users/mac/AutoAgent

# Set environment variables
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token-here>

# Run diagnostic script
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

### Expected Output

The script tests three endpoints:
1. **Health Check** - Should return 200
2. **Fetch-and-Ingest** - May return 500 (this is the failing one)
3. **Direct Ingestion** - May return 500 (this is also failing)

**Capture:**
- HTTP status codes for each endpoint
- Full response body for errors
- Any error messages

### Sample Error Response

If you see a 500 error, the response should look like:
```json
{
  "error": "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage",
  "details": "Error: SUPABASE_URL...\n    at getSupabaseClient...",
  "provider": "marketcheck"
}
```

---

## Task 3: Verify UVS Schema/Migrations

### Migration File Location

The UVS table migration is at:
- `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

### Verify in Supabase Dashboard

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Table Editor**
4. Check if `uvs_vehicles` table exists

### Verify via SQL Query

```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'uvs_vehicles'
);

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'uvs_vehicles'
ORDER BY ordinal_position;
```

### Required Tables

For ingestion to work, these tables must exist:
1. ✅ `uvs_vehicles` - Main vehicle storage table
   - Migration: `20250228_create_uvs_vehicles.sql`
   - Status: **CHECK IF EXISTS**

2. ✅ `dealerships` - For dealer references (if using FK constraints)
   - Migration: `20250223_create_dealerships.sql`

### Apply Missing Migrations

If `uvs_vehicles` table is missing:

1. **Via Supabase Dashboard:**
   - Go to SQL Editor
   - Copy contents of `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`
   - Run the SQL

2. **Via Migration Tool:**
   ```bash
   # If using Supabase CLI
   supabase db push
   ```

---

## Expected Findings

### Most Likely Issues

1. **Missing Supabase Environment Variables**
   - Error: `SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set`
   - Fix: Add to Railway env vars

2. **Missing Database Table**
   - Error: `relation "uvs_vehicles" does not exist`
   - Fix: Run migration `20250228_create_uvs_vehicles.sql`

3. **Database Connection Error**
   - Error: Connection timeout or auth failure
   - Fix: Verify Supabase service role key is correct

### Schema Verification Checklist

- [ ] `uvs_vehicles` table exists in Supabase
- [ ] Table has all required columns (see migration file)
- [ ] Table has proper indexes
- [ ] RLS policies are configured (if needed)

---

## Report Template

After investigation, report:

1. **Railway Logs:**
   ```
   [Paste error messages and stack traces from logs around 16:39 UTC]
   ```

2. **Diagnostic Script Output:**
   ```
   Status codes:
   - Health Check: XXX
   - Fetch-and-Ingest: XXX
   - Direct Ingestion: XXX
   
   Error response body:
   [Paste full error response]
   ```

3. **UVS Schema Status:**
   ```
   - uvs_vehicles table: [EXISTS / MISSING]
   - If missing, migration file: 20250228_create_uvs_vehicles.sql
   ```

---

## Next Steps After Investigation

1. **If Supabase env vars missing:**
   - Add to Railway
   - Redeploy MCP server

2. **If table missing:**
   - Run migration in Supabase
   - Verify table creation

3. **If connection error:**
   - Verify service role key
   - Check Supabase project status

4. **Test again:**
   - Run diagnostic script
   - Test dashboard sync
   - Verify vehicles are stored

---

## Files to Reference

1. **Migration File:**
   - `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

2. **Storage Code:**
   - `apps/mcp-server/src/ingestion/storage.ts` - Line 22-44 (getSupabaseClient)

3. **Ingestion Endpoint:**
   - `apps/mcp-server/src/api/ingest.ts` - Line 164-205 (POST /api/ingest/marketcheck)

4. **Diagnostic Script:**
   - `scripts/diagnose-mcp-ingestion-error.sh`

