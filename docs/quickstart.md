# AutoAgent Quick Start Checklist

Use this checklist whenever you spin up a fresh Cursor/Codex session. It captures the current MCP endpoint status, required environment, and command surface so you can become productive in minutes.

## Current Operational Snapshot
- **Public MCP URL**: `https://autoagentmcp-server-production.up.railway.app/mcp`
- **Status**: ✅ Server healthy, MCP handshake validated, widgets emitting `ui:ready`
- **Available Tools**: `search-vehicles`, `submit-lead`, `ping-ui`, `ping-micro-ui`
- **Critical Source Files**:
  - MCP entry: `apps/mcp-server/src/index.ts`
  - Protocol core: `apps/mcp-server/src/mcp-handler.ts`
  - Tool implementations: `apps/mcp-server/src/tools/`
  - Widget HTML: `apps/mcp-server/src/ui/`

## Environment Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template and populate required secrets
cp apps/mcp-server/env.example apps/mcp-server/.env

# 3. Create dashboard env file and add Supabase keys
cp apps/dealer-dashboard/.env.example apps/dealer-dashboard/.env.local
```

Populate the following variables before running anything against production data:
```bash
MARKETCHECK_API_KEY=<your-api-key>
MARKETCHECK_BASE_URL=https://api.marketcheck.com
LEAD_ENC_KEY=<32-byte-base64>
DASHBOARD_INGEST_URL=<dealer-dashboard-endpoint>
DASHBOARD_INGEST_TOKEN=<bearer-token>
WIDGET_HOST=https://autoagentmcp-server-production.up.railway.app
AA_DIAG=1
SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
```

After adding Supabase credentials, run all SQL files in `apps/dealer-dashboard/supabase/migrations/` (profiles, MarketCheck columns, inventory_vehicles) so the dashboard onboarding banner, MarketCheck sync page, and inventory list function end-to-end.

## Get Your MarketCheck Dealer ID

Before syncing inventory in AutoAgent, you need your MarketCheck dealer ID. Follow these steps:

### Prerequisites
- ✅ Active MarketCheck account with signed contract
- ✅ Data feed must be active (vehicles syncing to MarketCheck)
- ✅ API access enabled (if required by your MarketCheck plan)

### Finding Your Dealer ID

1. **Log into MarketCheck Dashboard**
   - Access your MarketCheck dealer portal (URL varies by account; contact MarketCheck if unsure)
   - Navigate to your account settings or dealer profile section
   - Your dealer ID is typically displayed as a numeric value (e.g., `102345`)

2. **Alternative: Check API Response**
   - If you've received inventory data from MarketCheck API before, your dealer ID appears in the `dealer.id` field of any listing response
   - Example: `GET /v2/search/car/active?api_key=...&location=Seattle,WA` returns listings with `dealer.id` values

3. **Contact MarketCheck Support**
   - If you cannot locate your dealer ID, contact MarketCheck support:
     - **Email**: support@marketcheck.com
     - **Support Center**: [MarketCheck Support](https://www.marketcheck.com/apis/pricing/)
   - Provide your dealership name and location to expedite lookup

### What to Enter in AutoAgent

- **Dealer ID**: Enter the numeric dealer ID (e.g., `102345`) in the setup form at `/app/setup`
- **ZIP Code** (optional today): Helps refine results for multi-store groups; we’re building an automatic rooftop confirmation step that will read the available locations from MarketCheck and let you pick the correct store before syncing.
- **Radius** (optional): Search radius in miles (default: 50) for geographic filtering

> **Note**: The dealer ID is **required** for AutoAgent's inventory sync feature. ZIP and radius are optional refinements that help filter results but cannot replace the dealer ID.

## Inventory Sync Workflow (Current State)
- `/app/setup`: Collects MarketCheck dealer ID, optional ZIP, radius, and condition. The "Sync MarketCheck Inventory" button calls the MarketCheck API and stores listings in Supabase (`inventory_vehicles`).
- `/app/inventory`: Shows imported vehicles (VIN, price, mileage, photo). Displays seller comments (from enrichment), highlights option packages, and prefers enriched photos when available. Currently read-only; publishing tools coming later.
- `/app/leads`: Banner updates automatically when inventory sync completes; directs dealers to add billing.
- Settings → Inventory provider: Lets dealers update the MarketCheck dealer ID/ZIP (resets inventory sync state).
- Upcoming work: Billing activation ("Go Live"), additional provider connectors (CDK, vAuto), publish workflow in inventory tab.

## Enrichment

### Overview
Listing enrichment fetches additional detail data from MarketCheck API endpoints to enhance vehicle listings with seller comments, extended photo galleries, option packages, and dealer metadata.

### Enabling Enrichment
Set the environment variable in your server environment:
```bash
MARKETCHECK_ENRICH_LISTINGS=1
```

**Where to set:**
- MCP server: Add to `apps/mcp-server/.env` (affects `search-vehicles` tool)
- Dashboard: Add to `apps/dealer-dashboard/.env.local` (affects inventory sync)

### What Gets Enriched
When enabled, the system fetches:
- **Detail** (`/v2/listing/car/{id}`): Extended listing information
- **Media** (`/v2/listing/car/{id}/media`): Additional photos and video URLs
- **Extra** (`/v2/listing/car/{id}/extra`): Seller comments, option packages, specifications
- **Dealer** (`/v2/dealer/{dealer_id}`): Extended dealer metadata (hours, ratings, etc.)

Merged data appears in:
- Dashboard inventory cards (seller comments, options, enriched photos)
- MCP search responses (ChatGPT can reference seller comments and additional photos)
- Supabase `raw` field (stores original + enriched data for reference)

### Troubleshooting
Check structured logs for enrichment events:
- `event: 'search_enrichment'` — MCP search enrichment stats (enrichedCount, photosMerged, featuresMerged)
- `event: 'inventory_sync'` — Dashboard sync stats (enrichmentEnabled, enrichedCount, skippedCount)
- `event: 'marketcheck_enrichment_error'` — Individual listing enrichment failures
- `event: 'marketcheck_enrichment_failed'` — Overall enrichment failure for a listing

**Common issues:**
- **No enrichment data**: Verify `MARKETCHECK_ENRICH_LISTINGS=1` is set and check logs for `enrichmentEnabled: true`
- **Partial enrichment**: Some endpoints may fail (404, rate limits); check for `marketcheck_enrichment_error` events
- **Performance**: Enrichment adds ~3-5 seconds per listing; consider rate limiting for large inventories

## Command Reference
```bash
# Launch MCP server (dev)
pnpm --filter mcp-server dev

