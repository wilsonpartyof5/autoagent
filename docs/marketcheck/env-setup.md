# MarketCheck Environment Variable Setup

## Overview

MarketCheck API integration requires the `MARKETCHECK_API_KEY` environment variable to be configured in both the dealer dashboard (Next.js) and MCP server applications.

## Required Environment Variables

### Dealer Dashboard (`apps/dealer-dashboard`)

**File**: `.env.local` (preferred) or `.env`

**Variable**: `MARKETCHECK_API_KEY`

**Sample Value**: `MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX`

**Usage**: Server-side only (used in `syncMarketCheckInventory` server action)

**Note**: Next.js automatically loads `.env.local` for server-side environment variables. No `NEXT_PUBLIC_` prefix is needed since this key should never be exposed to the client.

### MCP Server (`apps/mcp-server`)

**File**: `.env`

**Variable**: `MARKETCHECK_API_KEY`

**Sample Value**: `MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX`

**Usage**: Used in MarketCheck service and vehicle search tools

## Setup Instructions

### For Dealer Dashboard

1. **Navigate to dealer dashboard directory**:
   ```bash
   cd apps/dealer-dashboard
   ```

2. **Create or edit `.env.local`**:
   ```bash
   # If file doesn't exist, create it
   touch .env.local
   
   # Add MarketCheck API key
   echo "MARKETCHECK_API_KEY=your_api_key_here" >> .env.local
   ```

3. **Or manually edit `.env.local`**:
   ```env
   MARKETCHECK_API_KEY=MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX
   ```

4. **Restart the dev server**:
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart
   pnpm --filter dealer-dashboard dev
   ```

### For MCP Server

1. **Navigate to MCP server directory**:
   ```bash
   cd apps/mcp-server
   ```

2. **Copy from example**:
   ```bash
   cp env.example .env
   ```

3. **Edit `.env` and set your API key**:
   ```env
   MARKETCHECK_API_KEY=your_api_key_here
   ```

4. **Restart the MCP server** if running

## Verification

### Check Dashboard Configuration

1. Navigate to `/app/setup` in the dealer dashboard
2. Enter a dealer ID (e.g., `10015450`)
3. If the API key is configured correctly:
   - No error message about missing API key
   - Rooftop detection works
   - Sync can proceed

### Check Server Logs

If the API key is missing, you'll see:
```
MarketCheck API key is not configured on the server.
```

### Environment Variable Loading Order (Next.js)

Next.js loads environment variables in this order (later files override earlier ones):

1. `.env` - Default values for all environments
2. `.env.local` - Local overrides (gitignored, use for secrets)
3. `.env.development` / `.env.production` - Environment-specific
4. `.env.development.local` / `.env.production.local` - Local environment-specific

**Recommendation**: Use `.env.local` for `MARKETCHECK_API_KEY` since it's gitignored and contains secrets.

## Security Notes

1. **Never commit API keys**: `.env.local` should be in `.gitignore`
2. **Server-side only**: `MARKETCHECK_API_KEY` should NOT have `NEXT_PUBLIC_` prefix
3. **Rotate keys**: If a key is exposed, rotate it immediately in MarketCheck dashboard
4. **Use different keys**: Consider using different API keys for development and production

## Troubleshooting

### Issue: "MarketCheck API key is not configured on the server"

**Possible Causes**:
1. `.env.local` file doesn't exist
2. `MARKETCHECK_API_KEY` not set in `.env.local`
3. Server not restarted after adding the key
4. Wrong file location (should be in `apps/dealer-dashboard/.env.local`)

**Solution**:
1. Check file exists: `ls -la apps/dealer-dashboard/.env.local`
2. Verify key is set: `grep MARKETCHECK_API_KEY apps/dealer-dashboard/.env.local`
3. Restart dev server
4. Check server logs for errors

### Issue: API calls failing with 401/403

**Possible Causes**:
1. Invalid API key
2. API key expired or revoked
3. Wrong API key format

**Solution**:
1. Verify key in MarketCheck dashboard
2. Check key format (should be alphanumeric string)
3. Test key with curl:
   ```bash
   curl "https://api.marketcheck.com/v2/search/car/active?api_key=YOUR_KEY&dealer_id=10015450&pageSize=1"
   ```

### Issue: Environment variable not loading

**Possible Causes**:
1. File not in correct location
2. Syntax error in `.env.local`
3. Server not restarted

**Solution**:
1. Ensure file is at `apps/dealer-dashboard/.env.local` (not `.env` or elsewhere)
2. Check for syntax errors (no spaces around `=`, no quotes unless needed)
3. Restart server completely (kill process and restart)

## Example `.env.local` File

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# MarketCheck API
MARKETCHECK_API_KEY=MLyMpVhvNRm1y4jGKXuzBvHaBjhKrgsX
MARKETCHECK_BASE_URL=https://api.marketcheck.com

# Optional: Enable enrichment
MARKETCHECK_ENRICH_LISTINGS=0

# Dashboard Ingest (for API routes)
DASHBOARD_INGEST_TOKEN=your_bearer_token_here
```

## Related Documentation

- [MarketCheck API Endpoints](../api/marketcheck-endpoints.md)
- [Dealer Sync Test](./dealer-sync-ask-jorge-lopez.md)
- [Rooftop Auto-Detection](./rooftop-auto-detection.md)

