# Drevvy Implementation Plan

This plan follows the PRD, the audit in [DREVVY_CURRENT_ARCHITECTURE.md](DREVVY_CURRENT_ARCHITECTURE.md), the gaps in [DREVVY_GAP_ANALYSIS.md](DREVVY_GAP_ANALYSIS.md), and the permanent constraint in [DREVVY_DATA_PLATFORM_NORTH_STAR.md](DREVVY_DATA_PLATFORM_NORTH_STAR.md).

Phase 0 is this document set. It stops here. No schema, API, app, bundle id, ClickHouse, queue, object lake, or search-engine changes are part of Phase 0.

Every later phase answers the North Star checklist before code is written:

1. Transactional tables in Supabase.
2. Product events and domain events introduced.
3. History that must not be overwritten.
4. Stable IDs.
5. Whether the rows can replicate to ClickHouse later.
6. Whether the feature contributes to the future object event lake (contract only, until the lake exists).
7. Whether a future search index is involved.
8. Vercel versus Railway.
9. PII in events or dealer responses.
10. Any conflict with the North Star. A conflict is flagged before that phase proceeds.

## Dependency graph

```text
Phase 0  Audit documents (this change)
    │
    ├── Phase 1  CanonicalSearchService
    │
    └── Phase 2  Consumer auth
            │
            └── Phase 3  NegotiationCase domain
                    ├── NegotiationPolicy
                    └── VehicleMarketContext
                            │
                            └── Phase 4  Message visibility
                                    ├── Phase 5  Extend Autogentic
                                    └── Phase 6  DealerAPI, one method at a time
                                            │
                                            └── Phase 7  Hardening

Legacy leads / ADF  ── stays beside the domain, never shares rows or contact data
```

Events are defined inside the phase that creates the behavior. ClickHouse, the object lake, a queue, and a dedicated search index are not phases. They are added later, under the North Star, when a workload requires them.

## Architectural rules

- One server-side inventory and search service. ChatGPT MCP and Autogentic both call it. The iOS app does not rank. A second ranker is not a long-term design.
- UVS is the canonical listing shape (`uvs_vehicles`, [packages/shared/src/uvs.ts](../packages/shared/src/uvs.ts)). `data_source` is provenance. An onboarded dealer is a `dealerships` row matched by `marketcheck_dealer_id`. A MarketCheck-originated listing can still belong to an onboarded rooftop.
- `CanonicalSearchService` is the stable boundary. The first version reads UVS and MarketCheck directly. A search index, if added later, is a rebuildable projection underneath that service. Ranking stays in the service: relevance, hard requirements, quality, distance, freshness, market signals, then a Drevvy-dealer boost only among comparable results.
- `INVENTORY_SEARCH_API_KEY` inside the iOS binary is temporary. Consumer auth and server-authorized requests land before saved vehicles, mandates, negotiations, or any other private API. The shared key is removed before production.
- Legacy ADF and `leads` stay separate from the agent path. Agent-represented shoppers never send phone, email, or address to a dealer. Redaction and visibility are enforced in backend reads and writes, not by the LLM.
- `NegotiationCase` is the aggregate: shopper, alias, listing, rooftop, mandate, market context, state, thread, offers, approvals, agent actions, and outcome.
- Messages have actors `shopper | dealer | agent | system` and visibility `shopper | dealer | both | internal`.
- `NegotiationPolicy` is versioned data. Rules are not copied into prompts or SwiftUI. Cases pin `policy_version`. Agent actions also store `agent_model_version` and `market_context_version`.
- `VehicleMarketContext` turns UVS and MarketCheck facts into normalized features. The agent reads that object, not raw MarketCheck responses.
- Backend, auth, and canonical search come before substantial consumer UI. Autogentic's shell is extended, not replaced.
- Drevvy Dealer keeps [AppShell.swift](../apps/drevvy-dealer/DrevvyDealer/App/AppShell.swift) and the `DealerAPI` protocol. [DemoDealerAPI.swift](../apps/drevvy-dealer/DrevvyDealer/Services/DemoDealerAPI.swift) is replaced one capability at a time. [AppStore.swift](../apps/drevvy-dealer/DrevvyDealer/App/AppStore.swift) today constructs `DemoDealerAPI()` in the default initializer.
- Supabase remains transactional truth. Structured events use the envelope in the North Star and land in Supabase until scale requires a gateway. Bundle identifiers, provisioning, and production hostnames change only after a documented confirmation.

