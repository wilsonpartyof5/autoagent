# Debugging MarketCheck Sync Error

## Goal
Find the server-side error thrown when clicking "Sync Inventory" (MarketCheck) in the dashboard (production). Capture the actual stack trace/message which is hidden in prod.

## Steps to Reproduce Locally

### 1. Check Environment Variables

First, verify required environment variables are set in `.env.local`:

```bash
cd apps/dealer-dashboard
```

Check that these are present:
- `MCP_SERVER_URL` or `INGESTION_SERVICE_URL` - Should be `https://autoagentmcp-server-production.up.railway.app`
- `INGESTION_API_TOKEN` or `MCP_SERVER_TOKEN` - Must match the token set in Railway MCP server
- `MARKETCHECK_API_KEY` - Optional for new flow (MCP server handles it), but may be needed for fallback

### 2. Start Local Development Server

```bash
pnpm -C apps/dealer-dashboard dev
```

This will start the dashboard at `http://localhost:3000`

### 3. Start MCP Server (if testing against local instance)

If you want to test against a local MCP server instead of production:

```bash
cd apps/mcp-server
pnpm dev
```

Then set `MCP_SERVER_URL=http://localhost:8787` in your `.env.local`

### 4. Reproduce the Error

1. Open `http://localhost:3000/app/setup` in your browser
2. Fill in the MarketCheck form:
   - Dealer ID: Use the same dealer ID from production (e.g., `11042155` or `10015450`)
   - Zip: Optional
   - Radius: 50 miles (default)
   - Condition: All (default)
3. Click "Sync MarketCheck Inventory"
4. Watch the server console output - you should see detailed error logs

### 5. Check Server Console

The enhanced error logging will show:
- Full error message
- Stack trace
- API response details (status, body)
- Request URL (with tokens redacted)

## Enhanced Error Logging

The code now includes improved error logging that will capture:

1. **Full Stack Traces**: `error.stack` is now logged
2. **API Error Details**: Status code, status text, response body
3. **Request Details**: URL, headers (with tokens redacted)

Look for logs prefixed with:
- `[fetchAndIngestMarketCheckInventory] Error:`
- `[fetchAndIngestMarketCheckInventory] Full error stack:`
- `[fetchAndIngestMarketCheckInventory] API error response:`

## Common Error Scenarios

### Error: "MCP_SERVER_URL or INGESTION_SERVICE_URL must be configured"

**Solution**: Set `MCP_SERVER_URL` or `INGESTION_SERVICE_URL` in `.env.local`

### Error: "Unauthorized" (401)

**Cause**: Token mismatch or missing token
**Solution**: 
1. Verify `INGESTION_API_TOKEN` is set in `.env.local`
2. Verify it matches the token in Railway MCP server environment variables

### Error: "MarketCheck request failed" or "MCP fetch-and-ingest failed"

**Check**:
1. Is the MCP server URL correct?
2. Is the MCP server running and accessible?
3. Check MCP server logs for more details

### Error: Network/CORS issues

**Solution**: Ensure MCP server allows requests from localhost or your local domain

## Testing Against Production MCP Server

If you want to test against the production MCP server:

1. Set in `.env.local`:
   ```
   MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
   INGESTION_API_TOKEN=<get from Vercel/Railway env vars>
   ```

2. Run the sync and check the error logs

## Getting Production Logs

To check production logs via Vercel CLI:

```bash
# List recent deployments
vercel ls --prod

# Get logs (replace with actual deployment URL)
vercel logs <deployment-url>
```

Or check Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select project: `autoagent-dealer-dashboard`
3. Go to Functions tab
4. Look for function logs from `/app/app/setup/actions.ts`

## Reporting Findings

When you capture the error, report:

1. **Error Message**: The exact error message
2. **Stack Trace**: Full stack trace (if available)
3. **Failing Call**: 
   - URL being called
   - HTTP status code
   - Response body (first 500 chars)
4. **Environment Variables**: Which ones are set/missing
5. **Request Payload**: What data was sent to the API

