# MCP Server Error Instrumentation - Summary

## Changes Made

### 1. Top-Level Crash Handlers ✅
**File:** `apps/mcp-server/src/index.ts` (lines 19-36)

Added process-level error handlers to catch errors before they become unhandled:
- `unhandledRejection` - Catches unhandled promise rejections
- `uncaughtException` - Catches uncaught exceptions (exits after logging)

Both log structured error info including full stack traces.

### 2. Express Error Middleware ✅
**File:** `apps/mcp-server/src/index.ts` (lines 492-520)

- Fixed to properly handle non-Error objects
- Logs with `INGEST_ERROR` prefix for easy filtering
- Includes full stack traces
- Guards against logging full request objects
- Includes request context (path, method, url)

### 3. Path Normalization ✅
**File:** `apps/mcp-server/src/index.ts` (lines 42-46)

Added middleware to normalize double slashes in URLs:
```typescript
app.use((req, res, next) => {
  if (req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }
  next();
});
```

### 4. Reduced Noisy Logging ✅
**File:** `apps/mcp-server/src/index.ts`

- Removed full `req.headers` dumps (prevents socket object logging)
- Only logs essential headers (userAgent, contentType, origin)
- Guards request logging to prevent socket dumps
- Changed line 220: Removed `headers: req.headers` → Only essential headers
- Changed line 170-177: Guarded reqInfo object creation

### 5. URL Construction Normalization ✅
**File:** `apps/mcp-server/src/api/ingest.ts` (lines 91-93)

Normalized MarketCheck API URL construction:
```typescript
const normalizedBase = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
const normalizedEndpoint = endpoint.replace(/^\/+/, '/'); // Ensure single leading slash
const url = `${normalizedBase}${normalizedEndpoint}?${searchParams.toString()}`;
```

---

## Expected Results After Deployment

### What You'll See in Railway Logs:

**Before (what we saw):**
```
Unhandled error: <ref *2> IncomingMessage { error: undefined, ... }
```

**After (what you should see):**
```
UNHANDLED_REJECTION { error: 'actual error message', stack: 'full stack trace', promise: '...' }
```
OR
```
INGEST_ERROR { error: 'actual error message', stack: 'full stack trace', path: '/api/ingest/marketcheck', method: 'POST' }
```

### Improvements:

1. ✅ **Clear Stack Traces** - Full stack traces with file/line numbers
2. ✅ **Reduced Log Noise** - No more socket dumps triggering rate limits
3. ✅ **Normalized Paths** - No more double-slash issues (`//api/ingest`)
4. ✅ **Proper Error Context** - Route, method, and full error details

---

## Deployment Instructions

### Option 1: Railway Dashboard (Easiest)
1. Go to https://railway.app
2. Navigate to: **Project → MCP Server service**
3. Click **"Redeploy"** button
4. Wait for build/deploy (~2-5 minutes)

### Option 2: Railway CLI
```bash
cd apps/mcp-server
railway up --service mcp-server
```

### Option 3: Git Push (if auto-deploy enabled)
```bash
git add apps/mcp-server/src/index.ts apps/mcp-server/src/api/ingest.ts
git commit -m "feat: add error instrumentation and reduce noisy logging"
git push
```

---

## Retest After Deployment

### Step 1: Open Railway Logs
- Go to Railway Dashboard → MCP Server → Logs tab
- Keep it open and visible

### Step 2: Trigger Error
**Run diagnostic script:**
```bash
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/diagnose-mcp-ingestion-error.sh 11042155 myrockhillgmc.com
```

**OR click "Sync Inventory" in dashboard**

### Step 3: Capture Error
Look for logs with these prefixes:
- `UNHANDLED_REJECTION`
- `UNCAUGHT_EXCEPTION`
- `INGEST_ERROR`

Copy the **full stack trace** and add to `MCP_500_ERROR_FINDINGS.md`

---

## Files Modified

- ✅ `apps/mcp-server/src/index.ts`
- ✅ `apps/mcp-server/src/api/ingest.ts`
- ✅ `MCP_500_ERROR_FINDINGS.md` (updated with retest instructions)

---

**Status:** ✅ Code changes complete, ready for deployment and retest.

