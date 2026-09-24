# Drevvy Current Architecture

Audit date: 2026-09-24. This document records what is in the repository today. It does not propose new services. The target data platform is in [DREVVY_DATA_PLATFORM_NORTH_STAR.md](DREVVY_DATA_PLATFORM_NORTH_STAR.md). The gap against the consumer PRD is in [DREVVY_GAP_ANALYSIS.md](DREVVY_GAP_ANALYSIS.md). The build order is in [DREVVY_IMPLEMENTATION_PLAN.md](DREVVY_IMPLEMENTATION_PLAN.md).

The product name in the README is Drevvy. The git repository, root `package.json` name, and several hostnames still say AutoAgent. See the naming classification at the end of this document. Bundle identifiers, API routes, and environment variable names are left unchanged.

## Repository map

| Path | Role |
| --- | --- |
| [apps/autogentic](../apps/autogentic) | Consumer SwiftUI iOS app. Xcode target `Autogentic`. In-app title is Drevvy. |
| [apps/drevvy-dealer](../apps/drevvy-dealer) | Dealer SwiftUI iOS app. Display name `Drevvy Dealer`. Bundle id `com.drevvy.dealer`. |
| [apps/autoagent-app](../apps/autoagent-app) | ChatGPT Apps SDK `manifest.json` only. Not an iOS project. |
| [apps/dealer-dashboard](../apps/dealer-dashboard) | Next.js dealer dashboard and the HTTP API the consumer app calls. Deployed on Vercel. |
| [apps/mcp-server](../apps/mcp-server) | Express MCP server for ChatGPT tools, widgets, and inventory ingest. Deployed on Railway. |
| [packages/shared](../packages/shared) | Shared TypeScript types, including the Unified Vehicle Schema. |
| [apps/dealer-dashboard/supabase/migrations](../apps/dealer-dashboard/supabase/migrations) | Postgres schema. Supabase is the only operational database. |

There is no second consumer Xcode project. There is no ClickHouse, object event lake, message queue, or dedicated search engine in this repo.

## Runtime shape

```text
Autogentic iOS  ---- POST /api/query/chat-search ----+
                                                     |
ChatGPT ---- MCP tools -----------------------------+-->  dealer-dashboard (Vercel)
                                                     |         |
Drevvy Dealer iOS -- /api/dealer/v1 (prepared) -----+         +--> Supabase Postgres
                                                               |
MCP server (Railway) -- search + submit-lead + ingest ---------+
        |
        +--> MarketCheck MCP / REST
        +--> uvs_vehicles (ingest)
```

Two search implementations exist today. They are not a shared ranker.

- Consumer and dashboard search: [apps/dealer-dashboard/src/app/api/query/chat-search/route.ts](../apps/dealer-dashboard/src/app/api/query/chat-search/route.ts), [apps/dealer-dashboard/src/app/api/inventory/search/route.ts](../apps/dealer-dashboard/src/app/api/inventory/search/route.ts), MarketCheck adapter [apps/dealer-dashboard/src/lib/marketcheck/mcp-adapter.ts](../apps/dealer-dashboard/src/lib/marketcheck/mcp-adapter.ts).
- ChatGPT search: [apps/mcp-server/src/tools/searchVehicles.ts](../apps/mcp-server/src/tools/searchVehicles.ts), selected by `INVENTORY_SEARCH_PROVIDER` in [apps/mcp-server/src/config/env.ts](../apps/mcp-server/src/config/env.ts) (`marketcheck_mcp` or `uvs`).

## Consumer iOS — Autogentic

Open [apps/autogentic/Autogentic.xcodeproj](../apps/autogentic/Autogentic.xcodeproj). Product `Autogentic.app`. Bundle identifier in the project is the placeholder `com..Autogentic` (`PRODUCT_BUNDLE_IDENTIFIER` in `project.pbxproj`). That value is documented here and is not changed in this audit.

