# Ingestion Automation Deployment Checklist

## Pre-Deployment

### 1. Environment Variables - MCP Server (Railway)

Set in Railway environment variables:

- ✅ `MARKETCHECK_API_KEY` - Already configured
- ⚠️ `INGESTION_API_TOKEN` - **NEW**: Generate a secure token (e.g., `openssl rand -base64 32`)

**To set in Railway:**
1. Go to Railway project → MCP Server service
2. Variables tab → Add Variable
3. Set `INGESTION_API_TOKEN` to a secure random string

### 2. Environment Variables - Dealer Dashboard (Vercel)

Set in Vercel environment variables:

- ⚠️ `MCP_SERVER_URL` or `INGESTION_SERVICE_URL` - **REQUIRED**: Set to `https://autoagentmcp-server-production.up.railway.app`
- ⚠️ `INGESTION_API_TOKEN` or `MCP_SERVER_TOKEN` - **REQUIRED**: Must match the token set in Railway MCP server

**To set in Vercel:**
1. Go to Vercel project → Settings → Environment Variables
2. Add:
   - `MCP_SERVER_URL` = `https://autoagentmcp-server-production.up.railway.app`
   - `INGESTION_API_TOKEN` = (same value as Railway)

### 3. Verify Code Changes

Files modified:
- ✅ `apps/dealer-dashboard/src/app/app/setup/actions.ts` - Added `fetchAndIngestMarketCheckInventory`
- ✅ `apps/dealer-dashboard/src/app/api/ingest/nightly/route.ts` - New nightly endpoint
- ✅ `apps/dealer-dashboard/vercel.json` - Added cron configuration
- ✅ `apps/dealer-dashboard/docs/INGESTION_AUTOMATION.md` - Documentation

## Deployment Steps

### Step 1: Deploy MCP Server (Railway)

1. Push changes to repository (if any MCP server changes)
2. Railway will auto-deploy
3. Verify `INGESTION_API_TOKEN` is set in Railway environment

### Step 2: Deploy Dealer Dashboard (Vercel)

1. Push changes to repository
2. Vercel will auto-deploy
3. Verify environment variables are set:
   - `MCP_SERVER_URL`
   - `INGESTION_API_TOKEN`

### Step 3: Verify Cron Job

After deployment, Vercel will automatically:
- Register the cron job from `vercel.json`
- Run it daily at 2 AM UTC
- Include `X-Cron-Secret` header with `INGESTION_API_TOKEN` value

**To verify cron is registered:**
1. Go to Vercel project → Settings → Cron Jobs
2. Should see: `/api/ingest/nightly` scheduled for `0 2 * * *`

## Testing

### Test 1: Manual Onboarding Sync

1. Go to dashboard setup page
2. Enter dealer ID (e.g., `11042155` for Rock Hill GMC)
3. Click "Sync MarketCheck Inventory"
4. Should see success message with import count
5. Check logs for `[fetchAndIngestMarketCheckInventory]` entries

### Test 2: Manual Nightly Endpoint

```bash
# Get token from environment
export INGESTION_API_TOKEN="your-token-here"
export DASHBOARD_URL="https://your-vercel-domain.vercel.app"

# Or use the test script
node scripts/test-nightly-ingest.js
```

Expected response:
```json
{
  "ok": true,
  "message": "Nightly refresh complete: X succeeded, 0 failed",
  "processed": X,
  "succeeded": X,
  "failed": 0,
  "totalImported": XXX,
  "results": [...]
}
```

### Test 3: Verify Cron Execution

1. Wait for next cron run (or manually trigger)
2. Check Vercel function logs for `/api/ingest/nightly`
3. Should see `[nightly-ingest]` log entries
4. Verify dealerships were processed

## Monitoring

### Logs to Watch

**MCP Server (Railway):**
- `[marketcheck_fetch_start]` - Fetch started
- `[marketcheck_fetch_complete]` - Fetch completed
- `[ingestion_api_request]` - Ingestion started

**Dealer Dashboard (Vercel):**
- `[fetchAndIngestMarketCheckInventory]` - Individual sync operations
- `[nightly-ingest]` - Nightly refresh operations

### Success Indicators

- ✅ `Successfully synced` - Individual dealership sync succeeded
- ✅ `Nightly refresh complete` - All dealerships processed
- ✅ `imported: X` - Vehicles successfully stored in UVS

### Error Indicators

- ❌ `MCP fetch-and-ingest failed` - Endpoint call failed
- ❌ `Unauthorized` - Token mismatch
- ❌ `MARKETCHECK_API_KEY not configured` - Missing API key

## Troubleshooting

### Issue: "Unauthorized" error

**Cause:** Token mismatch between Railway and Vercel

**Fix:**
1. Verify `INGESTION_API_TOKEN` is set in both Railway and Vercel
2. Ensure values match exactly
3. Redeploy both services

### Issue: "MCP_SERVER_URL must be configured"

**Cause:** Missing environment variable in Vercel

**Fix:**
1. Add `MCP_SERVER_URL` to Vercel environment variables
2. Set to `https://autoagentmcp-server-production.up.railway.app`
3. Redeploy dashboard

### Issue: Cron not running

**Cause:** Cron job not registered or misconfigured

**Fix:**
1. Check `vercel.json` has cron configuration
2. Verify cron is registered in Vercel dashboard
3. Check Vercel logs for cron execution errors

### Issue: No dealerships processed

**Cause:** No active dealerships with MarketCheck dealer IDs

**Fix:**
1. Verify dealerships exist in database
2. Check `marketcheck_dealer_id` is set
3. Verify `is_active = true`

## Rollback Plan

If issues occur:

1. **Disable cron:** Remove cron config from `vercel.json` and redeploy
2. **Revert to legacy sync:** The code automatically falls back if fetch-and-ingest fails
3. **Manual sync:** Use dashboard UI to sync individual dealerships

## Post-Deployment Verification

- [ ] Environment variables set in Railway
- [ ] Environment variables set in Vercel
- [ ] MCP server deployed and healthy
- [ ] Dashboard deployed and accessible
- [ ] Manual sync test successful
- [ ] Nightly endpoint test successful
- [ ] Cron job registered in Vercel
- [ ] First cron run completed successfully
- [ ] Logs show successful ingestion