## Domain model

### Reuse

| Existing object | Role in the new model |
| --- | --- |
| `auth.users` | Dealer users today. Consumer users use the same auth system with a separate profile, not a second identity vendor. |
| `profiles`, `user_dealerships` | Dealer identity and rooftop membership. |
| `dealerships` | Rooftop. Onboarded means this row exists. `id` is `dealership_id`. `marketcheck_dealer_id` is the match key for listings. |
| `uvs_vehicles` | Canonical listing. `id` is `listing_id`. VIN is denormalized onto cases and events and is not the primary key. |
| `dealer_mobile_devices` | Dealer push tokens. |
| `leads`, `lead_delivery_logs`, `lead_delivery_jobs` | Legacy ADF quote path. No foreign key from `NegotiationCase` to `leads`. |
| `analytics_events`, `app_events` | Current event stores. Extend or succeed them using the North Star mapping. Do not add a third parallel log in the first event change. |

### New operational tables (Supabase)

All of these are transactional. They are designed so a later CDC job can replicate them. They are not created in Phase 0.

**ShopperAlias.** `id`, `consumer_user_id`, public code such as `A8F21`. Dealer projections return the code only.

**NegotiationCase.** `id`, `consumer_user_id`, `shopper_alias_id`, `listing_id` (FK `uvs_vehicles.id`), `vin`, `dealership_id`, `policy_id`, `policy_version`, `agent_model_version`, `market_context_id`, current `state`, `outcome`, timestamps. Current state is the live row. History is the event table. States match the PRD set (`draft` through `closed_won`, `closed_lost`, `expired`) with an explicit transition table rather than one linear chain.

**ShopperMandate.** One current mandate per case: timing, max price, max OTD, payment preference, down payment, financing preference, trade-in, must-haves, deal-breakers, add-on tolerance, questions, travel, buy-now readiness. `approved_at` is required before the first dealer-visible message. Mandate edits append history or a new version so the approved text is recoverable.

**NegotiationPolicy.** `id`, monotonic `version`, effective window, rules document (autonomous actions, approval gates, PII deny-list). Prompt code receives the allowed action list for the pinned version.

**VehicleMarketContext.** `id`, `listing_id`, optional `negotiation_case_id`, `asking_price`, `days_on_market`, `price_change_count`, `local_comp_count`, `local_median`, `price_vs_median`, `mileage_vs_median`, `market_position`, `confidence`, `generated_at`, plus the feature version. Raw provider payloads stay in source storage.

**NegotiationStateEvent.** Append-only. `case_id`, prior state, new state, actor, reason, related message id, related offer id, `policy_version`, timestamp. This is the operational audit. It is also a future analytics projection.

**MessageThread.** One per case.

**Message.** `thread_id`, `actor` (`shopper`, `dealer`, `agent`, `system`), `visibility` (`shopper`, `dealer`, `both`, `internal`), body, optional raw dealer text, optional agent summary, `created_at`. Dealer-visible inserts run through server-side PII redaction. Dealer queries filter to `dealer` and `both`. Shopper queries filter to `shopper` and `both`. `internal` is not returned to either client.

**Offer** and **OfferLineItem.** Selling price, taxes, registration and title, doc fee, mandatory add-ons, optional add-ons, trade allowance, APR, term, rebates, conditional incentives. A concession inserts a new offer version. The previous offer remains.

**ApprovalRequest.** `case_id`, action type, payload, status. Required before accepting a deal, placing a deposit, submitting a credit application, transmitting SSN, sharing contact information, or agreeing to terms outside the mandate.

**AgentAction.** Tool name, idempotency key, `policy_version`, `agent_model_version`, `market_context_version`, redacted input and output, case id, message id. Tools change state only through this logged path.

**Conversation** and **ConversationMessage.** Consumer search thread, separate from the dealer `MessageThread`. Blocks are structured (`userText`, `assistantText`, `vehicleCarousel`, `vehicleCard`, `vehicleComparison`, `systemStatus`, `agentAction`, `dealerMessage`, `offerCard`, `approvalRequest`, `negotiationUpdate`).

**SavedVehicle.** `consumer_user_id`, `listing_id`. Requires consumer auth.

