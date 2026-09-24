# Drevvy Data Platform North Star

This is a permanent architectural constraint and planning reference. It is not the current implementation checklist.

Do not build all of this infrastructure now. The purpose is to keep the systems we build from blocking the data platform below. [DREVVY_IMPLEMENTATION_PLAN.md](DREVVY_IMPLEMENTATION_PLAN.md) must follow it. [DREVVY_CURRENT_ARCHITECTURE.md](DREVVY_CURRENT_ARCHITECTURE.md) records what exists today.

If an implementation choice conflicts with this document, flag it before proceeding.

```text
                    DREVVY APPLICATION LAYER
 Consumer iOS     ChatGPT/MCP     Dealer iOS     Dealer Dashboard
      │                │              │                 │
      └────────────────┴──────────────┴─────────────────┘
                               │
                               ▼
                    Drevvy Backend / APIs
                    Vercel + Railway
                               │
          ┌────────────────────┼───────────────────────┐
          │                    │                       │
          ▼                    ▼                       ▼
      Supabase            Event Pipeline          Search Pipeline
      PostgreSQL
          │                    │                       │
          ▼                    ▼                       ▼
 Transactional Truth     Object Event Lake       Search Index
                                │
                                ▼
                           ClickHouse
                            Analytics
```

## 1. Supabase / PostgreSQL remains the transactional source of truth

Supabase remains the operational database for current application state:

- users and dealer memberships
- dealerships
- `uvs_vehicles`
- saved vehicles
- conversations
- negotiation cases
- shopper mandates
- messages
- structured offers
- approval requests
- negotiation state
- agent actions
- transaction outcomes
- current inventory relationships

Questions such as "What is the current dealer offer?", "What state is this negotiation in?", "Has the shopper approved this action?", and "Which dealership owns this case?" are answered from Supabase/Postgres.

Supabase is not the long-term analytics warehouse.

## 2. Separate operational data from analytical event data

Two concepts:

- **Operational state.** Current source-of-truth records required to run the application. Stored in Supabase/Postgres.
- **Historical event stream.** An append-only record of actions and domain events. Eventually retained in object storage plus ClickHouse.

Do not force every analytical event into highly relational transactional tables.

## 3. Universal event contract

Even before ClickHouse or an event lake exists, events use one envelope:

```json
{
  "event_id": "uuid",
  "event_name": "dealer_offer_received",
  "occurred_at": "timestamp",
  "consumer_user_id": null,
  "session_id": null,
  "conversation_id": null,
  "negotiation_case_id": null,
  "dealership_id": null,
  "listing_id": null,
  "vin": null,
  "source": "consumer_ios|dealer_ios|dealer_dashboard|mcp|agent|backend",
  "properties": {}
}
```

Exact fields may evolve after inspecting the existing tables (see the mapping below). Event identity and the major foreign IDs stay consistent across Drevvy.

## 4. Product events and domain events

Both are recorded. The distinction exists even when both live in the same storage.

Product events describe how people use Drevvy:

```text
search_started
search_completed
inventory_impression
vehicle_viewed
vehicle_saved
vehicle_compared
conversation_created
contact_dealer_started
active_deal_opened
```

Domain events describe business changes:

```text
negotiation_created
shopper_mandate_approved
dealer_contacted
dealer_response_received
dealer_offer_received
otd_received
counter_sent
dealer_concession_received
addon_removed
approval_requested
approval_granted
negotiation_state_changed
deal_agreed
deal_closed
deal_lost
vehicle_price_changed
inventory_expired
```

## 5. Operational audit is not analytics

`NegotiationStateEvent` and `AgentAction` stay in Supabase. Drevvy needs them to reconstruct one negotiation.

Those rows must also be able to feed analytics later:

```text
Operational audit
        ↓
Analytics projection
```

The analytics database does not replace application audit history.

## 6. Object event lake is the long-term raw history

Raw event history eventually lives in low-cost object storage (S3-compatible storage such as Cloudflare R2, or another object store). Layout:

```text
/events/
  year=2026/
    month=09/
      day=24/
        hour=10/
```

Long-term file format favors analytical formats such as Parquet. The lake supports replay, rebuilding models, recovering from warehouse mistakes, creating metrics later, training future systems, and keeping history when schemas change.

Do not build the lake now unless a current workload requires it. Design the event contract so adding the lake does not require a consumer or dealer app change.

## 7. ClickHouse is the future analytical warehouse

ClickHouse is the future system for large-scale historical analytics. It answers questions such as concession patterns by vehicle age, dealer response rate by rooftop, which negotiation policies produce better outcomes, how days-on-market correlate with concessions, search-to-negotiation conversion, demand versus dealer inventory, how often mandatory add-ons are removed, and what happens after the first, second, and third counteroffer.

ClickHouse is not the transactional source of truth. Supabase stays authoritative for current operational state.

## 8. Plan for Postgres to ClickHouse replication

Do not implement change data capture yet unless a workload requires it. Shape Supabase tables so replication can send relational data to ClickHouse later. Likely entities:

```text
dealerships
uvs_vehicles
negotiation_cases
shopper_mandates
offers
offer_line_items
negotiation_state_events
agent_actions
transaction outcomes
```

Avoid designs that make historical reconstruction depend on constantly overwriting records without timestamps or state history.

## 9. High-volume behavior eventually leaves transactional analytics tables

At small scale, events may live in Supabase. At higher scale, high-volume behavioral telemetry moves through a dedicated ingestion path:

```text
Applications / Services
        ↓
Drevvy Event Gateway
        ↓
Event buffer / queue
        ↓
       ├── Object Event Lake
        │
        └── ClickHouse
```

Do not deploy Kafka, Redpanda, ClickHouse, or an equivalent bus only because this document names them. Introduce them when traffic and operations justify the complexity.

## 10. Search is separate from analytics

ClickHouse is not the long-term consumer vehicle-search engine. Supabase is not required to serve every future high-scale search workload either.

The mature path:

```text
MarketCheck
Dealer feeds
Other inventory feeds
        ↓
       UVS
        ↓
Search indexing worker
        ↓
Dedicated search engine
        ↓
CanonicalSearchService
        ↓
Consumer / ChatGPT
```

Possible future engines include Typesense, OpenSearch, or another search engine. Do not select or deploy one until current scale requires it.

UVS/Supabase stays authoritative. The search index is a rebuildable projection. If the index is deleted, Drevvy rebuilds it from canonical inventory.

## 11. Ranking stays server-side

The index retrieves candidates. `CanonicalSearchService` owns business ranking:

```text
query relevance
hard shopper requirements
inventory quality
distance
freshness
market signals
Drevvy dealer preference among comparable results
```

Ranking does not live permanently in iOS or ChatGPT.

## 12. Railway's long-term responsibility

Railway hosts persistent backend services, agents, workers, and ingestion. Future services may include:

```text
MCP server
agent orchestrator
event worker
inventory ingestion worker
market-context worker
notification worker
search indexing worker
analytics export worker
```

Create a new service only when the workload justifies the split. Where practical, workers communicate privately rather than exposing every process publicly.

Today, the MCP server is already on Railway. That is the only Railway service this repo deploys.

## 13. Vercel's long-term responsibility

Vercel remains the application and API edge:

```text
Dealer dashboard
API endpoints
authentication callbacks
consumer-facing request handlers
short-duration orchestration
admin and internal web interfaces
```

The dealer-dashboard application should not permanently own web UI, inventory ingestion, agent workers, event processing, warehouse jobs, search indexing, and analytics processing together. Long-running work moves to Railway when the workload requires it.

Today, Vercel already runs nightly ingest and lead-delivery crons as short HTTP routes. Those crons are acceptable at current scale. New long-running workers should not be added inside the Next.js app by default.

## 14. Instrument features when they are built

Full warehouse infrastructure can wait. Event definitions cannot. Each feature defines its events in the same change that ships the feature.

Negotiation cases define `negotiation_created`, `dealer_contacted`, `dealer_response_received`, `offer_received`, `counter_sent`, `approval_requested`, and `deal_closed`.

Vehicle search defines `search_started`, `search_completed`, `inventory_impression`, `vehicle_viewed`, and `vehicle_saved`.

Historical data starts with the earliest production usage. Structured events are emitted before ClickHouse exists.

## 15. Stable IDs

Every layer shares stable identifiers:

```text
consumer_user_id
session_id
conversation_id
listing_id
vin
dealership_id
negotiation_case_id
message_thread_id
message_id
offer_id
policy_version
agent_action_id
event_id
```

Analytics does not create a second identifier for the same entity without a mapping. These IDs are what let ClickHouse connect shopper behavior, inventory, dealer behavior, negotiations, and outcomes.

`listing_id` is `uvs_vehicles.id`. VIN is an attribute, not the universal primary key.

## 16. Preserve timestamps and historical state

Do not store only `current_price`, `current_status`, or `current_offer` when the movement is the business fact. Future intelligence depends on transitions: price before and after, negotiation state before and after, offer before and after, who changed it, and when.

Use append-only event or state history where that history has business value.

## 17. Three long-term data assets

**Inventory intelligence:** price, mileage, days on market, price history, supply, market comps, inventory turnover.

**Shopper intelligence:** search behavior, vehicle views, saves, comparisons, shortlists, preferences, purchase intent, conversion.

**Transaction and negotiation intelligence:** initial ask, fees, add-ons, dealer response behavior, concessions, counteroffers, agent strategy, policy version, time to response, financing conditions, final terms, closed transaction.

The third category matters most. Negotiation history is kept even when the live UI only needs the current offer.

## 18. NegotiationPolicy must stay attributable

Every automated negotiation permanently retains the policy version it used. Also retain, when relevant:

```text
policy_version
agent_model_version
prompt_version
market_context_version
```

A later policy edit does not rewrite the version pinned on past cases or agent actions.