| Piece | Path |
| --- | --- |
| App entry | [AutogenticApp.swift](../apps/autogentic/Autogentic/AutogenticApp.swift) |
| Shell, sidebar, composer | [ContentView.swift](../apps/autogentic/Autogentic/ContentView.swift) |
| Thread | [ChatView.swift](../apps/autogentic/Autogentic/Core%20Views/ChatView.swift) |
| Composer | [InputBarView.swift](../apps/autogentic/Autogentic/Core%20Views/InputBarView.swift) |
| In-chat map and cards | [MapToolView.swift](../apps/autogentic/Autogentic/Core%20Views/MapToolView.swift), [VehicleCardCarousel.swift](../apps/autogentic/Autogentic/Core%20Views/VehicleCardCarousel.swift) |
| Detail | [VehicleDetailView.swift](../apps/autogentic/Autogentic/Core%20Views/VehicleDetailView.swift) |
| Chat orchestration | [ChatViewModel.swift](../apps/autogentic/Autogentic/ViewModels/ChatViewModel.swift) |
| Map and location | [MapViewModel.swift](../apps/autogentic/Autogentic/ViewModels/MapViewModel.swift) |
| Message model | [Message.swift](../apps/autogentic/Autogentic/Models/Message.swift) |
| API hosts and key | [Config.swift](../apps/autogentic/Autogentic/Models/Config.swift) |

The sidebar title is `Drevvy`. Tabs are Chat, Market Scan, Saved Vehicles, My Deals, and Profile. Saved Vehicles, My Deals, and Profile render `PlaceholderTabView`. Chat is the live surface.

`Message.Role` is `user`, `assistant`, or `tool`. The only tool kind is `map`. There are no typed blocks for offers, approvals, dealer messages, or negotiation updates. Messages live in memory on the device. There is no conversation table and no streaming client.

Search path:

1. [ChatSearchService.swift](../apps/autogentic/Autogentic/Services/ChatSearchService.swift) posts to `POST /api/query/chat-search`.
2. Fallback is [QueryParseService.swift](../apps/autogentic/Autogentic/Services/QueryParseService.swift) (`POST /api/query/parse`) then [InventoryAPIService.swift](../apps/autogentic/Autogentic/Services/InventoryAPIService.swift) (`POST /api/inventory/search`).
3. Detail is [VehicleDetailService.swift](../apps/autogentic/Autogentic/Services/VehicleDetailService.swift) (`GET /api/inventory/detail/{listingId}`).

All four URLs are hardcoded to `https://autoagent-dealer-dashboard.vercel.app` in `Config`. The request credential is `INVENTORY_SEARCH_API_KEY`, read from the app Info.plist, build settings, or the process environment. There is no Sign in with Apple, no Keychain session, and no consumer `auth.users` row created by the app. Location uses `CLLocationManager` when-in-use.

Contact Dealer and Schedule Test Drive in `VehicleDetailView` have empty actions. Saved vehicles are not persisted.

## ChatGPT channel

[apps/autoagent-app/manifest.json](../apps/autoagent-app/manifest.json) is the Apps SDK manifest. The dashboard serves it from the app-manifest route. The MCP server exposes three tools in [apps/mcp-server/src/mcp-simple.ts](../apps/mcp-server/src/mcp-simple.ts):

- `render-vehicle-results-v2`
- `get-vehicle-details`
- `submit-lead`

Older names such as `search-vehicles` appear in the root README and the manifest notes. The live `tools/list` implementation uses the three names above. Lead submission follows [docs/lead_tool_contract.md](lead_tool_contract.md) and [apps/mcp-server/src/tools/submitLead.ts](../apps/mcp-server/src/tools/submitLead.ts). Widgets live under [apps/mcp-server/src/ui](../apps/mcp-server/src/ui).

ChatGPT callers are not end-user authenticated. CORS allows ChatGPT origins. Shopper contact data for a quote is encrypted into `leads.enc_payload` and delivered as ADF. That path is the legacy lead pipeline, separate from any future agent negotiation.

## Dealer iOS — Drevvy Dealer

[apps/drevvy-dealer/DrevvyDealer.xcodeproj](../apps/drevvy-dealer/DrevvyDealer.xcodeproj). Display name `Drevvy Dealer`. Bundle id `com.drevvy.dealer`. Push entitlement file: [DrevvyDealer.entitlements](../apps/drevvy-dealer/DrevvyDealer/DrevvyDealer.entitlements).

