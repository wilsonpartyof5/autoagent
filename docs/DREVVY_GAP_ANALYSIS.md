# Drevvy Gap Analysis

Compared against the Drevvy iOS + Agent Negotiation Platform PRD on 2026-09-24. Evidence is the current tree described in [DREVVY_CURRENT_ARCHITECTURE.md](DREVVY_CURRENT_ARCHITECTURE.md).

Status values:

- **existing** — the requirement is already met in a form later phases can extend.
- **partial** — a related surface exists, and the PRD behavior is not met.
- **missing** — no implementation to extend.

## Product goal

| Requirement | Status | Evidence |
| --- | --- | --- |
| Conversational vehicle search on iOS | partial | [ChatView.swift](../apps/autogentic/Autogentic/Core%20Views/ChatView.swift) and `POST /api/query/chat-search`. One-shot reply plus map cards. No persisted thread, no streaming. |
| Real inventory in the reply | partial | MarketCheck-backed search on the dashboard and MCP. Not a single hybrid UVS + MarketCheck ranker. |
| Save and compare | missing | Saved Vehicles and compare are sidebar or intent placeholders. No `saved_vehicles` table. |
| Hand the dealer interaction to an agent | missing | Contact Dealer in [VehicleDetailView.swift](../apps/autogentic/Autogentic/Core%20Views/VehicleDetailView.swift) is an empty action. |
| Shopper mandate and approvals | missing | No mandate or approval tables. |
| Dealer sees the vehicle and non-PII requirements | missing | Dealers receive ADF leads that include shopper contact data (`leads.enc_payload`). |
| Dealer replies through Drevvy | missing | No message thread. Delivery is ADF email/HTTP. |
| Structured offers | missing | No offer schema. |
| Backend owns routing, messaging, rules, LLM calls, privacy | partial | MarketCheck keys and LLM parse calls are server-side. Negotiation policy, messaging, and privacy aliasing are absent. The iOS app holds `INVENTORY_SEARCH_API_KEY`. |

## Inventory

| Requirement | Status | Evidence |
| --- | --- | --- |
| UVS as canonical stored inventory | existing | `uvs_vehicles` and [packages/shared/src/uvs.ts](../packages/shared/src/uvs.ts). |
| MarketCheck nationwide coverage | existing | MCP `search_active_cars` and dashboard live search. |
| One canonical search service for ChatGPT and iOS | missing | MCP [searchVehicles.ts](../apps/mcp-server/src/tools/searchVehicles.ts) and dashboard [chat-search/route.ts](../apps/dealer-dashboard/src/app/api/query/chat-search/route.ts) are separate stacks. |
| Normalize both sources to one response shape at search time | partial | Each stack normalizes its own provider. They do not merge. |
| Dedupe by VIN, prefer UVS row | missing | No cross-source merge. |
| Source separate from onboarded rooftop | partial | `uvs_vehicles.data_source` vs `dealerships.marketcheck_dealer_id` already allow the join ([20260911_uvs_vin_rooftop.sql](../apps/dealer-dashboard/supabase/migrations/20260911_uvs_vin_rooftop.sql)). Ranking does not use it. |
| Relevance before Drevvy-dealer boost | missing | No shared ranker. |
| Server flag `inventory_mode` = `hybrid` / `uvs_preferred` / `uvs_only` | missing | MCP env `INVENTORY_SEARCH_PROVIDER` is `marketcheck_mcp` or `uvs` only ([env.ts](../apps/mcp-server/src/config/env.ts)). Changing it is an ops switch, not a hybrid mode, and the iOS app cannot follow it without a release if the client starts branching on provider. |
| iOS never holds MarketCheck credentials | existing | Keys stay on Vercel and Railway. The shared inventory API key is a different problem, covered under auth. |

## Consumer iOS UX

| Requirement | Status | Evidence |
| --- | --- | --- |
| SwiftUI conversation shell | existing | [ContentView.swift](../apps/autogentic/Autogentic/ContentView.swift). |
| History menu | partial | Sidebar exists. History is not loaded from the server. |
| New chat | partial | Local thread only. |
| Composer | existing | [InputBarView.swift](../apps/autogentic/Autogentic/Core%20Views/InputBarView.swift). |
| Streaming assistant response | missing | `chat-search` returns one JSON body. |
| Vehicle cards in the thread | existing | [VehicleCardCarousel.swift](../apps/autogentic/Autogentic/Core%20Views/VehicleCardCarousel.swift) inside the map tool. |
| Vehicle detail | partial | [VehicleDetailView.swift](../apps/autogentic/Autogentic/Core%20Views/VehicleDetailView.swift) shows listing fields the API returns. Price history, market position, and the two dealer CTAs are not wired. |
| Saved vehicles | missing | `PlaceholderTabView`. |
| Active deals | missing | My Deals placeholder. |
| Account and settings | missing | Profile placeholder. No auth. |
| Push for deals | missing | No consumer push token table. Dealer app has an entitlement and `dealer_mobile_devices`. |
| Typed message blocks (`vehicleCarousel`, `offerCard`, `approvalRequest`, and the rest) | partial | `Message` supports `user`, `assistant`, and `tool(map)` only ([Message.swift](../apps/autogentic/Autogentic/Models/Message.swift)). |

