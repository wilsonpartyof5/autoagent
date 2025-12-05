# MarketCheck Sync Error Debug Report

## Summary

Enhanced error logging has been added to help capture the full server-side error when clicking "Sync Inventory" in the dashboard. The error logging now includes:

1. ✅ **Full stack traces** - `error.stack` is now logged
2. ✅ **API error details** - Status code, status text, response body
3. ✅ **Request details** - URL, headers (with tokens redacted)

## Changes Made

### 1. Enhanced Error Logging (`apps/dealer-dashboard/src/app/app/setup/actions.ts`)

**Location**: `fetchAndIngestMarketCheckInventory` function (lines 203-211, 156-169)

**Improvements**:
- Added stack trace logging: `error.stack` is now captured
- Added error name logging: `error.name` for better error categorization
- Enhanced API error response logging: Full error details including status, response body, URL
- Better error context: All relevant request parameters are logged

**Code Changes**:
```typescript
// Before: Only logged error message
console.error('[fetchAndIngestMarketCheckInventory] Error:', {
  error: error instanceof Error ? error.message : String(error),
});

// After: Logs full error details
console.error('[fetchAndIngestMarketCheckInventory] Error:', {
  dealerId,
  source,
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  name: error instanceof Error ? error.name : undefined,
});
if (error instanceof Error) {
  console.error('[fetchAndIngestMarketCheckInventory] Full error stack:', error.stack);
}
```

## Next Steps to Find the Error

### Option 1: Reproduce Locally (Recommended)

1. **Set up environment variables** in `apps/dealer-dashboard/.env.local`:
   ```bash
   MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
   INGESTION_API_TOKEN=<get from Vercel env vars>
   ```

2. **Start local dev server**:
   ```bash
   pnpm -C apps/dealer-dashboard dev
   ```

3. **Open** `http://localhost:3000/app/setup`

4. **Fill MarketCheck form** with the same dealer ID/zip used in production

5. **Click "Sync MarketCheck Inventory"**

6. **Check server console** - Full error details will be logged with stack traces

### Option 2: Check Production Logs

#### Via Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select project: `autoagent-dealer-dashboard`
3. Navigate to **Deployments** tab
4. Click on the latest deployment
5. Check **Function Logs** for errors from `/app/app/setup/actions.ts`

#### Via Vercel CLI:
```bash
# Get production URL first
vercel ls --prod

# Then check logs (you'll need the deployment URL)
# Note: Vercel CLI logs access may be limited
```

### Option 3: Test the MCP Endpoint Directly

Test the MCP server endpoint directly to isolate the issue:

```bash
curl -X POST https://autoagentmcp-server-production.up.railway.app/api/ingest/marketcheck/fetch-and-ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INGESTION_API_TOKEN>" \
  -d '{
    "dealerId": "11042155",
    "source": "myrockhillgmc.com",
    "radiusMiles": 50,
    "condition": "all"
  }'
```

Replace `<INGESTION_API_TOKEN>` with the actual token from Vercel/Railway environment variables.

## Expected Error Log Format

When the error occurs, you'll see logs like:

```
[fetchAndIngestMarketCheckInventory] Calling MCP fetch-and-ingest endpoint: {
  url: 'https://autoagentmcp-server-production.up.railway.app/api/ingest/marketcheck/fetch-and-ingest',
  dealerId: '11042155',
  source: 'myrockhillgmc.com',
  ...
}

[fetchAndIngestMarketCheckInventory] API error response: {
  status: 500,
  statusText: 'Internal Server Error',
  url: 'https://autoagentmcp-server-production.up.railway.app/api/ingest/marketcheck/fetch-and-ingest',
  responseBody: { ... }
}

[fetchAndIngestMarketCheckInventory] Error: {
  dealerId: '11042155',
  source: 'myrockhillgmc.com',
  error: 'MCP fetch-and-ingest failed (500): ...',
  stack: 'Error: MCP fetch-and-ingest failed (500): ...\n    at fetchAndIngestMarketCheckInventory (...)\n    ...',
  name: 'Error'
}

[fetchAndIngestMarketCheckInventory] Full error stack: Error: MCP fetch-and-ingest failed (500): ...
    at fetchAndIngestMarketCheckInventory (apps/dealer-dashboard/src/app/app/setup/actions.ts:168:15)
    at syncMarketCheckInventory (apps/dealer-dashboard/src/app/app/setup/actions.ts:316:22)
    ...
```