| Piece | Path |
| --- | --- |
| Entry and push delegate | [DrevvyDealerApp.swift](../apps/drevvy-dealer/DrevvyDealer/DrevvyDealerApp.swift) |
| Tabs | [AppShell.swift](../apps/drevvy-dealer/DrevvyDealer/App/AppShell.swift) — Overview, Leads, Analytics, Inventory, Account |
| State | [AppStore.swift](../apps/drevvy-dealer/DrevvyDealer/App/AppStore.swift) |
| Live client | [DealerAPI.swift](../apps/drevvy-dealer/DrevvyDealer/Services/DealerAPI.swift) — `LiveDealerAPI` |
| Demo data | [DemoDealerAPI.swift](../apps/drevvy-dealer/DrevvyDealer/Services/DemoDealerAPI.swift) |
| Models | [DealerModels.swift](../apps/drevvy-dealer/DrevvyDealer/Models/DealerModels.swift) |
| Push registration | [NotificationManager.swift](../apps/drevvy-dealer/DrevvyDealer/Notifications/NotificationManager.swift) |

`AppStore.init()` assigns `DemoDealerAPI()`. `LiveDealerAPI` already implements `dealerships`, `dashboard`, `leads`, `inventory`, `updateLead`, `resendLead`, and `registerDeviceToken` against `/api/dealer/v1/*`. The production initializer does not use it. Account sign-out is disabled in the demo shell. There is no negotiation thread or structured-offer composer.

## Dealer dashboard

Next.js app under [apps/dealer-dashboard/src/app](../apps/dealer-dashboard/src/app).

| Surface | Path |
| --- | --- |
| Marketing | `/` |
| Dealer auth | `/auth` — email and password via Supabase |
| App shell | `/app/*`, guarded by [middleware.ts](../apps/dealer-dashboard/src/middleware.ts) |
| Leads | `/app/leads` |
| Inventory | `/app/inventory` |
| Analytics | `/app/analytics` |
| Settings, billing, setup | `/app/settings`, `/app/billing`, `/app/setup` |
| Platform admin | `/app/admin/overview`, `/app/admin/leads`, `/app/admin/sessions` |

Dealer mobile HTTP API:

| Route | File |
| --- | --- |
| `POST/GET` bootstrap | [api/dealer/v1/bootstrap/route.ts](../apps/dealer-dashboard/src/app/api/dealer/v1/bootstrap/route.ts) |
| Overview | [api/dealer/v1/dealerships/[dealershipId]/overview/route.ts](../apps/dealer-dashboard/src/app/api/dealer/v1/dealerships/[dealershipId]/overview/route.ts) |
| Leads | [api/dealer/v1/dealerships/[dealershipId]/leads/route.ts](../apps/dealer-dashboard/src/app/api/dealer/v1/dealerships/[dealershipId]/leads/route.ts) |
| Lead status | [api/dealer/v1/leads/[leadId]/status/route.ts](../apps/dealer-dashboard/src/app/api/dealer/v1/leads/[leadId]/status/route.ts) |
| Resend ADF | [api/dealer/v1/leads/[leadId]/resend/route.ts](../apps/dealer-dashboard/src/app/api/dealer/v1/leads/[leadId]/resend/route.ts) |
| Inventory | [api/dealer/v1/dealerships/[dealershipId]/inventory/route.ts](../apps/dealer-dashboard/src/app/api/dealer/v1/dealerships/[dealershipId]/inventory/route.ts) |
| Device token | [api/dealer/v1/devices/route.ts](../apps/dealer-dashboard/src/app/api/dealer/v1/devices/route.ts) |

Bearer auth for that API is [apps/dealer-dashboard/src/lib/dealer-mobile/auth.ts](../apps/dealer-dashboard/src/lib/dealer-mobile/auth.ts). Rooftop membership is `user_dealerships`.

Consumer-facing routes on the same Next app, authorized by the shared `INVENTORY_SEARCH_API_KEY`:

- `POST /api/query/chat-search`
- `POST /api/query/parse`
- `POST /api/inventory/search`
- `GET /api/inventory/detail/[id]`

Natural-language parsing uses [apps/dealer-dashboard/src/lib/query/parse-inventory-query.ts](../apps/dealer-dashboard/src/lib/query/parse-inventory-query.ts). `chat-search` parses the query, searches, and returns an assistant string in one response. It does not persist a conversation.