## Search journey and vehicle detail

| Requirement | Status | Evidence |
| --- | --- | --- |
| Server-side intent to search criteria | partial | [parse-inventory-query.ts](../apps/dealer-dashboard/src/lib/query/parse-inventory-query.ts) and client [IntentInterpreter.swift](../apps/autogentic/Autogentic/Services/IntentInterpreter.swift). |
| Follow-up refinements in one conversation | partial | `chat-search` accepts previous filters. Context is not stored server-side. |
| Compare, save, "best value" as first-class results | missing | No comparison block or saved set. |
| Detail fields: VIN, price, mileage, colors, images, dealer, distance | partial | Returned when the provider payload includes them. |
| Days on market, price history, market positioning | partial | UVS can store `days_on_market` and price history inside `uvs_data`. Live MarketCheck search does not expose a `VehicleMarketContext`. |
| Never invent unavailable fields | partial | Dependent on each renderer. No shared contract that forbids filled-in gaps. |

## Negotiation, privacy, and messaging

| Requirement | Status | Evidence |
| --- | --- | --- |
| Shopper mandate before dealer contact | missing | — |
| Shopper alias (`Drevvy Shopper #…`) | missing | — |
| Dealer does not receive phone, email, or address | missing | ADF lead payload is the opposite: contact delivery is the product. |
| Backend enforces redaction, not the LLM | missing | No agent write path to redact. |
| Negotiation state machine and transition log | missing | Lead status enum is `new`, `contacted`, `qualified`, `closed`, `test_drive_booked` only. |
| Split of state, rules, market intel, LLM language, approval, dealer comms, audit | missing | — |
| `VehicleMarketContext` service | missing | — |
| Negotiation behavior and first-contact template | missing | — |
| `ApprovalRequest` before binding actions | missing | — |
| Shared thread for dashboard and Drevvy Dealer | missing | — |
| Actors shopper, dealer, agent, system | missing | — |
| Visibility shopper, dealer, both, internal | missing | — |
| Raw dealer text retained, shopper can ask what the dealer said | missing | — |
| Legacy ADF kept separate from the agent path | partial | ADF exists ([lead-delivery.ts](../apps/dealer-dashboard/src/lib/lead-delivery.ts)). The agent path does not exist yet, so the separation is a rule for later work, not a second implemented pipeline. |

## Dealer app and realtime

| Requirement | Status | Evidence |
| --- | --- | --- |
| Dealer authentication | partial | Supabase auth and `/api/dealer/v1` bearer checks exist. [AppStore.swift](../apps/drevvy-dealer/DrevvyDealer/App/AppStore.swift) boots [DemoDealerAPI.swift](../apps/drevvy-dealer/DrevvyDealer/Services/DemoDealerAPI.swift). |
| Push for new leads | partial | Entitlement, [NotificationManager.swift](../apps/drevvy-dealer/DrevvyDealer/Notifications/NotificationManager.swift), `POST /api/dealer/v1/devices`. Not on the live app path while demo mode is the default. |
| Lead list and detail | partial | UI exists and reads demo data. Live list API exists for ADF leads, not negotiation cases. |
| Vehicle and non-PII requirements | missing | Live leads are contact-bearing ADF records. |
| Conversation thread and composer | missing | — |
| Structured offer entry | missing | — |
| Salesperson assignment | missing | Not in `DealerAPI`. |
| Deep link from push | partial | `NotificationManager` can select a lead id. Depends on demo vs live data. |
| Realtime subscriptions | missing | No Supabase Realtime client usage. Analytics refresh is polling or HTTP. |
| One messaging backend | missing | — |

## LLM tools and data model