**Consumer device token.** New table, or a clearly typed extension. Do not overload `dealer_mobile_devices` with shopper tokens.

Dealer authorization stays `user_dealerships`. A dealer read of a case returns the alias, listing, mandate fields that were approved for the dealer, dealer-visible messages, and offers. It does not join consumer contact fields.

### Stable IDs

`consumer_user_id`, `session_id`, `conversation_id`, `listing_id`, `vin`, `dealership_id`, `negotiation_case_id`, `message_thread_id`, `message_id`, `offer_id`, `policy_version`, `agent_action_id`, `event_id`.

### Event envelope

Defined in the North Star. First implementation writes it to Supabase (`analytics_events` / `app_events` or a successor that preserves their history). `properties` never contain email, phone, or address. `source` is `consumer_ios | dealer_ios | dealer_dashboard | mcp | agent | backend`.

## Phases

### Phase 1 — Canonical search

**Build.** One service used by MCP `render-vehicle-results-v2` and by `POST /api/inventory/search` plus `POST /api/query/chat-search`. Server flag `inventory_mode`: `hybrid`, `uvs_preferred`, `uvs_only`. Query UVS and MarketCheck according to the flag, merge, dedupe by VIN, prefer the UVS row, rank on the server. Record source counts internally.

**North Star.** Transactional reads of `uvs_vehicles` and `dealerships`. Product events: `search_started`, `search_completed`, `inventory_impression`. History: do not overwrite listing price history already stored on the UVS document; search impressions are append-only events. IDs: `session_id`, `listing_id`, `vin`, `dealership_id` when resolved. Replicable later: listing and rooftop rows, not the raw MarketCheck response. Search index: the service is the seam; no engine is deployed. Host: synchronous API on Vercel for the iOS route; MCP on Railway calls the same module in `packages/shared` or a shared server package, not a forked ranker. PII: none in search events. Conflict to avoid: leaving MCP and the dashboard on two rankers.

The iOS UI keeps calling the existing chat-search route. It does not gain a local ranker in this phase.

### Phase 2 — Consumer auth

**Build.** Sign in with Apple, server session, Keychain storage in Autogentic. Authorize private routes with the session. Public inventory may keep the shared key only until this ships. Remove `INVENTORY_SEARCH_API_KEY` from the app binary before production and before any private route exists.

**North Star.** Transactional: consumer profile linked to `auth.users`. Events: `conversation_created` once conversations exist; auth itself emits a product event without contact fields. History: account status changes are timestamped. IDs: `consumer_user_id`. Replication: the profile id, not the email. Search index: none. Host: auth callbacks and session checks on Vercel. PII: email from Apple stays in the auth system, not in `analytics_events.payload`. Conflict to avoid: treating the shared API key as the consumer identity.

Bundle id `com..Autogentic` is a signing placeholder. This phase does not change it until provisioning impact is confirmed separately.

### Phase 3 — Negotiation domain

**Build.** Tables in the domain model above. Transition function for negotiation state. `VehicleMarketContext` generator from normalized UVS and MarketCheck signals. Policy loader. Creating a case does not insert a `leads` row and does not call ADF.

**North Star.** Transactional: case, mandate, policy, market context, state events, agent actions. Domain events: `negotiation_created`, `shopper_mandate_approved`, `negotiation_state_changed`, plus price and inventory events when context is generated (`vehicle_price_changed` only when a real price change is observed). History: state events and offer-ready context rows are append-only; the case row holds the current pointer. IDs: `negotiation_case_id`, `listing_id`, `dealership_id`, `policy_version`, `consumer_user_id`. Replication: all of those tables are on the future CDC list. Search index: none. Host: request/response on Vercel; a market-context worker moves to Railway only when generation is too slow for a request. PII: alias only on dealer-facing records. Conflict to avoid: folding the case into `leads` or letting the model write state without `AgentAction`.

### Phase 4 — Messaging

**Build.** One thread per case. Insert path sets actor and visibility and scrubs contact data before a dealer-visible row. Dashboard and, later, the dealer app read the same API. Shopper commands ("what did the dealer say?", follow-up questions) are agent tools that read the retained raw dealer text and write a new message, still through the server.