Lead ingest from MCP: `POST /api/ingest/lead` ([route](../apps/dealer-dashboard/src/app/api/ingest/lead/route.ts)), bearer `DASHBOARD_INGEST_TOKEN`. Delivery worker: `POST /api/cron/lead-delivery`, scheduled in [vercel.json](../apps/dealer-dashboard/vercel.json) every 15 minutes. Nightly inventory ingest cron: `/api/ingest/nightly` at 02:00 UTC.

There is no dealer-shopper message thread, no offer resource, and no Supabase Realtime subscription in application code. Lead delivery is ADF over HTTP or email ([docs/lead-delivery/adf-payload.md](lead-delivery/adf-payload.md), [apps/dealer-dashboard/src/lib/lead-delivery.ts](../apps/dealer-dashboard/src/lib/lead-delivery.ts)).

## MCP server and MarketCheck

Railway service built from the repo [Dockerfile](../Dockerfile) and [railway.json](../railway.json). Production hostname referenced in docs and scripts: `autoagentmcp-server-production.up.railway.app`.

| Concern | Path |
| --- | --- |
| HTTP entry | [apps/mcp-server/src/index.ts](../apps/mcp-server/src/index.ts) — `/mcp`, `/health`, `/api/ingest/*`, widgets |
| Live search | [searchVehicles.ts](../apps/mcp-server/src/tools/searchVehicles.ts) → [marketcheckMcpClient.ts](../apps/mcp-server/src/services/marketcheckMcpClient.ts) tool `search_active_cars` |
| Normalizer | [marketcheckMcpNormalizer.ts](../apps/mcp-server/src/services/marketcheckMcpNormalizer.ts) |
| Legacy REST client | [marketcheck.ts](../apps/mcp-server/src/services/marketcheck.ts) |
| Dealer syndication ingest | [ingest.ts](../apps/mcp-server/src/api/ingest.ts) `POST /api/ingest/marketcheck/fetch-and-ingest` |
| UVS read path when provider is `uvs` | [apps/mcp-server/src/db/uvs-vehicles.ts](../apps/mcp-server/src/db/uvs-vehicles.ts) |

`INVENTORY_SEARCH_PROVIDER` is a process environment switch, not a per-request `inventory_mode` flag of `hybrid | uvs_preferred | uvs_only`. The server does not query UVS and MarketCheck together, dedupe by VIN, or boost onboarded rooftops inside one ranking pass.

MarketCheck credentials stay on the server (`MARKETCHECK_API_KEY`, `MARKETCHECK_MCP_AUTH_TOKEN`). They are not in the iOS targets.

## UVS and dealerships

UVS is the provider-agnostic vehicle document. Types: [packages/shared/src/uvs.ts](../packages/shared/src/uvs.ts). Narrative: [docs/architecture/uvs.md](architecture/uvs.md). Table: `uvs_vehicles`, created in [20250228_create_uvs_vehicles.sql](../apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql).

The primary key is `uvs_vehicles.id` (text, source-prefixed such as `mc-…`). `vin` is indexed and is not the universal key. `data_source` records provenance (`marketcheck-api`, `csv-import`, `dealer-api`, and similar). `dealer_id` on the vehicle row is the upstream dealer identifier, often a MarketCheck dealer id.

Commercial rooftops are `dealerships` ([20250223_create_dealerships.sql](../apps/dealer-dashboard/supabase/migrations/20250223_create_dealerships.sql)), with unique `marketcheck_dealer_id`. Membership is `user_dealerships`. A listing can be MarketCheck-originated and still match an onboarded rooftop when `uvs_vehicles.dealer_id` equals `dealerships.marketcheck_dealer_id`. That join already appears in [20260911_uvs_vin_rooftop.sql](../apps/dealer-dashboard/supabase/migrations/20260911_uvs_vin_rooftop.sql). Source and commercial relationship are different columns and tables. Search ranking does not yet use that distinction.

Legacy per-user stash: `inventory_vehicles` ([20250220_create_inventory_vehicles.sql](../apps/dealer-dashboard/supabase/migrations/20250220_create_inventory_vehicles.sql)). New canonical work uses `uvs_vehicles`.

