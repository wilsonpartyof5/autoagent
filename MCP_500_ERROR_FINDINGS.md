# MCP Ingestion 500 Error - Investigation Findings

## Diagnostic Script Results

**Date:** 2025-12-05  
**Script:** `scripts/diagnose-mcp-ingestion-error.sh`

### Results

#### 1. Health Check (`/mcp`)
- **Status:** `405` (Method Not Allowed)
- **Note:** Expected - endpoint requires POST

#### 2. Fetch-and-Ingest Endpoint (`/api/ingest/marketcheck/fetch-and-ingest`)
- **Status:** `500` ❌
- **Response:** HTML error page (Express default handler)
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <pre>Internal Server Error</pre>
  </html>
  ```

#### 3. Direct Ingestion Endpoint (`/api/ingest/marketcheck`)
- **Status:** `500` ❌
- **Response:** HTML error page (Express default handler)
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <pre>Internal Server Error</pre>
  </html>
  ```

### Critical Finding

**HTML Error Pages = Express Default Error Handler**

This means:
- ❌ Our JSON error handlers are NOT catching the error
- ❌ Error occurs before reaching route handlers
- ⚠️ Possibly an unhandled exception or middleware error
- ⚠️ Need Railway logs to see actual error/stack trace

---

## Railway Logs - Actual Error (REQUIRED)

**Status:** ✅ Captured from Railway logs (UTC timestamps)

### Actual Railway Log Error:

```
2025-12-05T17:57:28.234221582Z [err] Unhandled error: <ref *2> IncomingMessage { error: undefined, _hadError: false, _closeAfterHandlingError: false, error: [Function: socketOnError], [Symbol(errored)]: null }
2025-12-05T17:57:28.240669328Z [err] url: '/api/ingest/marketcheck/fetch-and-ingest',

2025-12-05T17:57:46.643352104Z [err] Unhandled error: <ref *2> IncomingMessage { error: undefined, _hadError: false, _closeAfterHandlingError: false, error: [Function: socketOnError], [Symbol(errored)]: null }
2025-12-05T17:57:46.648838684Z [err] url: '/api/ingest/marketcheck',

2025-12-05T17:59:40.099220169Z [err] Unhandled error: <ref *2> IncomingMessage { error: undefined, _closeAfterHandlingError: false, error: [Function: socketOnError], [Symbol(errored)]: null }
2025-12-05T17:59:40.104589032Z [err] url: '//api/ingest/marketcheck/fetch-and-ingest',
```

**Notes:**
- Railway is logging an “Unhandled error” with `IncomingMessage` and no stack/message (error is `undefined`). This suggests the failure is happening in Express/Node HTTP layer before our handler logs fire, and the stack is not emitted. We still need a stack trace to pinpoint the code path.
- Rate-limit warnings were present; some logs may have been dropped. Re-run ingestion with reduced noisy logging or increased log buffer to capture the first thrown error/stack.

---

## UVS Schema Status

✅ **Migration File Exists:**
- Path: `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`
- Creates: `uvs_vehicles` table with full UVS schema

⏳ **Table Verification:**
- Status: **PENDING** - Needs Supabase Dashboard check
- SQL to verify:
  ```sql
  SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_name = 'uvs_vehicles'
  );
  ```

---

## Code Changes Made

✅ **Enhanced Error Logging:**
- File: `apps/mcp-server/src/api/ingest.ts`
- Added stack trace logging to fetch-and-ingest endpoint
- Added stack traces to error responses

**Note:** HTML error pages suggest error occurs before our handlers, so enhanced logging may not catch it. Railway logs needed.

---

## Summary

### Diagnostic Script Results:
- ✅ Script ran successfully
- ❌ Both endpoints return 500 errors
- ❌ Getting HTML (not JSON) - Express default handler

### Next Steps:
1. ⏳ **Check Railway logs** - Need actual error/stack trace
2. ⏳ **Verify UVS table** exists in Supabase
3. ⏳ **Check authentication** - May need `INGESTION_API_TOKEN`

### Root Cause (Pending Railway Logs):
- Most likely: Missing Supabase env vars or database table
- Need Railway logs to confirm actual error message

