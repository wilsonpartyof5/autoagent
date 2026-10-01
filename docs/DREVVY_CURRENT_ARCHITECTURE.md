# Drevvy Current Architecture

Audit date: 2026-09-24. Product pivot: 2026-10-01.

This document records what is in the repository. It does not add services. The build order is [DREVVY_IMPLEMENTATION_PLAN.md](DREVVY_IMPLEMENTATION_PLAN.md). The data-platform constraint is [DREVVY_DATA_PLATFORM_NORTH_STAR.md](DREVVY_DATA_PLATFORM_NORTH_STAR.md).

## MVP status

Drevvy’s near-term product is the shopper iOS app only.

| Surface | Near-term role |
| --- | --- |
| [apps/autogentic](../apps/autogentic) | The shopper app. Ask and Shop chat. This is the product. |
| [apps/dealer-dashboard](../apps/dealer-dashboard) | API host for shopper search and, later, cases. Not a dealer inbox for this MVP. |
| [apps/mcp-server](../apps/mcp-server) | MarketCheck tools and ChatGPT search. Ask/Shop inventory comes from MarketCheck. |
| [apps/drevvy-dealer](../apps/drevvy-dealer) | Dealer iOS app. **Deferred.** Do not add negotiation screens here. |
| [apps/autoagent-app](../apps/autoagent-app) | ChatGPT manifest only. Not the shopper app. |

Dealer identity stays on the server. Shopper cards, the map, and vehicle details show price and hide dealer name and contact fields. Outreach to dealers is a later SMS, email, and voice job. It is not an in-app dealer thread and it is not ADF.

## Repository map

| Path | Role |
| --- | --- |
| [apps/autogentic](../apps/autogentic) | Shopper SwiftUI app. Xcode project `Autogentic.xcodeproj`. In-app title is Drevvy. |
| [apps/drevvy-dealer](../apps/drevvy-dealer) | Dealer SwiftUI app. Display name `Drevvy Dealer`. Deferred for MVP. |
| [apps/dealer-dashboard](../apps/dealer-dashboard) | Next.js app on Vercel. Today it serves dealer pages and the shopper inventory HTTP API. |
| [apps/mcp-server](../apps/mcp-server) | Express server on Railway. MarketCheck MCP tools, widgets, and inventory ingest. |
| [packages/shared](../packages/shared) | Shared TypeScript types, including the Unified Vehicle Schema. |
| [apps/dealer-dashboard/supabase/migrations](../apps/dealer-dashboard/supabase/migrations) | Postgres schema. Supabase is the operational database. |

There is no second shopper Xcode project. There is no ClickHouse, event lake, queue, or dedicated search engine in this repo.

## Runtime shape today

```text
Autogentic iOS  -- POST /api/query/chat-search --+
                                                  |
ChatGPT -- MCP tools -----------------------------+--> dealer-dashboard (Vercel)
                                                  |         |
Drevvy Dealer iOS -- /api/dealer/v1 (not in MVP) -+         +--> Supabase
                                                            |
MCP server (Railway) -- search + submit-lead + ingest ------+
        |
        +--> MarketCheck
        +--> uvs_vehicles (ingest; not required for shopper Shop mode)
```

Shopper search today is MarketCheck-backed on the dashboard (`POST /api/query/chat-search`, `POST /api/inventory/search`) and, separately, in [apps/mcp-server/src/tools/searchVehicles.ts](../apps/mcp-server/src/tools/searchVehicles.ts). Those two stacks are not yet one Shop-mode service, and shopper payloads still include dealer fields.

## Shopper iOS

Open [apps/autogentic/Autogentic.xcodeproj](../apps/autogentic/Autogentic.xcodeproj). The bundle id in the project is the placeholder `com..Autogentic`. This pivot does not change it.

| Piece | Path |
| --- | --- |
| App entry | [AutogenticApp.swift](../apps/autogentic/Autogentic/AutogenticApp.swift) |
| Shell | [ContentView.swift](../apps/autogentic/Autogentic/ContentView.swift) |
| Chat | [ChatView.swift](../apps/autogentic/Autogentic/Core%20Views/ChatView.swift) |
| Cards and map | [VehicleCardCarousel.swift](../apps/autogentic/Autogentic/Core%20Views/VehicleCardCarousel.swift), [MapToolView.swift](../apps/autogentic/Autogentic/Core%20Views/MapToolView.swift) |
| Detail | [VehicleDetailView.swift](../apps/autogentic/Autogentic/Core%20Views/VehicleDetailView.swift) |
| Chat model | [ChatViewModel.swift](../apps/autogentic/Autogentic/ViewModels/ChatViewModel.swift) |
| API host and shared key | [Config.swift](../apps/autogentic/Autogentic/Models/Config.swift) |

The sidebar title is Drevvy. Chat is the live surface. Saved Vehicles, My Deals, and Profile are placeholders. Messages stay on the device. There is no shopper account in this tree on `main`.

`INVENTORY_SEARCH_API_KEY` is read from the app bundle for public search. It is not a shopper identity. Private case and payment routes must not accept it.

## What already exists around dealers

Dealer sign-in, rooftop membership, `uvs_vehicles`, and the ADF `leads` path exist in Supabase and in the dashboard. The dealer iOS app can call `/api/dealer/v1` through `LiveDealerAPI`, but the app still boots demo data. None of that is the shopper MVP. The legacy lead path keeps shopper contact data and must stay disconnected from paid outreach.

## Naming

The git repo and several hostnames still say AutoAgent. The shopper-facing name is Drevvy. Package names, hostnames, and the Autogentic bundle id stay as they are until a separate change.