## Authentication

| Actor | Mechanism | Where |
| --- | --- | --- |
| Dealer web | Supabase email/password, cookie session | `/auth`, [middleware.ts](../apps/dealer-dashboard/src/middleware.ts) |
| Dealer tenancy | `user_dealerships`, RLS, `private.user_has_dealer_access` | migrations and [dealerships.ts](../apps/dealer-dashboard/src/lib/supabase/dealerships.ts) |
| Platform admin | `profiles.platform_role` | [20260716_add_platform_admin_and_honda_cars_rooftop.sql](../apps/dealer-dashboard/supabase/migrations/20260716_add_platform_admin_and_honda_cars_rooftop.sql) |
| Dealer iOS | Supabase JWT bearer on `/api/dealer/v1` | [dealer-mobile/auth.ts](../apps/dealer-dashboard/src/lib/dealer-mobile/auth.ts). The shipping app still uses demo data. |
| Consumer iOS and public inventory routes | Shared `INVENTORY_SEARCH_API_KEY` | `Config.swift` and the query/inventory route handlers |
| MCP ingest and lead forward | `INGESTION_API_TOKEN`, `DASHBOARD_INGEST_TOKEN` | server env |
| ChatGPT shopper | No Drevvy consumer account | — |

Dealer profiles live in `profiles` ([20250219_add_profiles_table.sql](../apps/dealer-dashboard/supabase/migrations/20250219_add_profiles_table.sql)). There is no consumer profile, shopper alias, or Sign in with Apple flow.

## Leads, the current dealer inbox

`leads` ([20250127_create_leads_table.sql](../apps/dealer-dashboard/supabase/migrations/20250127_create_leads_table.sql)) stores `enc_payload` (libsodium), `vin`, `vehicle_id`, `dealer_id`, and `consent`. Status values in [20250127_add_leads_status.sql](../apps/dealer-dashboard/supabase/migrations/20250127_add_leads_status.sql): `new`, `contacted`, `qualified`, `closed`, `test_drive_booked`.

Later columns in [20260723_marketcheck_nationwide_platform_ops.sql](../apps/dealer-dashboard/supabase/migrations/20260723_marketcheck_nationwide_platform_ops.sql): `inventory_source` (`uvs_db` or `marketcheck_mcp`), `routing_status` (`platform_inbox`, `dealer_assigned`, `routed`, `archived`), `vehicle_snapshot`, `external_listing_id`, `flow_id`.

Delivery log tables: `lead_delivery_logs`, `lead_delivery_jobs`. This pipeline sends shopper contact information to a dealer CRM. It is the legacy quote path. It is not a negotiation case, and it is not a stand-in for a PII-free agent thread.

## Database objects that exist

| Table | Migration | Used for |
| --- | --- | --- |
| `profiles` | `20250219_add_profiles_table.sql` | Dealer user profile |
| `dealerships`, `user_dealerships`, `user_preferences` | `20250223_create_dealerships.sql` | Rooftops and membership |
| `inventory_vehicles` | `20250220_create_inventory_vehicles.sql` | Legacy onboarding inventory |
| `uvs_vehicles` | `20250228_create_uvs_vehicles.sql` | Canonical stored listings |
| `leads` | `20250127_create_leads_table.sql` | Encrypted quote leads |
| `lead_delivery_logs` | `20250221_create_lead_delivery_logs.sql` | ADF delivery |
| `demo_requests` | `20250222_create_demo_requests.sql` | Marketing demo form |
| `analytics_sessions`, `analytics_events`, `analytics_vehicle_snapshots` | `20250301_create_analytics_tables.sql` | Dealer/product analytics |
| `mc_api_usage` | `20260403_create_mc_api_usage.sql` | MarketCheck usage |
| `app_sessions`, `app_events` | `20260723_marketcheck_nationwide_platform_ops.sql` | ChatGPT flow observability |
| `dealership_billing_accounts`, `dealer_mobile_devices` | `20260915_dealer_mobile_api_support.sql` | Billing and dealer push tokens |

