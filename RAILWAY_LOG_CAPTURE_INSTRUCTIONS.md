# Railway Log Capture Instructions

## Railway CLI Authentication Required

Since Railway CLI requires interactive login, use one of these methods:

### Option A: Railway CLI (Manual Login)

```bash
# Login (opens browser)
npx @railway/cli login

# Verify access
npx @railway/cli whoami

# Link to project
cd apps/mcp-server
npx @railway/cli link

# Then tail logs
npx @railway/cli logs --service mcp-server --lines 2000
```

### Option B: Railway Dashboard (Easiest)

1. Go to https://railway.app
2. Navigate to: **Project → MCP Server service**
3. Click **"Logs" tab**
4. **Keep logs visible and ready**

---

## Step 1: Prepare to Capture Error

1. **Open Railway Dashboard logs** (or CLI logs if authenticated)
2. **Filter/Search for:**
   - `ingest`
   - `marketcheck`
   - `error`
   - `Unhandled`
   - `500`

3. **Note the current time** - we'll look for errors after this timestamp

---

## Step 2: Run Diagnostic Script (Triggers Error)

**Run this command NOW:**

```bash
cd /Users/mac/AutoAgent
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Record the exact timestamp** when you run this command.

---

## Step 3: Immediately Check Railway Logs

Right after running the script (within 5-10 seconds):

1. **Look at Railway logs** (Dashboard or CLI)
2. **Find errors** matching the timestamp you recorded
3. **Search for:**
   - `POST /api/ingest/marketcheck`
   - `POST /api/ingest/marketcheck/fetch-and-ingest`
   - `ingestion_api_error`
   - `ingestion_service_failed`
   - `Unhandled error`

---

## Step 4: Copy the Actual Error

**Copy these from Railway logs:**

1. **Timestamp:**
   ```
   [PASTE TIMESTAMP]
   ```

2. **Error message:**
   ```
   [PASTE ERROR MESSAGE]
   ```

3. **Full stack trace:**
   ```
   [PASTE COMPLETE STACK TRACE]
   ```

4. **Route/Endpoint:**
   ```
   POST /api/ingest/marketcheck/fetch-and-ingest
   OR
   POST /api/ingest/marketcheck
   ```

---

## Step 5: Add to Findings Document

**File:** `MCP_500_ERROR_FINDINGS.md`

**Section:** "Railway Logs - Actual Error"

Replace the placeholder with the actual error you copied.

---

## Expected Error Patterns

Look for one of these:

### Missing Supabase Config
```
Error: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage
    at getSupabaseClient (.../storage.ts:28:11)
```

### Missing Database Table
```
Error: relation "uvs_vehicles" does not exist
```

### Database Connection Error
```
Error: connect ECONNREFUSED
OR
Error: Invalid API key
```

---

**Ready to capture!** Open Railway logs, run the script, and paste the actual error.


