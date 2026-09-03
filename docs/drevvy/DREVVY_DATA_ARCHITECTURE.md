# Drevvy Data Architecture

_Last updated: 2026-09-01_

## Purpose

This file defines the target data and infrastructure architecture for Drevvy.

The design goal is to support:

- nationwide vehicle discovery
- ChatGPT app
- consumer mobile app
- dealer mobile app/dashboard
- AI buyer's agent
- dealer offer/negotiation workflow
- MarketCheck daily feeds
- real-time inventory verification
- very high event volume
- long-term proprietary behavioral/transaction intelligence

The architecture should scale without forcing one system to handle every workload.

---

## 1. Core Architecture Principle

Separate the system into distinct layers:

1. **Transactional system of record**
2. **Vehicle search/indexing**
3. **Event ingestion**
4. **Raw data lake**
5. **Analytics**
6. **Agent/session state**
7. **External data ingestion**
8. **Public API/MCP**

Do not use the transactional database as the primary search engine or behavioral warehouse at large scale.

---

## 2. Target High-Level Architecture

```text
                     MARKETCHECK
                         |
                         v
                 Cloudflare R2
                Raw inventory feed
                         |
                         v
                 Feed Ingestion Worker
                         |
                +--------+--------+
                |                 |
                v                 v
        Canonical Inventory    Search Index
            Storage            (Typesense)
                                  |
                                  v
                         Drevvy API / MCP
                      (Cloudflare Workers)
                          /           \
                         /             \
                        v               v
                  ChatGPT App       Mobile App


        Dealer App / Dashboard
                 |
                 v
        Drevvy API / MCP
                 |
                 v
              Postgres
       Users / Dealers / Deals
        Offers / Transactions


All Product Surfaces / Agents / Integrations
                 |
                 v
         Universal Event API
                 |
                 v
          Cloudflare Queues
            /          \
           v            v
      R2 Data Lake   ClickHouse
     raw forever     analytics
```

---

## 3. Recommended Responsibilities by System

### Cloudflare Workers

Use as the public backend gateway for:

- ChatGPT MCP tools
- mobile API
- dealer app API
- authentication/session validation
- rate limiting
- request normalization
- search orchestration
- quote/offer actions
- event collection
- lightweight agent tool execution

Workers should be thin orchestration, not the permanent data store.

### Postgres

Use for authoritative business records:

- users
- anonymous-to-user identity mapping
- dealers
- dealer groups
- dealer locations
- subscriptions
- user preferences
- saved vehicles
- active searches if needed operationally
- quote requests
- dealer offers
- counters
- negotiations
- active agent assignments
- transactions
- billing references
- permissions/consent records
- consumer data-release permissions

Supabase Postgres can remain initially. Postgres is the important design choice, not the hosting vendor.

### Cloudflare R2

Use as the inexpensive durable object/data lake layer for:

- raw MarketCheck feed files
- raw event archives
- Parquet event partitions
- historical exports
- call transcripts where appropriate
- audio artifacts where appropriate
- model-training datasets
- generated analytics datasets
- backups
- images only if licensing permits Drevvy to cache/re-host

R2 is the long-term memory/archive layer.

### Typesense

Use as the primary vehicle search layer.

Searchable/filterable fields should eventually include:

- vehicle_id
- listing_id
- VIN
- year
- make
- model
- trim
- body style
- price
- MSRP
- mileage
- new/used/CPO
- dealer_id
- rooftop_id
- dealer group
- latitude/longitude
- ZIP
- drivetrain
- engine
- fuel
- transmission
- colors
- options/features
- DOM
- first seen
- last seen
- photo URLs
- MarketCheck Price
- Drevvy Deal Score
- preference-match fields
- inventory freshness fields

Typesense should return a small ranked result set to the model/API rather than large raw catalogs.

### ClickHouse

Use for large-scale analytical/event workloads:

- product events
- shopper funnel analytics
- dealer response analytics
- search behavior
- ranking performance
- agent performance
- offer/negotiation analytics
- acquisition attribution
- transaction intelligence
- experimentation results
- historical behavior modeling

ClickHouse is not the transactional database.

