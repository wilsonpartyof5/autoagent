# AutoAgent

AutoAgent is a ChatGPT-native vehicle search and lead generation platform built on the Apps SDK and MCP. It connects live MarketCheck inventory, secure lead capture, and a dealer dashboard to deliver a complete automotive commerce workflow directly inside ChatGPT.

## Key Capabilities
- Live MarketCheck inventory with VINs, pricing, dealer info, and availability
- Production MCP server exposing `search-vehicles` and `submit-lead` tools plus UI widgets
- Interactive Leaflet-powered vehicle results widget embedded as a ChatGPT component
- Secure lead pipeline with libsodium encryption, consent management, and dashboard forwarding
- **Universal ADF XML lead delivery** to dealer CRM systems (HTTP endpoint or Email) with delivery logging and resend capability
- Dealer SaaS dashboard (Next.js) for analytics, lead triage, onboarding, and follow-up tracking
- In-app onboarding banner with MarketCheck inventory sync flow (Supabase-backed progress + vehicle ingestion)

## Architecture Snapshot
- **MCP Server** (`apps/mcp-server`): Node.js/Express service implementing MCP, tools, and widgets
- **Dealer Dashboard** (`apps/dealer-dashboard`): Next.js app for dealers to manage incoming leads
- **Shared Package** (`packages/shared`): Common TypeScript types and schemas across services, including the unified vehicle inventory metafields contract.

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+

### Install & Run
```bash
# install workspace dependencies
pnpm install

# launch all dev servers (MCP + dashboard)
pnpm dev
# dashboard env (Supabase auth + onboarding)
cp apps/dealer-dashboard/.env.example apps/dealer-dashboard/.env.local
```

### MCP Server Workflow
```bash
# start only the MCP server
pnpm --filter mcp-server dev

# build for production
pnpm --filter mcp-server build

# run production bundle
pnpm --filter mcp-server start
```

Set up environment variables by copying the example file and supplying your keys:
```bash
cp apps/mcp-server/env.example apps/mcp-server/.env
```

Ensure `MARKETCHECK_API_KEY`, `MARKETCHECK_BASE_URL`, and `LEAD_ENC_KEY` are populated for live data.
Add Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) to `apps/dealer-dashboard/.env.local`, then run the SQL migrations in `apps/dealer-dashboard/supabase/migrations` to create the `profiles` and `inventory_vehicles` tables used by the dashboard onboarding flow.

### ChatGPT Testing Checklist
1. Start the MCP server locally: `pnpm --filter mcp-server dev`
2. Expose it with ngrok: `npx ngrok http 8787`
3. Use the ngrok URL when creating or updating your ChatGPT connector
4. Verify tools with `tools/list` and `tools/call` requests against `https://<ngrok>/mcp`

## MCP Tools & UI Resources
- **`search-vehicles`**: Real-time inventory search (location, condition, price, make, model, radius)
- **`submit-lead`**: Encrypted lead submission with consent enforcement and VIN validation
- **Widget** `ui://vehicle-results.html`: Zillow-style map and card experience for search results

## Documentation Map
- **Sources of truth (Drevvy)**: `docs/drevvy/README.md`
  - Product vision and business model: `docs/drevvy/DREVVY_CONTEXT.md`
  - Data architecture and MarketCheck MCP/API: `docs/drevvy/DREVVY_DATA_ARCHITECTURE.md`
- **Onboarding Portal**: `docs/README.md`
  - Quick setup checklist: `docs/quickstart.md`
  - System deep dive: `docs/overview.md`
- **API Reference**: `docs/api.md`
- **MarketCheck Endpoint Guide**: `docs/api/marketcheck-endpoints.md`
- **Lead Delivery**: `docs/lead-delivery/adf-payload.md` - ADF XML format and CRM integration
- **Deployment Guides**: `docs/deployment/production.md`, `docs/deployment/railway.md`
- **Operations & Support**: `docs/operations/openai-support-ticket.md`
- **Release History**: `CHANGELOG.md`

## ChatGPT Live Test

