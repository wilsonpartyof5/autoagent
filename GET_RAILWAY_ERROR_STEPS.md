# Get Railway Error - Step by Step

## Ready to Capture Actual Error

All tools are prepared. Follow these steps to get the actual error from Railway logs:

---

## Step 1: Open Railway Dashboard Logs

1. Go to: **https://railway.app**
2. Navigate to: **Project → MCP Server service**
3. Click: **"Logs" tab**
4. **Filter/Search for:**
   - `ingest`
   - `marketcheck`
   - `error`
   - `Unhandled`

**Keep the logs tab open and visible!**

---

## Step 2: Run Diagnostic Script (This Will Trigger the Error)

**Note the exact time** before running this:

```bash
cd /Users/mac/AutoAgent
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Record the timestamp** when you run this command.

---

## Step 3: Immediately Check Railway Logs

Right after running the script (within seconds):

1. **Look at Railway logs** you have open
2. **Search for errors** around the time you ran the script
3. **Look for:**
   - `POST /api/ingest/marketcheck`
   - `POST /api/ingest/marketcheck/fetch-and-ingest`
   - `ingestion_api_error`
   - `ingestion_service_failed`
   - `Unhandled error`

---

## Step 4: Copy the ACTUAL Error

**Copy these from Railway logs:**

1. **Full error message:**
   ```
   [PASTE ERROR MESSAGE]
   ```

2. **Complete stack trace:**
   ```
   [PASTE FULL STACK TRACE]
   ```

3. **Timestamp:**
   ```
   [PASTE TIMESTAMP]
   ```

4. **Any related log entries:**
   ```
   [PASTE ANY ADDITIONAL CONTEXT]
   ```

---

## Step 5: Add to Findings Document

**File:** `MCP_500_ERROR_FINDINGS.md`

**Section:** "Railway Logs - Actual Error"

Replace the placeholder:
```
[PASTE ACTUAL RAILWAY LOG ERROR HERE - NO GUESSES, ONLY REAL LOG CONTENT]
```

With the actual error you copied from Railway logs.

---

## What the Error Will Look Like

Based on code analysis, you should see one of these:

### Option 1: Missing Supabase Config
```
Error: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage
    at getSupabaseClient (storage.ts:28:11)
    at storeIngestedVehicles (...)
```

### Option 2: Missing Database Table
```
Error: relation "uvs_vehicles" does not exist
```

### Option 3: Database Connection Error
```
Error: connect ECONNREFUSED ...
OR
Error: Invalid API key
```

---

## Quick Command Reference

**Run this to trigger the error:**
```bash
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Then immediately check Railway Dashboard logs and copy the error!**

---

**Ready!** Open Railway logs, run the script, and paste the actual error to `MCP_500_ERROR_FINDINGS.md`.

