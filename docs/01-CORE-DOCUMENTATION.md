# Core Documentation

**Last Updated**: 2025-02-21  
**Status**: ✅ Active Documentation

This document consolidates all core project documentation including README, changelog, overview, quickstart, and documentation hub.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start Guide](#quick-start-guide)
3. [System Architecture](#system-architecture)
4. [Documentation Hub](#documentation-hub)
5. [Release History](#release-history)
6. [Development Scripts](#development-scripts)

---

## Project Overview

Drevvy is a ChatGPT-native vehicle search and lead generation platform built on the Apps SDK and MCP. It connects live MarketCheck inventory, secure lead capture, and a dealer dashboard to deliver a complete automotive commerce workflow directly inside ChatGPT.

### Key Capabilities

- Live MarketCheck inventory with VINs, pricing, dealer info, and availability
- Production MCP server exposing `search-vehicles` and `submit-lead` tools plus UI widgets
- Interactive Leaflet-powered vehicle results widget embedded as a ChatGPT component
- Secure lead pipeline with libsodium encryption, consent management, and dashboard forwarding
- **Universal ADF XML lead delivery** to dealer CRM systems (HTTP endpoint or Email) with delivery logging and resend capability
- Dealer SaaS dashboard (Next.js) for analytics, lead triage, onboarding, and follow-up tracking
- In-app onboarding banner with MarketCheck inventory sync flow (Supabase-backed progress + vehicle ingestion)

### Architecture Snapshot

- **MCP Server** (`apps/mcp-server`): Node.js/Express service implementing MCP, tools, and widgets
- **Dealer Dashboard** (`apps/dealer-dashboard`): Next.js app for dealers to manage incoming leads
- **Shared Package** (`packages/shared`): Common TypeScript types and schemas across services, including the unified vehicle inventory metafields contract.

---

## Quick Start Guide

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

### Current Operational Snapshot

- **Public MCP URL**: `https://autoagentmcp-server-production.up.railway.app/mcp`
- **Status**: ✅ Server healthy, MCP handshake validated, widgets emitting `ui:ready`
- **Available Tools**: `search-vehicles`, `submit-lead`, `ping-ui`, `ping-micro-ui`

### Environment Setup

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

### Get Your MarketCheck Dealer ID

Before syncing inventory in Drevvy, you need your MarketCheck dealer ID. Follow these steps:

#### Prerequisites
- ✅ Active MarketCheck account with signed contract
- ✅ Data feed must be active (vehicles syncing to MarketCheck)
- ✅ API access enabled (if required by your MarketCheck plan)

#### Finding Your Dealer ID

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

#### What to Enter in Drevvy

- **Dealer ID**: Enter the numeric dealer ID (e.g., `102345`) in the setup form at `/app/setup`
- **ZIP Code** (optional today): Helps refine results for multi-store groups; we're building an automatic rooftop confirmation step that will read the available locations from MarketCheck and let you pick the correct store before syncing.
- **Radius** (optional): Search radius in miles (default: 50) for geographic filtering

> **Note**: The dealer ID is **required** for Drevvy's inventory sync feature. ZIP and radius are optional refinements that help filter results but cannot replace the dealer ID.

### Inventory Sync Workflow (Current State)

- `/app/setup`: Collects MarketCheck dealer ID, optional ZIP, radius, and condition. The "Sync MarketCheck Inventory" button calls the MarketCheck API and stores listings in Supabase (`inventory_vehicles`).
- `/app/inventory`: Shows imported vehicles (VIN, price, mileage, photo). Displays seller comments (from enrichment), highlights option packages, and prefers enriched photos when available. Currently read-only; publishing tools coming later.
- `/app/leads`: Banner updates automatically when inventory sync completes; directs dealers to add billing.
- Settings → Inventory provider: Lets dealers update the MarketCheck dealer ID/ZIP (resets inventory sync state).
- Upcoming work: Billing activation ("Go Live"), additional provider connectors (CDK, vAuto), publish workflow in inventory tab.

### Enrichment

#### Overview
Listing enrichment fetches additional detail data from MarketCheck API endpoints to enhance vehicle listings with seller comments, extended photo galleries, option packages, and dealer metadata.

#### Enabling Enrichment
Set the environment variable in your server environment:
```bash
MARKETCHECK_ENRICH_LISTINGS=1
```

**Where to set:**
- MCP server: Add to `apps/mcp-server/.env` (affects `search-vehicles` tool)
- Dashboard: Add to `apps/dealer-dashboard/.env.local` (affects inventory sync)

#### What Gets Enriched
When enabled, the system fetches:
- **Detail** (`/v2/listing/car/{id}`): Extended listing information
- **Media** (`/v2/listing/car/{id}/media`): Additional photos and video URLs
- **Extra** (`/v2/listing/car/{id}/extra`): Seller comments, option packages, specifications
- **Dealer** (`/v2/dealer/{dealer_id}`): Extended dealer metadata (hours, ratings, etc.)

Merged data appears in:
- Dashboard inventory cards (seller comments, options, enriched photos)
- MCP search responses (ChatGPT can reference seller comments and additional photos)
- Supabase `raw` field (stores original + enriched data for reference)

#### Troubleshooting
Check structured logs for enrichment events:
- `event: 'search_enrichment'` — MCP search enrichment stats (enrichedCount, photosMerged, featuresMerged)
- `event: 'inventory_sync'` — Dashboard sync stats (enrichmentEnabled, enrichedCount, skippedCount)
- `event: 'marketcheck_enrichment_error'` — Individual listing enrichment failures
- `event: 'marketcheck_enrichment_failed'` — Overall enrichment failure for a listing

**Common issues:**
- **No enrichment data**: Verify `MARKETCHECK_ENRICH_LISTINGS=1` is set and check logs for `enrichmentEnabled: true`
- **Partial enrichment**: Some endpoints may fail (404, rate limits); check for `marketcheck_enrichment_error` events
- **Performance**: Enrichment adds ~3-5 seconds per listing; consider rate limiting for large inventories

### Command Reference

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

### Verify the Stack

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

### Troubleshooting Playbook

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

### Before You Ship

- Run `pnpm lint` and `pnpm typecheck`.
- Validate tool and widget responses via the curl commands.
- Update `CHANGELOG.md` if the release surface changes.

---

## System Architecture

The Drevvy platform delivers real-time vehicle discovery, lead capture, and dealer workflow management inside ChatGPT via the Apps SDK and MCP.

### Product Mission

- Help car shoppers browse live MarketCheck inventory without leaving ChatGPT.
- Capture high-quality, encrypted leads and route them directly to dealers.
- Provide dealers with dashboards, analytics, and audit trails around each lead.
- Maintain production-grade reliability so connectors validate on the first attempt.

### Architecture & Stack

| Layer            | Technology                                  | Purpose                                     |
| ---------------- | ------------------------------------------- | ------------------------------------------- |
| Server           | **Node.js + Express**                       | Hosts MCP endpoint, tools, and widget assets |
| MCP              | **OpenAI Apps SDK (JSON-RPC 2.0)**          | ChatGPT ↔ Drevvy communication layer     |
| Database         | **SQLite**                                  | Encrypted lead storage (pluggable backend)  |
| Frontend Widgets | **HTML + Leaflet.js + Vanilla JS**          | Embedded vehicle results UI                 |
| External API     | **MarketCheck**                             | Live vehicle data, dealer metadata          |
| Encryption       | **libsodium (XSalsa20-Poly1305)**           | PII encryption for leads                    |
| Auth             | **Bearer tokens / UA filtering**            | MCP + dashboard access control              |
| Diagnostics      | **Run IDs, beacon + console relays**        | Debugging of ChatGPT iframe lifecycle       |

### Platform Capabilities

#### Vehicle Search (`search-vehicles` tool)
- Accepts natural language-aligned filters (location, condition, price, make, model, radius).
- Normalizes MarketCheck responses into `structuredContent.results`.
- Supplies an iframe component pointing to `ui://vehicle-results.html` for rich UI.

#### Interactive Vehicle Widget
- Leaflet map + responsive bottom sheet of vehicle cards.
- Pin/card linking for VIN context; filter chips and price bubbles.
- Emits `ui:ready` plus diagnostic beacons to satisfy ChatGPT validation.
- Dark-mode styling to match ChatGPT embedding surface.

#### Lead Pipeline (`submit-lead` tool)
- Validates consent, VIN, and contact fields.
- Encrypts payloads via libsodium before writing to SQLite.
- Forwards leads to the dealer dashboard using bearer-protected ingestion endpoint.
- **ADF XML Delivery**: Automatically generates and delivers leads in industry-standard ADF (AutoLead Data Format) XML to dealer-configured CRM endpoints (HTTP or Email). Delivery attempts are logged with status tracking and resend capability.

#### Dealer Dashboard
- Next.js SaaS application for lead review, analytics, onboarding, and status tracking.
- Decrypts payloads when keys are present and enforces bearer authentication.
- Integrated Supabase auth/session helpers power sign-in, profile persistence, and setup state.
- **Lead Delivery Management**: Configure ADF XML delivery settings (HTTP endpoint or Email) in Settings. View delivery status (Success/Failed/Pending) and resend failed deliveries from the Leads Dashboard.

#### In-App Inventory Onboarding
- Responsive dashboard shell with sidebar navigation (`/app/*`) and mobile drawer.
- Banner-driven checklist highlights remaining setup tasks (inventory sync, billing activation).
- `/app/setup` now focuses on MarketCheck: dealers supply their MarketCheck dealer ID (+ optional ZIP/radius/condition) and trigger a Supabase-backed sync that pulls listings into `inventory_vehicles`.
  - **Dealer ID Onboarding**: Dealers must obtain their MarketCheck dealer ID before syncing. Prerequisites include an active MarketCheck account with signed contract, active data feed, and API access (if required). See the "Get Your MarketCheck Dealer ID" section above for detailed instructions.
- Progress updates revalidate the leads dashboard so the banner reflects the latest state, and `/app/inventory` surfaces the imported vehicles for review.
- Vehicle records flow through a single shared metafields schema (identity, pricing/MSRP deltas, mileage, dealer geo, media arrays, market stats, lead tracking) defined in `packages/shared/src/types.ts` and mirrored in Supabase plus MCP responses.
- **Listing Enrichment**: Optional detail enrichment can be enabled via `MARKETCHECK_ENRICH_LISTINGS=1`. When enabled, the sync pipeline fetches additional data from MarketCheck detail endpoints to populate seller comments, extended photo galleries, option packages, and dealer metadata.
- Future providers (CDK, vAuto) will hook into the same flow once credential onboarding is ready.

### Diagnostics & Observability

- **Run IDs** per tool call align logs, beacons, and console output.
- **Beacon endpoint** (`/widget/beacon`) measures iframe readiness timing.
- **Console relay** (`/widget/console`) streams browser logs for support escalations.
- **CSP headers** include `frame-ancestors https://chat.openai.com https://chatgpt.com`.
- **HEAD /mcp** handler satisfies ChatGPT's preliminary handshake.
- `?diag=1` query string toggles verbose widget instrumentation.

### Testing & Verification Tools

| Name              | Purpose                                   | Endpoint                     |
| ----------------- | ----------------------------------------- | ---------------------------- |
| `ping-ui`         | Sanity check widget with bridge orchestration | `/widget/ping`            |
| `ping-micro-ui`   | Minimal iframe for timeout isolation      | `/widget/micro`              |
| `search-vehicles` | Primary MarketCheck UI                   | `/widget/vehicle-results`    |
| `submit-lead`     | Lead submission form                     | `/widget/lead`               |

### Operational Snapshot

- MCP handshake (`initialize`, `tools/list`) is verified and cached for inspection.
- Components pattern compliant: every tool response includes iframe metadata.
- Lead encryption + rate limiting (5 leads/IP/24h) active.
- Diagnostic beacons are flowing; last validation run succeeded (`ui:ready` < 3s).

### Recent Fixes & Regressions Prevented

| Issue                             | Root Cause                                               | Resolution                                                   |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| ChatGPT connector timeouts        | Missing `initialized` + `notification` fields            | Added fields to initialize response and ensured restart      |
| Widget heartbeat failures         | Script crash before emitting readiness events            | Added fallback `heartbeat()` emitter                        |
| CSP rejection of iframe           | `frame-ancestors` directive absent                       | Injected correct CSP headers via Express middleware          |
| Deprecated `_meta` response usage | ChatGPT Apps SDK migrated to `components` pattern        | Refactored tool responses to emit iframe components          |
| Stale server build                | Dev server failing to restart after rebuild              | Documented `pkill` workflow and improved version logging     |

### Key URLs (Current Production)

| Component            | URL                                                                     |
| -------------------- | ----------------------------------------------------------------------- |
| MCP endpoint         | `https://autoagentmcp-server-production.up.railway.app/mcp`                    |
| Vehicle widget       | `https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results` |
| Micro widget         | `https://autoagentmcp-server-production.up.railway.app/widget/micro`           |
| Beacon ingest        | `https://autoagentmcp-server-production.up.railway.app/widget/beacon`          |
| Console relay        | `https://autoagentmcp-server-production.up.railway.app/widget/console`         |
| Dealer dashboard     | `https://autoagentmcp-server-production.up.railway.app/dashboard`              |

### Developer Field Notes

- If ChatGPT connector creation hangs, rerun `initialize` and confirm `initialized: true` plus `notification`.
- Widgets must call `window.openai.ui.ready()` within 3s; check beacon logs if validation fails.
- Update `WIDGET_HOST` any time the ngrok URL changes to keep iframe URLs canonical.
- SQLite is a default storage layer; swap in Postgres/Supabase by reusing the repository interface in `apps/mcp-server`.

### Roadmap & Suggested Initiatives

1. **Dealer onboarding**: capture dealership credentials, support CDK/Homenet feeds.
2. **Feed ingestion pipeline**: recurring jobs to normalize external inventory sources.
3. **Listing enrichment**: hydrate synced vehicles with MarketCheck detail/media/extra payloads once endpoint validation lands.
4. **Rooftop confirmation workflow**: auto-detect MarketCheck locations for a dealer ID, surface the list in `/app/setup`, and have the dealer confirm the correct rooftop/ZIP before running sync.
5. **Persistent database migration**: move from SQLite ➜ Postgres/Supabase with secrets management.
6. **Dashboard enhancements**: filtering, export, and lead lifecycle status tracking.
7. **Dealer authentication**: OAuth/JWT login for multi-tenant access control.
8. **Additional MCP tools**: analytics (`get-dealer-stats`), inventory updates, lead fetch utilities.

---

## Documentation Hub

This hub keeps Cursor/Codex agents oriented. Start here, follow the reading order, and jump to deeper guides as needed.

### Reading Order

1. **Quick Start Checklist** → This document (Quick Start Guide section)  
   Covers environment setup, critical commands, and current deployment endpoints.
2. **System Overview** → This document (System Architecture section)  
   Explains architecture, core features, diagnostics, and current state.
3. **API & MCP Contract** → `docs/03-API-INTEGRATION.md`  
   JSON-RPC methods, schemas, sample payloads, and error handling.
4. **MarketCheck Endpoint Guide** → `docs/03-API-INTEGRATION.md`  
   REST parameters, response shapes, and integration notes for MarketCheck inventory APIs.
5. **Supabase Setup** → `docs/07-DEVELOPMENT-SETUP.md`  
   Defines the tables used by dashboard onboarding (MarketCheck sync, billing banner, inventory listings).

### Current Onboarding Focus

- Inventory sync is currently MarketCheck-only. `/app/setup` triggers a MarketCheck import, `/app/inventory` lists vehicles, and `/app/leads` reflects progress.
- Billing activation and additional DMS connectors (CDK, vAuto) are on deck; check the changelog for the latest roadmap.

### Deployment Guides

- **Production Playbook** → `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`  
  Full-stack production architecture, monitoring, security, CI/CD.
- **Railway Deployment** → `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`  
  Railway-specific configuration, env vars, and verification steps.

### Operations & Support

- **OpenAI Support Evidence Pack** → `docs/09-OPERATIONS-SUPPORT.md`  
  Incident write-up, diagnostic proof, and command log for ChatGPT timeout investigations.

### Suggested Workflow for New Agents

1. Run through the quick start checklist and confirm the MCP server is reachable.
2. Skim the overview to understand the system boundaries and diagnostics.
3. Review the API contract before modifying tools or widgets.
4. Consult deployment docs before touching infrastructure changes.
5. Check the changelog for context on recent work or outstanding initiatives.

---

## Release History

See `CHANGELOG.md` in the repository root for complete release history.

### [Unreleased]

#### Added
- **Universal ADF XML Lead Delivery**: Replaced ad-hoc CRM integrations with industry-standard ADF (AutoLead Data Format) XML delivery system. Dealers configure HTTP endpoint or email delivery in Settings, and all leads are automatically delivered in ADF format compatible with major CRM systems (DealerSocket, CDK, Reynolds & Reynolds, etc.).
- **Lead Delivery Settings**: New settings panel at `/app/settings` for configuring lead delivery method (HTTP endpoint or Email) and target URL/email address.
- **Delivery Logging & Resend**: All delivery attempts are logged in `lead_delivery_logs` table with status, HTTP response, and error details. Failed deliveries can be manually resent from the Leads Dashboard with one click.
- **ADF XML Generator**: Server-side service generates compliant ADF XML payloads with prospect, vehicle, customer, vendor, and provider sections following AutoLead Data Format specification.
- **Enhanced Leads Dashboard**: Updated `/app/leads` page shows delivery status (Success/Failed/Pending) with method indicator, error messages, and resend functionality for failed deliveries.
- Inventory metafields schema shared across MCP, dashboard, and Supabase; includes VIN/stock identifiers, pricing history, media, market data, and lead tracking fields.
- Documentation for core MarketCheck endpoints at `docs/api/marketcheck-endpoints.md`, including request parameters, response fields, and integration checklist.
- Integrated dealer dashboard shell with responsive sidebar/header and reusable navigation components.
- Leads dashboard scaffolding with setup banner that reflects Supabase profile state.
- MarketCheck-powered inventory sync at `/app/setup` with dealer ID/radius controls, Supabase persistence, and real vehicle imports into the new `inventory_vehicles` table.
- Settings panel let dealers update MarketCheck dealer ID/zip.

#### Changed
- Supabase migrations and dashboard inventory view updated to store and surface the expanded metafields (pricing, mileage, media, dealer geo, market stats).
- Onboarding banner now reads dealer state from Supabase and hides once inventory sync and billing are complete.
- Supabase setup documentation updated with new `inventory_connected`, `billing_active`, `dms_provider`, `marketcheck_dealer_id`, and `marketcheck_zip` fields on `profiles`, plus the `inventory_vehicles` table schema.

### [1.0.0] - 2025-10-20

#### 🎉 Initial Release - Production Ready ChatGPT App

**Core Features Implemented**
- MCP Server (Node.js/Express): Full MCP protocol compliance for ChatGPT App integration
- MarketCheck API Integration: Live vehicle inventory with real VINs, pricing, and dealer info
- Lead Management System: Secure PII encryption using libsodium
- Interactive Widget: Zillow-style map interface with vehicle cards
- Dealer Dashboard (Next.js): Lead management and analytics

**Technical Achievements**
- Security & Privacy: End-to-end PII encryption with libsodium
- Performance & Reliability: LRU caching for search results (60s TTL)
- Data Integration: Real MarketCheck API integration

**Production Metrics**
- Search API: ~200ms response time
- Lead submission: <500ms processing
- Widget loading: <1s render time
- Database operations: Sub-second queries

---

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
- ⏳ Billing activation: build "Go Live" flow to flip `billing_active`.
- ⏳ Additional providers: design credential flows for CDK & vAuto once ready; update settings UI to expose provider switching.

---

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

> **📋 Complete Testing Guide**: For a comprehensive smoke test checklist covering environment setup, tunnel configuration, connector registration, test scenarios, and troubleshooting, see `docs/04-TESTING-QUALITY.md`.

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

---

**Related Documentation**:
- API Reference: `docs/03-API-INTEGRATION.md`
- Deployment Guides: `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`
- Testing Guide: `docs/04-TESTING-QUALITY.md`
- MarketCheck Integration: `docs/05-MARKETCHECK-INTEGRATION.md`