### Cloudflare Queues

Use for asynchronous work:

- event fan-out
- event persistence
- MarketCheck processing jobs
- dealer notifications
- background enrichment
- search-index updates
- agent follow-ups
- webhook processing
- retries
- dead-letter handling

### Durable Objects

Use selectively for stateful real-time workflows:

- live agent session coordination
- live negotiation rooms
- dealer-consumer conversation coordination
- WebSocket state
- rate/concurrency coordination

Do not use Durable Objects for everything.

---

## 4. Universal Event System

Drevvy should have one universal first-party event pipeline.

Suggested endpoint:

```text
POST /v1/events
```

Every major product surface should emit events through the same logical system:

- mobile app
- ChatGPT app
- dealer app
- dealer dashboard
- Drevvy agent
- Twilio
- ElevenLabs
- MarketCheck ingestion
- CRM/DMS integrations
- financing integrations

---

## 5. Standard Event Envelope

Every event should follow a stable envelope.

```json
{
  "event_id": "uuid",
  "event_name": "vehicle_clicked",
  "occurred_at": "2026-09-01T20:00:00Z",

  "anonymous_id": "anon_...",
  "user_id": "user_...",
  "session_id": "session_...",

  "source": "mobile",
  "app_version": "1.2.0",

  "search_id": "search_...",
  "vehicle_id": "vehicle_...",
  "listing_id": "listing_...",
  "dealer_id": "dealer_...",

  "agent_session_id": "agent_...",
  "conversation_id": "conv_...",
  "quote_id": "quote_...",
  "offer_id": "offer_...",
  "negotiation_id": "neg_...",
  "transaction_id": "txn_...",

  "ranking_version": "rank_v4",
  "agent_version": "agent_v7",
  "prompt_version": "prompt_v12",
  "model": "model_name",

  "properties": {}
}
```

Not every event populates every field.

The critical design principle is consistent IDs across the full funnel.

---

## 6. Core IDs to Establish Early

Create stable internal Drevvy IDs for:

- `anonymous_id`
- `user_id`
- `session_id`
- `search_id`
- `vehicle_id`
- `listing_id`
- `dealer_id`
- `dealer_location_id`
- `dealer_rooftop_id`
- `dealer_group_id`
- `agent_session_id`
- `conversation_id`
- `call_id`
- `quote_id`
- `offer_id`
- `negotiation_id`
- `transaction_id`

Preserve MarketCheck IDs separately rather than making them Drevvy's only keys.

---

## 7. Event Taxonomy

### Acquisition / session

- `session_started`
- `session_ended`
- `signup_started`
- `signup_completed`
- `login_completed`
- `traffic_attributed`
- `campaign_attributed`

Useful properties:

- UTM source
- UTM campaign
- referrer
- device
- app version
- geography where permitted

### Search / intent

- `search_submitted`
- `intent_parsed`
- `search_filters_changed`
- `search_results_generated`
- `search_zero_results`
- `search_refined`

Store:

- raw user query
- structured intent
- candidate count
- search radius
- inventory snapshot/version
- ranking version

### Vehicle discovery

- `vehicle_impression`
- `vehicle_clicked`
- `vehicle_expanded`
- `photo_viewed`
- `vehicle_compared`
- `vehicle_saved`
- `vehicle_unsaved`
- `vehicle_shared`
- `vehicle_rejected`

Important properties:

- rank position
- list price
- mileage
- DOM
- distance
- dealer
- recommendation score
- preference score
- deal score
- inventory freshness

### Agent activation

- `agent_started`
- `agent_preferences_confirmed`
- `agent_outreach_authorized`
- `agent_shortlist_created`
- `agent_recommendation_generated`

### Dealer workflow

- `dealer_opportunity_created`
- `dealer_opportunity_delivered`
- `dealer_opportunity_opened`
- `dealer_response_started`
- `dealer_response_submitted`
- `dealer_declined`
- `dealer_no_response`

### Offer / negotiation

