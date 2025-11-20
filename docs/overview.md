# AutoAgent System Overview

The AutoAgent platform delivers real-time vehicle discovery, lead capture, and dealer workflow management inside ChatGPT via the Apps SDK and MCP.

## Product Mission
- Help car shoppers browse live MarketCheck inventory without leaving ChatGPT.
- Capture high-quality, encrypted leads and route them directly to dealers.
- Provide dealers with dashboards, analytics, and audit trails around each lead.
- Maintain production-grade reliability so connectors validate on the first attempt.

## Architecture & Stack
| Layer            | Technology                                  | Purpose                                     |
| ---------------- | ------------------------------------------- | ------------------------------------------- |
| Server           | **Node.js + Express**                       | Hosts MCP endpoint, tools, and widget assets |
| MCP              | **OpenAI Apps SDK (JSON-RPC 2.0)**          | ChatGPT ↔ AutoAgent communication layer     |
| Database         | **SQLite**                                  | Encrypted lead storage (pluggable backend)  |
| Frontend Widgets | **HTML + Leaflet.js + Vanilla JS**          | Embedded vehicle results UI                 |
| External API     | **MarketCheck**                             | Live vehicle data, dealer metadata          |
| Encryption       | **libsodium (XSalsa20-Poly1305)**           | PII encryption for leads                    |
| Auth             | **Bearer tokens / UA filtering**            | MCP + dashboard access control              |
| Diagnostics      | **Run IDs, beacon + console relays**        | Debugging of ChatGPT iframe lifecycle       |

## Platform Capabilities
### Vehicle Search (`search-vehicles` tool)
- Accepts natural language-aligned filters (location, condition, price, make, model, radius).
- Normalizes MarketCheck responses into `structuredContent.results`.
- Supplies an iframe component pointing to `ui://vehicle-results.html` for rich UI.

### Interactive Vehicle Widget
- Leaflet map + responsive bottom sheet of vehicle cards.
- Pin/card linking for VIN context; filter chips and price bubbles.
- Emits `ui:ready` plus diagnostic beacons to satisfy ChatGPT validation.
- Dark-mode styling to match ChatGPT embedding surface.

### Lead Pipeline (`submit-lead` tool)
- Validates consent, VIN, and contact fields.
- Encrypts payloads via libsodium before writing to SQLite.
- Forwards leads to the dealer dashboard using bearer-protected ingestion endpoint.
- **ADF XML Delivery**: Automatically generates and delivers leads in industry-standard ADF (AutoLead Data Format) XML to dealer-configured CRM endpoints (HTTP or Email). Delivery attempts are logged with status tracking and resend capability. See `docs/lead-delivery/adf-payload.md` for details.

### Dealer Dashboard
- Next.js SaaS application for lead review, analytics, onboarding, and status tracking.
- Decrypts payloads when keys are present and enforces bearer authentication.
- Integrated Supabase auth/session helpers power sign-in, profile persistence, and setup state.
- **Lead Delivery Management**: Configure ADF XML delivery settings (HTTP endpoint or Email) in Settings. View delivery status (Success/Failed/Pending) and resend failed deliveries from the Leads Dashboard.

### In-App Inventory Onboarding
- Responsive dashboard shell with sidebar navigation (`/app/*`) and mobile drawer.
- Banner-driven checklist highlights remaining setup tasks (inventory sync, billing activation).
- `/app/setup` now focuses on MarketCheck: dealers supply their MarketCheck dealer ID (+ optional ZIP/radius/condition) and trigger a Supabase-backed sync that pulls listings into `inventory_vehicles`.
  - **Dealer ID Onboarding**: Dealers must obtain their MarketCheck dealer ID before syncing. Prerequisites include an active MarketCheck account with signed contract, active data feed, and API access (if required). See the "Get Your MarketCheck Dealer ID" section in `docs/quickstart.md` for detailed instructions, including how to find the ID in the MarketCheck dashboard and contact information for support.
- Progress updates revalidate the leads dashboard so the banner reflects the latest state, and `/app/inventory` surfaces the imported vehicles for review.
- Vehicle records flow through a single shared metafields schema (identity, pricing/MSRP deltas, mileage, dealer geo, media arrays, market stats, lead tracking) defined in `packages/shared/src/types.ts` and mirrored in Supabase plus MCP responses. See `docs/api/marketcheck-endpoints.md` for request/response details.
- **Listing Enrichment**: Optional detail enrichment can be enabled via `MARKETCHECK_ENRICH_LISTINGS=1`. When enabled, the sync pipeline fetches additional data from MarketCheck detail endpoints (`/v2/listing/car/{id}`, `/v2/listing/car/{id}/media`, `/v2/listing/car/{id}/extra`, `/v2/dealer/{dealer_id}`) to populate seller comments, extended photo galleries, option packages, and dealer metadata. Enrichment is best-effort; failures are logged but don't block sync. The dashboard inventory page displays seller comments (truncated with tooltip), highlights option packages, and prefers enriched photos when available. MCP search responses include merged enrichment data for ChatGPT reference. See "Enrichment" section in `quickstart.md` for configuration and troubleshooting.
- Future providers (CDK, vAuto) will hook into the same flow once credential onboarding is ready.