| PRD tool or entity | Status | Closest current object |
| --- | --- | --- |
| `search_inventory` | partial | MCP `render-vehicle-results-v2`, dashboard `/api/inventory/search`. |
| `get_vehicle_details` | partial | MCP `get-vehicle-details`, `GET /api/inventory/detail/[id]`. |
| `get_vehicle_market_context` | missing | — |
| `save_vehicle` | missing | — |
| `create_negotiation_case` / `get_negotiation_case` | missing | `leads` is a different aggregate. |
| `get_dealer_thread` / `send_dealer_message` | missing | — |
| `request_dealer_offer` / `record_dealer_offer` / `analyze_offer` | missing | — |
| `request_shopper_approval` | missing | — |
| `send_shopper_update` | missing | — |
| `update_negotiation_state` | missing | `PATCH` lead status only. |
| User, dealer, dealer user, rooftop | partial | `auth.users`, `profiles`, `dealerships`, `user_dealerships`. Consumer user is not modeled. |
| Conversation, message, search session | missing | — |
| Vehicle / listing | existing | `uvs_vehicles`. |
| Saved vehicle | missing | — |
| Negotiation case, mandate, state event, offer, approval, agent action, market context | missing | — |
| Device push token | partial | `dealer_mobile_devices` for dealers only. |
| Analytics event | partial | `analytics_events`, `app_events`. See the North Star for the envelope gap. |

VIN is not the primary key of `uvs_vehicles`. That PRD rule already holds.

## API boundary

| PRD example | Status | Actual route |
| --- | --- | --- |
| `POST /v1/chat` | partial | `POST /api/query/chat-search` (stateless). |
| Conversation CRUD | missing | — |
| `POST /v1/inventory/search` | partial | `POST /api/inventory/search`. |
| Vehicle detail | partial | `GET /api/inventory/detail/[id]`. |
| Saved vehicles | missing | — |
| Negotiation CRUD, messages, approvals, offers | missing | — |
| Dealer lead list | partial | `GET /api/dealer/v1/dealerships/[dealershipId]/leads` returns ADF leads. |
| Dealer messages and offers | missing | — |

New routes, when added, should extend this `/api` layout. This audit does not add routes.

## Authentication and security

| Requirement | Status | Evidence |
| --- | --- | --- |
| Sign in with Apple | missing | — |
| Keychain session | missing | — |
| No MarketCheck or LLM keys in the iOS binary | existing | Server env only. |
| Shared inventory key removed before production private APIs | missing | [Config.swift](../apps/autogentic/Autogentic/Models/Config.swift) still loads `INVENTORY_SEARCH_API_KEY`. Acceptable only for the current public search call. |
| Dealer rooftop authorization | existing | RLS and `user_dealerships`. Mobile bearer helper exists. |
| Shopper/dealer data separation | missing | Admin can decrypt nationwide leads. No alias layer. |
| Negotiation audit log | missing | — |
| Rate limits, input sanitization, URL validation | partial | Scattered helpers such as [safeHttpUrl.ts](../apps/dealer-dashboard/src/lib/safeHttpUrl.ts). Not a negotiation control plane. |
| Tests that a dealer cannot read another rooftop's case or shopper PII | missing | No negotiation case to test. Lead RLS exists and is a different policy. |

## Analytics, flags, and failure modes

| Requirement | Status | Evidence |
| --- | --- | --- |
| Funnel from `app_open` through `transaction_closed` | missing | Current names are dealer/widget events such as `vehicle.view` and `lead.submit`. |
| Search mix counts (UVS, MarketCheck, dedupe, Drevvy dealer) | missing | No hybrid search to instrument. |
| Negotiation analytics (DOM, concessions, turns, response time) | missing | — |
| Aggregate dealer analytics without shopper identity | partial | `analytics_events` omits IP and user agent. Lead payloads still hold PII in `enc_payload`, which is operational, not the warehouse. |
| Feature flags listed in the PRD | missing | Only env toggles (`INVENTORY_SEARCH_PROVIDER`, `MARKETCHECK_MCP_BRIDGE_ENABLED`). |
| Explicit failure modes (provider down, stale listing, PII request, off-platform ask) | missing | Search has some error responses. No negotiation failure policy. |

## Consumer and dealer MVP checklists

None of the 18 consumer acceptance steps beyond "open the app, start a local chat, and see inventory" are complete end to end. Steps 9–18 (choose a vehicle through approval, with no direct contact shared) are missing.

Dealer MVP steps that are partial: a lead can be ingested and shown in the dashboard, and the dealer app has screens plus a live client that is not the default. Steps that require a push of a PII-free agent lead, a thread, and a structured offer are missing.

## Summary

Extend Autogentic, the dealer dashboard API, `uvs_vehicles`, `dealerships`, and Drevvy Dealer's `DealerAPI`. Do not add a second backend.

The largest gaps are one shared search service, consumer auth, and the entire `NegotiationCase` aggregate (alias, mandate, policy, market context, thread, offers, approvals). The existing `leads` / ADF pipeline stays beside that aggregate and continues to carry contact data. It is not the agent inbox.
