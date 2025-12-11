# MCP Ingestion 500 Error - Investigation Summary

## Ready to Investigate

All investigation tools and documentation are prepared. Follow the steps below to identify the root cause.

---

## Quick Start

### 1. Railway Logs (16:39 UTC)

**Access:** Railway Dashboard → MCP Server → Logs tab

**Look for:**
- `/api/ingest/marketcheck` errors
- `/api/ingest/marketcheck/fetch-and-ingest` errors
- Stack traces and error messages

**Capture:** Full error messages and stack traces

### 2. Run Diagnostic Script

```bash
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Capture:** Status codes and full error response body

### 3. Verify UVS Schema

**Check Supabase Dashboard:**
- Table Editor → Look for `uvs_vehicles` table

**Or run SQL:**
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'uvs_vehicles'
);
```

**Migration file:** `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

---

## What We Know

✅ **Migration File Exists:**
- Location: `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`
- Creates `uvs_vehicles` table with full UVS schema
- Includes indexes and triggers

✅ **Enhanced Error Logging:**
- Error messages now include stack traces
- Detailed error context in responses

✅ **Diagnostic Script Ready:**
- Tests all three endpoints
- Captures full error responses

---

## Expected Root Causes

1. **Missing Supabase Env Vars** (Most Likely)
   - Error: `SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set`
   - Fix: Add to Railway env vars

2. **Missing Database Table**
   - Error: `relation "uvs_vehicles" does not exist`
   - Fix: Run migration

3. **Connection Error**
   - Error: Database connection timeout/auth failure
   - Fix: Verify service role key

---

## Next Actions

1. ⏳ Pull Railway logs (instructions in `INVESTIGATE_MCP_500_ERROR.md`)
2. ⏳ Run diagnostic script
3. ⏳ Verify UVS table exists
4. ⏳ Report findings
5. ⏳ Fix root cause
6. ⏳ Test and verify

---

## Documentation Files

- `INVESTIGATE_MCP_500_ERROR.md` - Complete investigation guide
- `MCP_500_ERROR_INVESTIGATION.md` - Detailed investigation report
- `scripts/diagnose-mcp-ingestion-error.sh` - Test script

---

**Ready to investigate!** Follow the steps above and report back with:
- Railway log errors/stack traces
- Diagnostic script output
- UVS schema verification status