# Start dealer dashboard (optional during feature work)
pnpm --filter dealer-dashboard dev

# Kill stray dev servers (if hot reload stops applying)
pkill -f "tsx src/index.ts"

# Run production bundle locally
pnpm --filter mcp-server build
pnpm --filter mcp-server start
```

## Verify the Stack
```bash
# Health check
curl -sS https://autoagentmcp-server-production.up.railway.app/health | jq .

# MCP initialize handshake
curl -sS https://autoagentmcp-server-production.up.railway.app/mcp \
  -H 'Content-Type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"openai-mcp","version":"1.0.0"}}}' | jq .

# Enumerate tools
curl -sS https://autoagentmcp-server-production.up.railway.app/mcp \
  -H 'Content-Type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq .
```

## Troubleshooting Playbook
- **ChatGPT connector creation times out**  
  - Confirm initialize response includes `initialized: true` and `notification`.
  - Re-run the handshake curl above; restart the MCP server if fields are missing.
- **Widget iframe fails inside ChatGPT**  
  - Hit `https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results?diag=1` in a browser.
  - Check `/widget/beacon` and `/widget/console` logs for the latest run ID.
- **Server changes not applying**  
  - Ensure no orphaned `tsx src/index.ts` processes are running (use `pkill` command above).
- **Lead submission errors**  
  - Verify `LEAD_ENC_KEY` is 32-byte base64 and consent flag is `true`.
- **ngrok tunnel expired**  
  - Re-run `npx ngrok http 8787` and update `WIDGET_HOST` plus ChatGPT connector URLs.
- **Landing page renders unstyled**  
  - Run the recovery sequence from repo root:  
    `pkill -f "next dev" && pnpm install && pnpm --filter dealer-dashboard clean && rm -rf apps/dealer-dashboard/.next && pnpm --filter dealer-dashboard build && pnpm --filter dealer-dashboard dev`  
  - Reload `http://localhost:3000/` and confirm `/_next/static/css/app/layout.css` loads with Tailwind utilities.

## Before You Ship
- Run `pnpm lint` and `pnpm typecheck`.
- Validate tool and widget responses via the curl commands.
- Update `CHANGELOG.md` if the release surface changes.

Need deeper context? Jump to `overview.md` for architecture details or `deployment/production.md` before touching infrastructure.

## Conclusion
This project successfully demonstrates the complete development lifecycle of a ChatGPT App, from initial MCP protocol implementation through production-ready deployment. The comprehensive diagnostic tools and debugging capabilities ensure reliable operation and easy troubleshooting.

The AutoAgent ChatGPT App is now ready for production deployment and can provide users with powerful vehicle search and lead submission capabilities directly within ChatGPT conversations.