### Prerequisites
1. **MCP Server Running**: `pnpm --filter mcp-server dev` (port 8787)
2. **Dashboard Running**: `pnpm --filter dealer-dashboard dev` (port 3000)
3. **HTTPS Tunnel**: Expose MCP server via ngrok or Cloudflare Tunnel
4. **Environment Variables**: All required keys configured (see `apps/mcp-server/env.example`)

### Handshake Validation

**Step 1: Initialize Connection**
```bash
curl -X POST https://your-ngrok-url.ngrok-free.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "chatgpt",
        "version": "1.0.0"
      }
    }
  }'
```

**Expected Response**: `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{...}}}`

**Step 2: List Available Tools**
```bash
curl -X POST https://your-ngrok-url.ngrok-free.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

**Expected Response**: Should include `search-vehicles` and `submit-lead` tools

**Step 3: Widget Readiness**

The vehicle results widget (`/widget/vehicle-results`) must:
1. Listen for `openai:set_globals` event from ChatGPT
2. Emit `ui:ready` event when loaded
3. Have CSP headers allowing `frame-ancestors https://chat.openai.com https://chatgpt.com`

**Verify Widget**:
```bash
curl -I https://your-ngrok-url.ngrok-free.dev/widget/vehicle-results
```

**Check Headers**:
- `Content-Security-Policy` should include `frame-ancestors https://chat.openai.com https://chatgpt.com`
- No `X-Frame-Options: DENY` header

### ChatGPT Connector Setup

1. **Create/Update Connector**:
   - Go to ChatGPT → Settings → Connectors
   - Add new connector or edit existing
   - **MCP Server URL**: `https://your-ngrok-url.ngrok-free.dev/mcp`
   - **Authentication**: None (or bearer token if configured)

2. **Test Connection**:
   - ChatGPT should automatically call `initialize` and `tools/list`
   - Verify tools appear in ChatGPT interface
   - Try: "Search for used Toyota Camry near Tomball, TX"

3. **Widget Embedding**:
   - When `search-vehicles` returns a widget component, ChatGPT will embed it
   - Widget should load and display vehicle results
   - Lead submission form should work within ChatGPT iframe

### Troubleshooting

**Connection Issues**:
- Verify ngrok/Cloudflare tunnel is active: `curl https://your-url/health`
- Check MCP server logs for errors
- Ensure CORS headers allow ChatGPT origin

**Widget Not Loading**:
- Check browser console for CSP violations
- Verify `frame-ancestors` includes ChatGPT domains
- Test widget directly: `https://your-url/widget/vehicle-results`

**Tools Not Appearing**:
- Check MCP server logs for `tools/list` response
- Verify tool schemas are valid JSON
- Test tools manually via curl (see examples above)

> **📋 Complete Testing Guide**: For a comprehensive smoke test checklist covering environment setup, tunnel configuration, connector registration, test scenarios, and troubleshooting, see [`docs/testing/chatgpt-smoke-test.md`](docs/testing/chatgpt-smoke-test.md).

### Quick Start Commands

```bash
# Terminal 1: Start MCP server
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev

# Terminal 2: Start dashboard
pnpm --filter dealer-dashboard dev

# Terminal 3: Expose MCP server (ngrok)
ngrok http 8787
# Or use Cloudflare Tunnel:
# cloudflared tunnel --url http://localhost:8787

# Use the HTTPS URL from ngrok/Cloudflare in ChatGPT connector settings
```

## Development Scripts
- `pnpm build` – build all workspace packages
- `pnpm dev` – start MCP server and dealer dashboard in dev mode
- `pnpm lint` – lint the monorepo
- `pnpm format` – run Prettier
- `pnpm typecheck` – TypeScript project references check
- `pnpm update-docs` – update markdown files summary (run after creating new `.md` files)
- `pnpm watch-docs` – watch for new markdown files and auto-update summary

## Inventory Sync Roadmap
- ✅ MarketCheck: one-click sync from `/app/setup` (dealer ID, radius, optional ZIP) and viewing imported vehicles under `/app/inventory`.
- ⏳ Billing activation: build “Go Live” flow to flip `billing_active`.
- ⏳ Additional providers: design credential flows for CDK & vAuto once ready; update settings UI to expose provider switching.