Tables that do not exist: `conversations`, `conversation_messages`, `saved_vehicles`, `shopper_aliases`, `negotiation_cases`, `shopper_mandates`, `negotiation_policies`, `negotiation_state_events`, `vehicle_market_contexts`, `message_threads`, `messages`, `offers`, `offer_line_items`, `approval_requests`, `agent_actions`.

## Events already stored

`analytics_events` ([20250301_create_analytics_tables.sql](../apps/dealer-dashboard/supabase/migrations/20250301_create_analytics_tables.sql)):

- `id` (text), `session_id`, `event_name`, `source` (`mcp-server`, `dashboard`, `widget`, `system`), `dealer_id` (MarketCheck dealer id), `vehicle_id`, `vin`, `user_id`, `payload` jsonb, `timestamp`.
- Known names include `vehicle.view`, `vehicle.click`, `vehicle.compare`, `lead.submit`, `lead.view`, and dashboard inventory/settings events.
- `ip_address` and `user_agent` were intentionally omitted.

`app_events` ([20260723_marketcheck_nationwide_platform_ops.sql](../apps/dealer-dashboard/supabase/migrations/20260723_marketcheck_nationwide_platform_ops.sql)):

- `id` uuid, `flow_id` → `app_sessions.id`, `event_name`, `source` (`mcp-server`, `widget`, `dashboard`, `system`), `provider`, `tool_name`, `dealer_id`, `vehicle_id`, `vin`, `payload`, `occurred_at`.
- Readable by platform admins. Inserts from `anon` and `authenticated` are revoked.

These two tables are the current event stores. They do not yet use one envelope, and they have no `negotiation_case_id`, `conversation_id`, or `consumer_user_id` distinct from dealer `user_id`. The North Star maps them forward. This audit does not add a third table.

## Deploy targets

| Workload | Host | Config |
| --- | --- | --- |
| Dealer dashboard and consumer HTTP API | Vercel | [apps/dealer-dashboard/vercel.json](../apps/dealer-dashboard/vercel.json). Preview host `autoagent-dealer-dashboard.vercel.app`. |
| MCP, ingest, ChatGPT tools | Railway | [railway.json](../railway.json), [Dockerfile](../Dockerfile), [.github/workflows/deploy-railway.yml](../.github/workflows/deploy-railway.yml) |
| Operational data | Supabase Postgres | migrations under `apps/dealer-dashboard/supabase/migrations` |

Vercel crons in `vercel.json` run nightly MarketCheck ingest and lead delivery. Those are HTTP cron hits on the Next app, not separate Railway workers.

## Naming classification

Search terms: `AutoAgent`, `autoagent`, `Autogentic`.

| Kind | Examples | Change in this audit |
| --- | --- | --- |
| UI label | Sidebar text `Drevvy` in `ContentView.swift`. Dealer display name `Drevvy Dealer`. | Already Drevvy. No rename. |
| Xcode target / internal symbol | Target `Autogentic`, types under that module. | Leave. A user-facing rename does not require renaming the target. |
| Package name | Root `package.json` `"name": "autoagent"`. Workspace packages `@autoagent/shared`, `@autoagent/dealer-dashboard`. | Internal identifier. Leave. |
| Hostname / third-party | `autoagent-dealer-dashboard.vercel.app`, `autoagentmcp-server-production.up.railway.app`, comments and docs that still say AutoAgent. | Document only. |
| Bundle / signing | `com..Autogentic` (placeholder). `com.drevvy.dealer` (real). | Do not edit. |
| API route | `/api/inventory/*`, `/api/query/*`, `/api/dealer/v1/*`, `/api/ingest/*`. | Leave. |
| Environment variable | `INVENTORY_SEARCH_API_KEY`, `MARKETCHECK_API_KEY`, `INVENTORY_SEARCH_PROVIDER`, `DASHBOARD_INGEST_TOKEN`. | Leave. |
| Database value | `dealerships.marketcheck_dealer_id`, `leads.inventory_source` values `uvs_db` and `marketcheck_mcp`. | Leave. |

## What this architecture is not

The repo can search inventory, ingest UVS rows, capture an encrypted lead, and show that lead to a dealer. It cannot yet run a shopper-authenticated conversation, a PII-free negotiation, a shared dealer message thread, a structured offer, or a server-side hybrid ranker used by both ChatGPT and the iPhone app.