## Common Errors and Solutions

### 1. "MCP_SERVER_URL or INGESTION_SERVICE_URL must be configured"

**Error Location**: Line 120-123 in `actions.ts`

**Solution**: 
- Set `MCP_SERVER_URL` or `INGESTION_SERVICE_URL` in Vercel environment variables
- For local: Set in `apps/dealer-dashboard/.env.local`

**Production Check**:
```bash
# Check Vercel env vars (requires Vercel CLI or dashboard access)
vercel env ls
```

### 2. "Unauthorized" (401)

**Error Location**: MCP server authentication middleware

**Possible Causes**:
- Missing `INGESTION_API_TOKEN` in dashboard env vars
- Token mismatch between dashboard and MCP server
- Token not included in request headers

**Solution**:
- Verify `INGESTION_API_TOKEN` is set in both Vercel (dashboard) and Railway (MCP server)
- Ensure values match exactly (no trailing spaces)
- Check that token is being sent in `Authorization: Bearer <token>` header

### 3. "MarketCheck request failed" or "MARKETCHECK_API_KEY not configured"

**Error Location**: MCP server (`apps/mcp-server/src/api/ingest.ts:57-60`)

**Solution**: 
- Verify `MARKETCHECK_API_KEY` is set in Railway MCP server environment variables
- Check Railway logs for confirmation

### 4. Network/Connection Errors

**Possible Causes**:
- MCP server is down
- Network connectivity issues
- CORS configuration

**Check**:
```bash
# Test MCP server health
curl https://autoagentmcp-server-production.up.railway.app/mcp
```

## Environment Variables Checklist

### Required in Vercel (Dealer Dashboard):
- ✅ `MCP_SERVER_URL` or `INGESTION_SERVICE_URL` → `https://autoagentmcp-server-production.up.railway.app`
- ✅ `INGESTION_API_TOKEN` or `MCP_SERVER_TOKEN` → Must match Railway token

### Required in Railway (MCP Server):
- ✅ `MARKETCHECK_API_KEY` → MarketCheck API key
- ✅ `INGESTION_API_TOKEN` → Must match Vercel token

## Files Modified

1. `apps/dealer-dashboard/src/app/app/setup/actions.ts`
   - Enhanced error logging in `fetchAndIngestMarketCheckInventory` function
   - Added stack trace capture
   - Improved API error response logging

2. `scripts/debug-sync-error.md` (new)
   - Step-by-step debugging guide

3. `SYNC_ERROR_DEBUG_REPORT.md` (this file)
   - Summary of changes and next steps

## Reporting the Error

When you capture the error, please provide:

1. **Error Message**: The exact error message from logs
2. **Stack Trace**: Full stack trace (from console logs)
3. **Failing Call**:
   - URL: The API endpoint being called
   - HTTP Status: Status code from response
   - Response Body: Error response body (first 500-1000 chars)
4. **Environment Variables Status**:
   - Which env vars are set in Vercel?
   - Which env vars are set in Railway?
   - Any missing variables?
5. **Request Payload**: The data sent to the API (dealerId, source, etc.)
6. **Reproduction Steps**: How you reproduced the error

## Next Actions

1. ✅ Enhanced error logging added
2. ⏳ Reproduce error locally or check production logs
3. ⏳ Capture full stack trace and error details
4. ⏳ Identify root cause (missing env var, API error, network issue, etc.)
5. ⏳ Report findings with full error details

## Resources

- Debug guide: `scripts/debug-sync-error.md`
- MCP server endpoint: `apps/mcp-server/src/api/ingest.ts`
- Sync action: `apps/dealer-dashboard/src/app/app/setup/actions.ts`
- Deployment checklist: `apps/dealer-dashboard/DEPLOYMENT_CHECKLIST.md`