**North Star.** Transactional: `message_threads`, `messages`. Domain events: `dealer_contacted`, `dealer_response_received`. History: messages are append-only. IDs: `message_thread_id`, `message_id`, `negotiation_case_id`. Replication: messages are replicable with visibility intact so warehouse jobs can drop `internal` and any column that fails the PII check. Search index: none. Host: Vercel for send/list; a notification worker on Railway when push volume justifies it. Dealer push can keep using the existing devices route until then. PII: scrubber is mandatory on the write path. Conflict to avoid: a direct shopper-to-dealer channel, or realtime that bypasses the visibility filter.

### Phase 5 — Extend Autogentic

**Build.** After Phases 1–4 have APIs. Extend [ContentView.swift](../apps/autogentic/Autogentic/ContentView.swift), [ChatViewModel.swift](../apps/autogentic/Autogentic/ViewModels/ChatViewModel.swift), and [Message.swift](../apps/autogentic/Autogentic/Models/Message.swift) with typed blocks, saved vehicles, Active Deals, mandate review, and approval actions. Streaming if the chat route supports it. No local negotiation engine. No second search client.

**North Star.** Transactional: conversations, saved vehicles, and reads of the case. Product events: `vehicle_viewed`, `vehicle_saved`, `vehicle_compared`, `contact_dealer_started`, `active_deal_opened`. Domain events stay on the server when the corresponding command succeeds. History: conversation messages append. IDs: `conversation_id` plus the case ids. Replication: conversations are operational; high-volume impressions already come from Phase 1. Search index: the app still calls the service. Host: Vercel APIs, iOS as a client. PII: the device stores the session in the Keychain and does not put contact data into analytics. Conflict to avoid: rebuilding the Xcode project or ranking on device.

### Phase 6 — Dealer surfaces, incrementally

**Build.** Point `AppStore` at `LiveDealerAPI` for capabilities that exist, starting with auth, lead list, and push, then thread and offer entry as Phase 4 routes exist. Dashboard `/app/leads` gains an agent-case inbox that is not the ADF lead table. Same thread API.

**North Star.** Transactional: offers and line items when structured offers ship (`offer_received`, `otd_received`, `counter_sent`, `dealer_concession_received`, `addon_removed`, `approval_requested`, `approval_granted`). History: new offer versions, never an in-place rewrite of the prior offer. IDs: `offer_id`, `negotiation_case_id`, `dealership_id`. Replication: offers and line items are on the CDC list. Search index: none. Host: Vercel. PII: dealer responses are stored raw for audit and shown to the dealer; the shopper-visible projection is the agent message after redaction. Conflict to avoid: rewriting Drevvy Dealer or sending the ADF payload into the case UI.

### Phase 7 — Hardening

**Build.** Authorization tests: a dealer cannot read another rooftop's case, cannot read shopper contact fields, and cannot find them in event properties. Failure handling from the PRD (provider down, stale VIN, dealer asks for PII or to move off platform, shopper changes the mandate, vehicle sells). Idempotency keys on agent tools. Rate limits on public and dealer write routes.

**North Star.** No new warehouse. Confirm every phase's events use the envelope and that `NegotiationStateEvent` remains the audit source. Host split review: if ingest, market context, or notifications are now long-running inside the Next app, schedule a Railway extraction instead of growing the dashboard.

## What is intentionally not scheduled

- ClickHouse, CDC, object storage, Parquet, and a message bus.
- Typesense, OpenSearch, or another search cluster.
- Renaming `@autoagent/*` packages, Vercel or Railway hostnames, API paths, or the Autogentic bundle id.
- Replacing `submit-lead` / ADF. That path remains the contact-bearing quote flow for the ChatGPT lead tool until a later product decision.

## Stop line

Phase 0 ends when these four documents are in the repo:

- [DREVVY_CURRENT_ARCHITECTURE.md](DREVVY_CURRENT_ARCHITECTURE.md)
- [DREVVY_GAP_ANALYSIS.md](DREVVY_GAP_ANALYSIS.md)
- [DREVVY_DATA_PLATFORM_NORTH_STAR.md](DREVVY_DATA_PLATFORM_NORTH_STAR.md)
- [DREVVY_IMPLEMENTATION_PLAN.md](DREVVY_IMPLEMENTATION_PLAN.md)

The next implementation change, when approved, is Phase 1 canonical search. It starts by answering the checklist in writing in that change, then extracts the shared service behind the routes that already exist.
