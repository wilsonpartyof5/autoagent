# Drevvy Current Architecture

Audit date: 2026-09-24. Product pivot: 2026-10-01.

This document records what is in the repository. It does not add services. The build order is [DREVVY_IMPLEMENTATION_PLAN.md](DREVVY_IMPLEMENTATION_PLAN.md). The data-platform constraint is [DREVVY_DATA_PLATFORM_NORTH_STAR.md](DREVVY_DATA_PLATFORM_NORTH_STAR.md).

## MVP status

Drevvy’s near-term product is the shopper iOS app and the API that serves it.

| Surface | Near-term role |
| --- | --- |
| [apps/autogentic](../../apps/autogentic) | The shopper app. Ask and Shop chat. This is the product until Flutter replaces it. |
| [apps/backend](../../apps/backend) | Next.js API on Vercel project `autoagent-dealer-dashboard`. Shopper routes and the operator console. |

Dealer identity stays on the server. Shopper cards, the map, and vehicle details show price and hide dealer name and contact fields. Outreach to dealers is a later SMS, email, and voice job. It is not an in-app dealer thread and it is not ADF.

## Repository map

| Path | Role |
| --- | --- |
| [apps/autogentic](../../apps/autogentic) | Shopper SwiftUI app. Xcode project `Autogentic.xcodeproj`. In-app title is Drevvy. |
| [apps/backend](../../apps/backend) | Package `@drevvy/backend`. Shopper HTTP API, `/auth`, and the admin allowlist gate. |
| [supabase/migrations](../../supabase/migrations) | Postgres history. Do not apply new files from a cleanup. Dealer tables stay until a later migration. |
| [docs/marketcheck](../marketcheck) | MarketCheck notes kept as reference. |
| [docs/drevvy](.) | Product plan, gap analysis, north star, iOS plan, and this file. |

There is no ChatGPT MCP server, dealer iOS app, or `packages/shared` in this repo. There is no ClickHouse, event lake, queue, or dedicated search engine.

## Runtime shape today

```text
Autogentic iOS
  POST /api/query/chat-search
  POST /api/query/parse
  POST /api/inventory/search
  GET  /api/inventory/detail/:id
  /api/consumer/*
        |
        v
apps/backend on Vercel (autoagent-dealer-dashboard.vercel.app)
        |
        +--> MarketCheck hosted MCP (api.marketcheck.com/mcp)
        +--> Supabase (consumer_profiles, shopper_deals, app_sessions, app_events)
```

Shopper search does not go through a repo-hosted MCP server. `lib/marketcheck/mcp-adapter.ts` calls MarketCheck directly. Shopper payloads omit dealer identity.

## Shopper iOS

Open [apps/autogentic/Autogentic.xcodeproj](../../apps/autogentic/Autogentic.xcodeproj). The bundle id in the project is the placeholder `com..Autogentic`. This pivot does not change it.

| Piece | Path |
| --- | --- |
| App entry | [AutogenticApp.swift](../../apps/autogentic/Autogentic/AutogenticApp.swift) |
| Shell | [ContentView.swift](../../apps/autogentic/Autogentic/ContentView.swift) |
| Chat | [ChatView.swift](../../apps/autogentic/Autogentic/Core%20Views/ChatView.swift) |
| Cards and map | [VehicleCardCarousel.swift](../../apps/autogentic/Autogentic/Core%20Views/VehicleCardCarousel.swift), [MapToolView.swift](../../apps/autogentic/Autogentic/Core%20Views/MapToolView.swift) |
| Detail | [VehicleDetailView.swift](../../apps/autogentic/Autogentic/Core%20Views/VehicleDetailView.swift) |
| Chat model | [ChatViewModel.swift](../../apps/autogentic/Autogentic/ViewModels/ChatViewModel.swift) |
| API host and shared key | [Config.swift](../../apps/autogentic/Autogentic/Models/Config.swift) |

The sidebar title is Drevvy. Chat is the live surface. Saved Vehicles, My Deals, and Profile are placeholders. Messages stay on the device. There is no shopper account in this tree on `main`.

`INVENTORY_SEARCH_API_KEY` is read from the app bundle for public search. It is not a shopper identity. Private case and payment routes must not accept it.

## Dealer data still in Supabase

The dealer portal code is gone. Tables such as `dealerships`, `leads`, and `uvs_vehicles` are still in the database. Dropping them is a later migration, after an export if one is wanted. Do not point new shopper code at them.

## Naming

The git repo and the Vercel project are still `autoagent` / `autoagent-dealer-dashboard`. The shopper-facing name is Drevvy. The iOS app keeps calling `https://autoagent-dealer-dashboard.vercel.app`. Do not rename that project. The Next.js package is `@drevvy/backend` and the directory is `apps/backend`. Set the Vercel Root Directory to `apps/backend` when this rename is deployed.