- `dealer_offer_received`
- `dealer_counter_received`
- `drevvy_counter_recommended`
- `drevvy_counter_authorized`
- `drevvy_counter_sent`
- `dealer_fee_discovered`
- `dealer_addon_discovered`
- `offer_updated`
- `offer_expired`
- `shopper_offer_viewed`
- `shopper_offer_accepted`
- `shopper_offer_rejected`

### Transaction

- `transaction_started`
- `identity_release_authorized`
- `dealer_handoff_completed`
- `financing_started`
- `transaction_completed`
- `transaction_cancelled`
- `vehicle_purchased`

---

## 8. Search Event Design

For every search, capture:

- raw query
- parsed intent
- search timestamp
- search source
- location/radius
- candidate count
- returned vehicle IDs
- ranking version
- inventory version/snapshot
- model/prompt version if AI interpreted the query

Example:

```json
{
  "event_name": "search_results_generated",
  "search_id": "search_123",
  "properties": {
    "raw_query": "black Tahoe Z71 under 60k",
    "candidate_count": 143,
    "returned_vehicle_ids": ["v1", "v2", "v3"],
    "inventory_snapshot": "2026-09-01",
    "ranking_version": "rank_v4"
  }
}
```

The goal is to reconstruct later:

> What did the shopper want, what inventory existed, what did Drevvy show, and what happened next?

---

## 9. Inventory Snapshot / Versioning

Do not duplicate the full vehicle object into every event.

Instead preserve:

- `inventory_snapshot`
- `inventory_version`
- relevant `vehicle_id`/`listing_id`
- critical scoring fields at the time of the event

This lets Drevvy reconstruct ranking decisions without creating excessive event payloads.

---

## 10. Vehicle / Listing Data Model

Do not use VIN as the only primary key.

Recommended separation:

### Vehicle

Represents the physical vehicle.

Fields:

- `vehicle_id`
- VIN
- canonical decoded attributes

### Listing

Represents a listing instance.

Fields:

- `listing_id`
- `vehicle_id`
- source
- dealer
- VDP URL
- list price
- mileage
- first seen
- last seen
- status
- photos
- MarketCheck listing ID

### Dealer hierarchy

Preserve:

- dealer
- physical location
- rooftop
- website/source
- dealership group
- sub-group

Map MarketCheck IDs to internal Drevvy IDs.

---

## 11. MarketCheck Ingestion

### MVP / participating dealer

Use Dealership Inventory Syndication.

Pattern:

```text
Dealer joins Drevvy
→ pull dealer inventory
→ store/cache for 24 hours
→ serve through Drevvy
→ refresh next day
```

### MVP / nationwide consumer search

MarketCheck live search / MCP can provide nationwide coverage by querying local markets.

Do not bulk-cache normal search results unless the applicable MarketCheck endpoint/contract allows it.

### Future / nationwide feed

Target:

```text
MarketCheck daily feed
→ R2 landing bucket
→ validation
→ transform/normalize
→ canonical inventory storage
→ Typesense index update
→ data quality checks
→ active/inactive reconciliation
```

Need contract confirmation on:

- storage rights
- image rights
- feed delivery format
- snapshot vs delta
- schema changes
- consumer display rights
- MCP/API serving rights
- commercial usage rights

---

## 12. MarketCheck Feed Ingestion Pipeline

Recommended stages:

### 1. Landing

Store original feed file unchanged in R2.

```text
/marketcheck/raw/YYYY/MM/DD/feedname.csv.gz
```

Never alter the original landing file.

### 2. Validation

Check:

- file received
- expected date
- compression readable
- schema valid
- row count plausible
- required fields present

### 3. Normalize

Transform MarketCheck fields into Drevvy canonical schema.

### 4. Identity resolution

Map:

- VIN
- listing ID
- dealer IDs
- rooftop IDs
- dealer group IDs

### 5. Reconcile inventory state

Handle:

- new listings
- updated listings
- price changes
- removed listings
- stale listings
- attribution changes

### 6. Search-index publish

Update Typesense.

### 7. Archive

Write normalized Parquet files to R2 for long-term analytics.

---

## 13. Search Architecture for ChatGPT/OpenAI

The LLM should never query millions of raw inventory rows directly.

Expose narrow Drevvy tools such as:

- `search_vehicles`
- `get_vehicle`
- `compare_vehicles`
- `get_dealer`
- `get_offer`
- `request_quote`
- `submit_counter`
- `get_agent_status`

`search_vehicles` should:

1. accept structured filters/intention
2. query Typesense
3. apply Drevvy ranking/business rules
4. return a small result set
5. include only fields needed by the model

Example tool result:

```json
{
  "search_id": "search_123",
  "total_matches": 143,
  "results": [
    {
      "vehicle_id": "v_1",
      "year": 2025,
      "make": "Chevrolet",
      "model": "Tahoe",
      "trim": "Z71",
      "price": 58900,
      "mileage": 12200,
      "distance_miles": 43,
      "dealer_id": "d_22",
      "image_url": "...",
      "deal_score": 92,
      "preference_score": 97
    }
  ]
}
```

Return 10-20 strong results, not thousands.

---

## 14. Ranking and Recommendation Data

Whenever Drevvy ranks a vehicle, store the score components.

Potential fields:

- preference match
- price quality
- distance score
- dealer quality
- DOM score
- feature match
- inventory freshness
- market price delta
- dealer participation
- predicted negotiability
- predicted close probability

Example:

```json
{
  "preference_match": 96,
  "deal_score": 87,
  "distance_score": 91,
  "feature_match": 100,
  "dom": 63
}
```

This becomes training data when connected to outcomes.

---

## 15. Offer Data Model

Offers should be structured records, not only conversation text.

Suggested fields:

- `offer_id`
- `quote_id`
- `vehicle_id`
- `dealer_id`
- `shopper_id`
- `listed_price`
- `dealer_offer_price`
- `drevvy_counter`
- `dealer_counter`
- `final_vehicle_price`
- `dealer_fees`
- `mandatory_addons`
- `shipping`
- `trade_value`
- `finance_terms`
- `expiration`
- `status`
- timestamps

Keep the original conversation/transcript separately.

---

## 16. Negotiation State

A negotiation should have an explicit state machine.

Possible states:

```text
created
dealer_contacted
waiting_for_dealer
dealer_offer_received
shopper_review
counter_recommended
counter_authorized
counter_sent
dealer_counter_received
accepted
rejected
expired
closed
```

The agent should never infer authoritative deal state only from conversation history.

---

## 17. Agent Memory Architecture

Do not put all memory inside an LLM context window.

The agent should retrieve current state from Drevvy systems.

Examples:

### "What does the shopper want?"

→ Postgres shopper profile/preferences

### "What cars match?"

→ Typesense

### "What offer is currently open?"

→ Postgres negotiation/offer records

### "What happened with this dealer?"

→ structured negotiation + transcript archive

### "How does this dealer usually behave?"

→ ClickHouse-derived dealer intelligence

### "What should I do next?"

→ OpenAI reasoning over structured state

---

## 18. Agent Workflow / Orchestration

Initial implementation can use:

- queues
- scheduled jobs
- explicit state machine

Future complex workflows may justify Temporal or another durable workflow/orchestration system.

Example future workflow:

```text
contact 5 participating dealers
→ wait for responses
→ follow up with non-responders
→ normalize offers
→ rank offers
→ recommend top 2 to shopper
→ obtain shopper approval
→ counter
→ wait
→ notify shopper
```

Do not introduce a heavyweight workflow engine until needed.

---

## 19. Dealer Communication Data

Because participating dealers use Drevvy's app, prefer structured in-platform communication.

Capture:

- opportunity created
- delivered
- opened
- response latency
- salesperson/dealer responder
- offer
- counter
- decline reason
- fees
- add-ons
- availability
- final status

Twilio/ElevenLabs can remain optional channels for:

- notifications
- escalation
- dealer-requested voice
- SMS fallback
- urgent follow-up

Native Drevvy communication is more valuable for structured data collection.

---

## 20. Event Storage Strategy

### Operational

Recent/important state lives in Postgres.

### Raw permanent memory

Write immutable raw events to R2.

Partition by date:

```text
/events/year=2026/month=09/day=01/...
```

Prefer compressed Parquet for analytical archives.

### Analytics

Load/query high-volume events in ClickHouse.