## 19. Market intelligence produces structured features

`VehicleMarketContext` is shaped so its values can become model features:

```text
asking_price
days_on_market
price_change_count
local_comp_count
local_median
price_vs_median
mileage_vs_median
market_position
confidence
```

The agent consumes these normalized values. Analytics can join them to the negotiation outcome. Raw MarketCheck payloads stay in source storage.

## 20. Privacy continues into analytics

The warehouse and the event lake are not a bypass around shopper privacy.

- Use internal consumer IDs rather than emails or phone numbers.
- Do not copy unnecessary PII into ClickHouse.
- Do not put shopper contact details into event `properties`.
- Keep identity information apart from behavioral and transactional analytics.
- Preserve dealer authorization boundaries in operational systems.

An analytics system rarely needs a shopper's real-world identity. Dealer-visible negotiation data uses the shopper alias.

## 21. What we run now

The acceptable current shape is:

```text
Vercel + Railway
       ↓
Supabase
       ↓
operational tables
+
structured analytics_events
```

As scale grows, evolve toward:

```text
                       Supabase/Postgres
                              │
                        transactional
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           CDC/Event      Object Lake     Search Index
            Stream             │
              │                │
              └────────┬───────┘
                       ▼
                  ClickHouse
                   Analytics
```

Applications should not need a major rewrite when those systems arrive.

## 22. Checklist for every future phase

Before a phase is implemented, answer:

1. What transactional data belongs in Supabase?
2. What domain events should be emitted?
3. What historical information must never be overwritten or lost?
4. What stable IDs connect this feature to future analytics?
5. Could this data later be replicated to ClickHouse cleanly?
6. Does this feature need to contribute data to the object event lake?
7. Would this workload eventually belong in a search index?
8. Is this a synchronous Vercel responsibility or a long-running Railway responsibility?
9. Are we exposing PII in events or analytical data?
10. Are we building something that would make the future architecture unnecessarily difficult?

Do not add infrastructure solely to satisfy this document. Build today's version so tomorrow's infrastructure can be added cleanly.

## Current tables this contract must fit

Inspected 2026-09-24. Do not create a third event table until a later phase decides to evolve these.

| Store | Path | What it already has | Gap versus the envelope |
| --- | --- | --- | --- |
| `analytics_events` | [20250301_create_analytics_tables.sql](../apps/dealer-dashboard/supabase/migrations/20250301_create_analytics_tables.sql) | `id`, `session_id`, `event_name`, `source`, `dealer_id`, `vehicle_id`, `vin`, `user_id`, `payload`, `timestamp` | `source` values are `mcp-server`, `dashboard`, `widget`, `system`. No `consumer_user_id`, `conversation_id`, `negotiation_case_id`, or `dealership_id` uuid. `dealer_id` is a MarketCheck dealer id. `payload` is the properties bag. Names are dotted (`vehicle.view`, `lead.submit`), not the snake_case product/domain list above. |
| `analytics_sessions` | same migration | `id`, `user_id`, `dealer_id`, `started_at` | Session id exists. It is dealer/widget scoped. IP and user agent were deliberately omitted. |
| `app_events` | [20260723_marketcheck_nationwide_platform_ops.sql](../apps/dealer-dashboard/supabase/migrations/20260723_marketcheck_nationwide_platform_ops.sql) | `id`, `flow_id`, `event_name`, `source`, `tool_name`, `dealer_id`, `vehicle_id`, `vin`, `payload`, `occurred_at` | ChatGPT flow observability. `flow_id` is the closest session key. Same missing negotiation and consumer ids. Platform-admin read only. |
| `app_sessions` | same migration | `id`, provider, search location, result count, `lead_id` | Not a consumer conversation id. |

Mapping rules for the next event work, when that phase is approved:

- `event_id` ← `analytics_events.id` or `app_events.id`.
- `occurred_at` ← `timestamp` or `occurred_at`.
- `listing_id` ← `vehicle_id` when that value is `uvs_vehicles.id`.
- `properties` ← `payload`.
- `session_id` ← `session_id` or `flow_id`, and document which table it came from.
- `dealership_id` is the `dealerships.id` uuid. Keep `dealer_id` (MarketCheck) as a property until callers send the uuid. Do not overload one column for both.
- `source` grows to `consumer_ios | dealer_ios | dealer_dashboard | mcp | agent | backend`. Existing values stay valid for old rows.
- New product and domain names are additive. Do not rename historical `vehicle.view` rows in place.

`leads.enc_payload` is operational PII for the legacy ADF path. It is not an analytics property and is not copied into the future lake or warehouse.

## Explicit non-goals for the current repo

These are named so later phases do not treat them as implied work:

- ClickHouse
- object storage event lake or Parquet export
- Kafka, Redpanda, or another queue
- change data capture
- Typesense, OpenSearch, or any other dedicated search cluster

`CanonicalSearchService`, when it is built, reads UVS and MarketCheck directly until a rebuildable index is justified. Ranking stays in that service.