---

**HTML error pages indicate the error is happening at Express level. Railway logs will show the actual error/stack trace.**

---

## Code Changes Made (2025-12-08)

### ✅ Enhanced Error Logging & Instrumentation

**File:** `apps/mcp-server/src/index.ts`

1. **Added Top-Level Crash Handlers:**
   - `process.on('unhandledRejection')` - Captures unhandled promise rejections
   - `process.on('uncaughtException')` - Captures uncaught exceptions
   - Both log full stack traces with structured error info

2. **Fixed Express Error Middleware:**
   - Updated to properly handle non-Error objects
   - Logs full stack traces with `INGEST_ERROR` prefix
   - Includes request context (path, method, url)
   - Guards against logging full request objects (prevents socket dumps)

3. **Path Normalization:**
   - Added middleware to normalize double slashes in URLs
   - Prevents `//api/ingest` issues

4. **Reduced Noisy Logging:**
   - Removed full `req.headers` dumps (prevents socket object logging)
   - Only logs essential headers (userAgent, contentType, origin)
   - Guards request logging to prevent socket dumps

**File:** `apps/mcp-server/src/api/ingest.ts`

1. **URL Normalization:**
   - Normalized MarketCheck API URL construction to prevent double slashes
   - Ensures clean URL joining

---

## Retest Instructions

### Step 1: Deploy Updated Code to Railway

**Option A: Via Railway Dashboard (Recommended)**
1. Go to https://railway.app
2. Navigate to: **Project → MCP Server service**
3. Click **"Redeploy"** button (or go to **Settings → Redeploy**)
4. Wait for build/deploy to complete (~2-5 minutes)
5. Verify deployment in **Deployments** tab

**Option B: Via Railway CLI**
```bash
cd apps/mcp-server
railway up --service mcp-server
```

**Option C: Push to GitHub (if auto-deploy enabled)**
```bash
git add apps/mcp-server/src/index.ts apps/mcp-server/src/api/ingest.ts
git commit -m "feat: add error instrumentation and reduce noisy logging"
git push
```

### Step 2: Prepare to Capture Error

1. **Open Railway Dashboard Logs:**
   - Go to https://railway.app
   - Navigate to: **Project → MCP Server service → Logs tab**
   - **Keep logs visible**

2. **Note Current Time** - We'll look for errors after this timestamp

### Step 3: Trigger Error

**Option A: Run Diagnostic Script**
```bash
cd /Users/mac/AutoAgent
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**Option B: Click Sync Button in Dashboard**
- Navigate to production dashboard
- Fill MarketCheck form
- Click "Sync Inventory"

### Step 4: Check Railway Logs

**Look for these log entries (should appear immediately after triggering):**

1. **Top-Level Crash Handler Logs:**
   ```
   UNHANDLED_REJECTION { error: '...', stack: '...', promise: '...' }
   ```
   OR
   ```
   UNCAUGHT_EXCEPTION { error: '...', stack: '...', name: '...' }
   ```

2. **Express Error Middleware Logs:**
   ```
   INGEST_ERROR { error: '...', stack: '...', path: '/api/ingest/...', method: 'POST' }
   ```

3. **Ingestion Endpoint Error Logs:**
   ```
   [event: 'marketcheck_fetch_ingest_error'] or [event: 'ingestion_api_error']
   ```

**What to Capture:**
- ✅ **Full stack trace** (complete, not truncated)
- ✅ **Error message**
- ✅ **Timestamp**
- ✅ **Route/endpoint** that failed

### Step 5: Document Findings

Add the captured error to this document under "Railway Logs - Actual Error" section, replacing the old placeholder content.

---

## Expected Improvements

After this deployment, you should see:

1. ✅ **Clear Stack Traces** - Full stack traces in logs (no more "IncomingMessage { error: undefined }")
2. ✅ **Reduced Log Noise** - No more socket dumps triggering rate limits
3. ✅ **Normalized Paths** - No more double-slash issues
4. ✅ **Proper Error Context** - Route, method, and full error details logged

---

**Ready to retest once code is deployed to Railway.**