The raw R2 archive should remain the durable source if downstream analytics schemas change.

---

## 21. PII Separation

Do not mix sensitive identity data into the general behavioral event stream.

Keep a protected identity store for:

- name
- email
- phone
- address
- verified identity data

Behavioral events should use:

- `anonymous_id`
- `user_id`
- internal IDs

Avoid raw PII in event properties.

---

## 22. Credit / Financing Data

Do not place raw credit reports into ClickHouse/R2 behavioral analytics.

Preferred pattern:

```text
consumer consent
→ credit/prequalification provider
→ structured eligibility result
→ limited Drevvy record
→ consumer-controlled disclosure to selected dealer
```

Log only the minimum necessary event/state information.

Examples, where legally permitted:

- financing verification completed
- eligibility status
- approved range
- provider reference ID

This area needs security and legal review before production.

---

## 23. Model and Version Tracking

Every AI-driven decision should record:

- model
- prompt version
- agent version
- ranking version
- experiment/version flags

This allows controlled evaluation.

Example:

```text
rank_v3
quote conversion: 4.1%

rank_v4
quote conversion: 6.3%
```

Without version tracking, Drevvy cannot reliably improve its models.

---

## 24. Analytics Questions Drevvy Should Eventually Answer

### Shopper

- What vehicles do shoppers with this intent actually buy?
- Which features are truly must-have?
- How does willingness to travel change close rate?
- How does price sensitivity change by segment?

### Search/ranking

- Which ranking positions drive saves?
- Which score components predict quotes?
- Which recommendations lead to purchases?
- Where does the agent over-rank vehicles?

### Dealer

- Which dealers respond fastest?
- Which dealers submit competitive first offers?
- Which dealers move on price after a counter?
- Which dealer groups add mandatory packages?
- Which dealers close which buyer types?

### Negotiation

- average discount from list
- discount by DOM
- counter success rate
- optimal counter size
- number of negotiation rounds
- response-time impact on close

### Acquisition

- campaign → search
- campaign → agent activation
- campaign → quote
- campaign → transaction
- CAC by completed purchase rather than install

---

## 25. The Moat Dataset

The core proprietary dataset is:

```text
Shopper Intent
      |
      v
Available Inventory
      |
      v
Drevvy Ranking
      |
      v
Shopper Behavior
      |
      v
Dealer Response
      |
      v
Offer / Counter
      |
      v
Transaction Outcome
```

This dataset can eventually power proprietary models for:

- purchase likelihood
- vehicle preference
- dealer selection
- negotiation strategy
- discount prediction
- close probability
- pricing intelligence
- lead quality

---

## 26. Infrastructure Evolution

### Stage 1

- Supabase/Postgres
- Vercel / Railway as currently useful
- MarketCheck MCP/API
- basic universal event collection

### Stage 2

- Cloudflare Workers API/MCP
- R2 raw archive
- Queues
- Postgres operational data
- Typesense search

### Stage 3

- MarketCheck enterprise/bulk API
- more dealer integrations
- ClickHouse analytics
- mature event taxonomy
- agent negotiation state

### Stage 4

- full MarketCheck nationwide feed
- storage/display rights
- Drevvy-owned national inventory index
- real-time VIN verification fallback
- advanced ranking/intelligence

### Stage 5

- proprietary predictive models
- dealer behavior intelligence
- transaction-level learning
- durable multi-day autonomous workflows with consumer authorization checkpoints

---

## 27. Engineering Rules

1. Do not use Postgres as the long-term clickstream warehouse.
2. Do not use the LLM as the authoritative state store.
3. Do not let ChatGPT query raw inventory tables directly.
4. Do not rely on VIN alone as a listing identifier.
5. Preserve original MarketCheck feed files.
6. Make all meaningful user/dealer/agent activity emit events.
7. Use stable IDs across the full funnel.
8. Keep PII separate from behavior data.
9. Track model/ranking/prompt versions.
10. Prefer structured offer/negotiation records over transcript-only state.
11. Keep MarketCheck live APIs as verification/fallback once Drevvy owns the search index.
12. Design the event system so today's MVP data remains useful for future model training.