## Diagnostics & Observability
- **Run IDs** per tool call align logs, beacons, and console output.
- **Beacon endpoint** (`/widget/beacon`) measures iframe readiness timing.
- **Console relay** (`/widget/console`) streams browser logs for support escalations.
- **CSP headers** include `frame-ancestors https://chat.openai.com https://chatgpt.com`.
- **HEAD /mcp** handler satisfies ChatGPT’s preliminary handshake.
- `?diag=1` query string toggles verbose widget instrumentation.

## Testing & Verification Tools
| Name              | Purpose                                   | Endpoint                     |
| ----------------- | ----------------------------------------- | ---------------------------- |
| `ping-ui`         | Sanity check widget with bridge orchestration | `/widget/ping`            |
| `ping-micro-ui`   | Minimal iframe for timeout isolation      | `/widget/micro`              |
| `search-vehicles` | Primary MarketCheck UI                   | `/widget/vehicle-results`    |
| `submit-lead`     | Lead submission form                     | `/widget/lead`               |

## Operational Snapshot
- MCP handshake (`initialize`, `tools/list`) is verified and cached for inspection.
- Components pattern compliant: every tool response includes iframe metadata.
- Lead encryption + rate limiting (5 leads/IP/24h) active.
- Diagnostic beacons are flowing; last validation run succeeded (`ui:ready` < 3s).

## Recent Fixes & Regressions Prevented
| Issue                             | Root Cause                                               | Resolution                                                   |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| ChatGPT connector timeouts        | Missing `initialized` + `notification` fields            | Added fields to initialize response and ensured restart      |
| Widget heartbeat failures         | Script crash before emitting readiness events            | Added fallback `heartbeat()` emitter                        |
| CSP rejection of iframe           | `frame-ancestors` directive absent                       | Injected correct CSP headers via Express middleware          |
| Deprecated `_meta` response usage | ChatGPT Apps SDK migrated to `components` pattern        | Refactored tool responses to emit iframe components          |
| Stale server build                | Dev server failing to restart after rebuild              | Documented `pkill` workflow and improved version logging     |

## Key URLs (Current ngrok Session)
| Component            | URL                                                                     |
| -------------------- | ----------------------------------------------------------------------- |
| MCP endpoint         | `https://autoagentmcp-server-production.up.railway.app/mcp`                    |
| Vehicle widget       | `https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results` |
| Micro widget         | `https://autoagentmcp-server-production.up.railway.app/widget/micro`           |
| Beacon ingest        | `https://autoagentmcp-server-production.up.railway.app/widget/beacon`          |
| Console relay        | `https://autoagentmcp-server-production.up.railway.app/widget/console`         |
| Dealer dashboard     | `https://autoagentmcp-server-production.up.railway.app/dashboard`              |

## Developer Field Notes
- If ChatGPT connector creation hangs, rerun `initialize` and confirm `initialized: true` plus `notification`.
- Widgets must call `window.openai.ui.ready()` within 3s; check beacon logs if validation fails.
- Update `WIDGET_HOST` any time the ngrok URL changes to keep iframe URLs canonical.
- SQLite is a default storage layer; swap in Postgres/Supabase by reusing the repository interface in `apps/mcp-server`.

## Roadmap & Suggested Initiatives
1. **Dealer onboarding**: capture dealership credentials, support CDK/Homenet feeds.
2. **Feed ingestion pipeline**: recurring jobs to normalize external inventory sources.
3. **Listing enrichment**: hydrate synced vehicles with MarketCheck detail/media/extra payloads once endpoint validation lands.
4. **Rooftop confirmation workflow**: auto-detect MarketCheck locations for a dealer ID, surface the list in `/app/setup`, and have the dealer confirm the correct rooftop/ZIP before running sync.
5. **Persistent database migration**: move from SQLite ➜ Postgres/Supabase with secrets management.
6. **Dashboard enhancements**: filtering, export, and lead lifecycle status tracking.
7. **Dealer authentication**: OAuth/JWT login for multi-tenant access control.
8. **Additional MCP tools**: analytics (`get-dealer-stats`), inventory updates, lead fetch utilities.

Stay aligned with the quick start checklist (`quickstart.md`) before diving into code changes, and consult deployment guides for infrastructure updates.
