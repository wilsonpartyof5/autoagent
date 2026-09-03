# Drevvy Context

_Last updated: 2026-09-01_

## Purpose

This file is the strategic source of truth for Drevvy. Use it to understand the product vision, business model, MarketCheck relationship, consumer and dealer experiences, current assumptions, and major product decisions.

When making recommendations or changing the codebase, preserve the product direction in this document unless a newer decision explicitly overrides it.

---

## 1. What Drevvy Is

Drevvy is an AI-powered automotive shopping platform built around a consumer-side buyer's agent and a dealer-side communication/offer platform.

The long-term product is not simply a vehicle search marketplace.

The goal is for a shopper to tell Drevvy what they want in natural language, then have Drevvy:

1. Understand the shopper's preferences and constraints.
2. Search broad U.S. vehicle inventory.
3. Rank the strongest matches.
4. Help the shopper compare vehicles.
5. Communicate with participating dealerships on the shopper's behalf.
6. Gather and compare offers.
7. Recommend counters or next actions.
8. Protect the shopper's personal information until disclosure is necessary and authorized.
9. Help move the shopper toward a completed transaction.

A simple product framing:

> Tell Drevvy what you want. Drevvy finds the vehicles, contacts participating dealers, compares the offers, and brings the best options back to you without forcing you to give every dealership your personal information.

Drevvy should be thought of as an **AI buyer's agent with access to nationwide inventory**, not merely an AI search interface.

---

## 2. User Surfaces

Drevvy is expected to have multiple user-facing surfaces that share one backend and one intelligence layer.

### Consumer surfaces

- ChatGPT app / MCP experience
- Native mobile app
- Potential web experience

### Dealer surfaces

- Dealer mobile app
- Dealer dashboard
- Internet-team / salesperson inbox
- Offer and counteroffer workflow
- Dealer analytics and opportunity tracking

### Shared backend

Both consumer and dealer surfaces should use the same:

- shopper profile
- inventory layer
- agent state
- dealer records
- quote / offer / negotiation system
- transaction state
- event stream
- intelligence and ranking services

Avoid building separate "brains" for ChatGPT and mobile.

---

## 3. Consumer Agent Vision

The future Drevvy agent should let a shopper express real-world preferences, not just database filters.

Examples:

- budget
- monthly payment preference
- cash / finance / lease
- trade-in
- new / used / CPO
- make / model / trim
- mileage tolerance
- color
- required features
- nice-to-have features
- excluded features
- preferred radius
- willingness to travel
- purchase timeframe
- lowest price vs convenience
- willingness to buy out of state

Example shopper request:

> Find me a 2024-2025 Tahoe Z71, black or dark gray, under 25k miles, under $60k. I care more about the best out-the-door deal than distance. Don't give dealers my phone number until I approve a deal.

The agent should:

- convert natural language into structured intent
- search Drevvy's inventory layer
- score matching vehicles
- narrow to a shortlist
- verify high-intent inventory before outreach when appropriate
- communicate with participating dealers
- normalize dealer offers and fees
- recommend next actions
- ask the shopper for approval at material decision points

The shopper should remain the final decision-maker.

---

## 4. Dealer App Vision

Drevvy should not rely primarily on cold-calling or emailing dealerships that have never opted into the platform.

The preferred model is a dealer-side Drevvy app used by:

- internet sales teams
- BDC teams
- salespeople
- managers

Dealer workflow:

1. Dealer joins Drevvy.
2. Drevvy has the dealer's inventory available.
3. A matched shopper activates the agent.
4. The dealer receives a structured opportunity in the Drevvy dealer app.
5. Dealer can respond with price, fees, add-ons, financing terms, availability, etc.
6. Drevvy compares the offer with other participating dealers.
7. The consumer can authorize counters or move forward.

Example dealer-side request:

> Shopper is interested in VIN X. Purchase timeframe: 7-14 days. Financing: yes. Trade-in: no. Please provide your best selling price, dealer fees, required add-ons, and any applicable incentives.

The dealer app should eventually create a structured transaction channel rather than an unstructured lead handoff.

This supports a stronger dealer value proposition:

> Drevvy sends your team active shoppers matched to specific vehicles in your inventory. Your team can respond, make offers, and communicate without chasing cold leads.

---

## 5. Privacy and Identity Strategy

A major consumer benefit is minimizing unnecessary exposure of personal information.

Preferred model:

- shopper can browse and activate the agent without immediately giving every dealer their direct phone/email
- dealer initially sees a Drevvy shopper identity / session identity
- Drevvy acts as the communication layer
- consumer authorizes when additional personal information is released
- only the minimum necessary information should be shared at each stage

Potential proxy model:

- masked email
- proxy messaging identity
- shopper session ID
- Drevvy-mediated communication

Drevvy should not imply it can bind the consumer to a purchase unless legal review explicitly supports that model.

---

## 6. Legal/Product Boundary

The intended early positioning is:

> Drevvy shops the market and communicates with participating dealers on the consumer's behalf to help find the best offer.

Do not rely on wording alone to avoid broker/dealer regulation. Actual conduct matters.

Initial product guardrails:

- Drevvy does not take title to vehicles
- Drevvy does not sign purchase agreements for the consumer
- Drevvy does not accept vehicle purchase funds or deposits unless separately reviewed
- Drevvy does not bind the shopper to a deal
- material offers / counters should be authorized by the shopper
- dealership and consumer ultimately contract directly
- participating dealers opt into the Drevvy platform
- financing and required legal disclosures remain with licensed dealers/lenders

A 50-state automotive regulatory review should happen before fully autonomous negotiation or transaction-based compensation is scaled nationally.

---

## 7. MarketCheck Role

MarketCheck is the intended upstream automotive inventory/data provider.

The strategic principle is:

> MarketCheck supplies the raw inventory/data layer. Drevvy owns the search, ranking, consumer relationship, agent, dealer workflow, offer system, analytics, and transaction intelligence.

MarketCheck should not remain the live search engine for every Drevvy interaction at mature scale.

### Target long-term architecture

MarketCheck Data Feed  
→ Drevvy ingestion pipeline  
→ Drevvy inventory database/search index  
→ Drevvy API/MCP  
→ ChatGPT + mobile app

### MVP architecture

For MVP/demo use:

- MarketCheck MCP / live API can provide broad nationwide inventory search coverage.
- Standard plan can support a nationwide MVP because users across the U.S. can search their local markets.
- Standard is not the same as one unrestricted nationwide single-query database search.
- The current standard search experience still has radius/pagination constraints.

For participating dealers:

- use MarketCheck Dealership Inventory Syndication
- one call per rooftop can pull the rooftop's inventory
- 24-hour caching is allowed
- refresh daily
- Kash described the economics as roughly $1 per rooftop per daily call, about $30-$31/month per rooftop if refreshed daily

---

## 8. MarketCheck Sales Call: Confirmed Context

Meeting date: 2026-08-26  
MarketCheck contact: Kash Wasti

Important points from the call:

### API vs Data Feed

- API = live integration; pull data as needed
- Data Feed = bulk delivery of active inventory
- full feed is intended for large-scale nationwide ingestion
- data feed and API use the same underlying data delivered differently

### Dealer Inventory Syndication

- designed for dealer-specific inventory
- one call per rooftop
- up to the expanded inventory pagination discussed on the call
- 24-hour caching allowed
- refresh once per day

### General Inventory Search

- live search
- generally no caching
- intended for market / competitive / shopper searches
- search results and deep pagination are constrained compared with a bulk feed

### Enterprise / Bulk API

MarketCheck described two enterprise paths:

1. Bulk API / enterprise pricing
2. Full data feed

Bulk API enterprise discussions typically begin around approximately **$5,000/month of usage**.

Kash recommended starting the conversation at approximately **$4,000/month of actual usage** so contracting does not lag behind growth.

### Full U.S. Feed

Kash quoted approximately **$15,000-$17,000/month** for daily U.S. new + used inventory in the context of storage/building a database.

Important: confirm in writing whether the $15k-$17k figure explicitly includes storage rights and what exact rights are granted.

A lower-cost option may exist if Drevvy consumes each daily file without retaining a long-term database.

### Coverage

Kash said MarketCheck considers its U.S. coverage effectively nationwide, approximately 98%.

If a dealer is missing:

- send MarketCheck the dealer website
- MarketCheck can usually add it quickly
- Kash indicated roughly 48 hours outside weekends/holidays

This is important because it reduces the need for custom inventory integration for every small dealer.

### Refresh / Sold Logic

- MarketCheck refreshes dealer inventory daily
- no midday refreshes
- if a vehicle disappears and remains offline for seven days, MarketCheck treats it as sold approximately 92% of the time according to Kash
- MarketCheck can reverse that classification if the vehicle reappears later

For Drevvy consumer search, a vehicle should generally be suppressed once it is no longer active rather than waiting seven days for "sold" classification.

---

## 9. MarketCheck Data-Feed Knowledge

MarketCheck documentation and its API AI agent indicate:

### Data feed variants

- Full Feed: all listings, including duplicate representations
- Attributed Feed: unique searchable/attributed listings
- Combined Feed: inventory + NeoVIN enrichment

Likely preferred Drevvy configuration:

> U.S. New + Used Attributed Feed + NeoVIN enrichment + vehicle photos / photo URLs

### Delivery mechanisms

Documented options include:

- AWS S3
- SFTP / FTP
- Azure Blob
- Google Cloud Storage
- Dropbox / Google Drive for testing

MarketCheck prefers delivery to client-owned infrastructure.

### Coverage and data volume

Documentation discussed:

- 80,000+ U.S. websites crawled daily
- roughly 15 million daily listings
- 45,000+ U.S. dealer sites in another coverage reference
- 8,200+ Canadian dealer sites
- U.S. dealer data crawled daily
- auction/private-party sources generally every 48 hours

Do not interpret 15M listings as 15M unique vehicles. Deduplication/attribution matters.

### Key identifiers

Documented MarketCheck identifiers include:

- `id` — listing instance
- `vin`
- `mc_dealer_id`
- `mc_website_id`
- `mc_location_id`
- `mc_rooftop_id`
- `mc_dealership_group_id`
- `mc_sub_dealership_group_id`

`is_searchable = 1` identifies the attributed/searchable listing.

Drevvy should preserve the dealer hierarchy.

### Important inventory fields

Available fields include:

- VIN
- year / make / model / trim
- price / MSRP
- mileage
- dealer identity/contact
- address
- city/state/ZIP
- latitude/longitude
- VDP URL
- photos / photo links
- options / features
- drivetrain
- engine
- fuel
- transmission
- colors
- MPG
- days-on-market metrics
- first seen
- last seen
- status date
- price changes

### DOM fields

Relevant fields include:

- `dom`
- `dom_active`
- `dom_180`
- `dos_active`

### Historical data

Documentation indicates:

- Past Inventory Search API: approximately 90 days
- historical U.S. dealer data available back to 2015
- large historical feed exists
- historical dataset can support future intelligence around price, DOM, dealer behavior, and transaction likelihood

---

## 10. Vehicle Images

Vehicle images are required for the Drevvy consumer experience.

MarketCheck data includes:

- `photo_url`
- `photo_links`

Standard APIs also have cached-image capabilities.

Still requiring contract confirmation:

- image URL stability
- whether cached/proxied image URLs are included in enterprise feeds
- whether Drevvy can cache/re-host images
- maximum photo count
- display rights
- storage rights
- image CDN rights

Do not assume storage rights for inventory automatically include image redistribution rights.

---

## 11. NeoVIN

NeoVIN is MarketCheck's 17-digit VIN decoding/enrichment product.

Kash described it as capable of providing very detailed equipment data and OEM/window-sticker-level information.

Documented enrichment can include:

- year
- make
- model
- trim
- vehicle/body type
- drivetrain
- transmission
- engine
- fuel type
- cylinders
- MPG
- doors
- installed options/packages and deeper equipment details depending on product

NeoVIN can be:

- standalone
- combined with inventory feed

This can help Drevvy match natural-language feature preferences to actual vehicles.

---

## 12. MarketCheck Price

Kash recommended MarketCheck Price as potentially valuable.

Use case:

- used vehicles
- local-market retail valuation
- considers comparable inventory and vehicle configuration
- intended to produce a price aligned with an approximate selling-time target
- 24-hour caching allowed
- Kash quoted roughly $0.07 per call in the meeting; verify before modeling

Potential Drevvy use:

- deal scoring
- negotiation context
- shopper recommendations
- dealer pricing guidance
- compare list price vs market price

Kash cited internal MarketCheck accuracy claims. Treat these as vendor claims unless independently verified.

---

## 13. Incentives API

Kash also mentioned:

- incentives data can be pulled daily
- 24-hour caching allowed

Potential Drevvy use:

- new-vehicle rebates
- applicable incentives
- dealer-side pricing context
- consumer offer comparisons

---

## 14. Real-Time Inventory Verification

At mature scale, most shopper searches should hit Drevvy's own inventory search index.

MarketCheck APIs can remain useful as live fallback/verification.

Potential workflow:

Drevvy local search  
→ shortlist  
→ shopper shows purchase intent  
→ MarketCheck live VIN/listing verification  
→ dealer communication / quote request

This keeps high-volume search internal while preserving freshness at high-intent moments.

---

## 15. Business Model Direction

The product has evolved beyond a pure pay-per-lead marketplace.

Potential revenue streams include:

### Consumer

- paid AI buyer's agent
- historical working assumption: around $99 while shopping
- likely 1-2 month shopping lifecycle for many users

### Dealer

- lead / opportunity fee
- transaction/acquisition fee
- SaaS / analytics products
- premium dealer participation
- data products / dealer intelligence over time

### Transaction model

A prior model explored approximately:

- $100 consumer-side value
- $200 dealer-side transaction value
- approximately $300 total revenue per closed transaction

Treat this as a working business model, not a final price commitment.

---

## 16. Proprietary Moat

MarketCheck inventory is not itself the moat.

The long-term moat should be Drevvy's first-party transaction and behavior data.

Drevvy should learn:

- what shoppers actually want
- what inventory was available at that moment
- what Drevvy recommended
- which vehicles shoppers clicked/saved/rejected
- which dealers responded
- response timing
- actual dealer offers
- fees and add-ons
- negotiation paths
- consumer acceptance/rejection
- final transaction outcomes

Long-term proprietary intelligence may include:

- which vehicle a specific shopper is likely to buy
- which dealer is likely to respond
- which dealer is likely to discount
- likely discount range
- likely response channel
- when to counter
- which competing vehicle creates leverage
- probability of close
- dealer behavior by make/model/DOM/geography

The closed-loop dataset is:

> Intent → Inventory → Recommendation → Interaction → Dealer Behavior → Offer → Negotiation → Transaction

That is the core Drevvy data moat.

---

## 17. Credit / Financing Vision

Drevvy may eventually integrate a credit/prequalification provider such as Experian or another provider.

Preferred design:

- consumer explicitly authorizes the check
- provider performs appropriate soft-pull/prequalification or other permitted process
- Drevvy receives only the minimum necessary structured result
- Drevvy should avoid storing raw full credit reports in general analytics systems
- shopper controls disclosure to selected dealer/lender

Potential dealer-facing signal:

- financing verified
- broad eligibility / approved range
- appropriate tier or program information where legally permitted

This area requires dedicated FCRA/privacy/permissible-purpose review before implementation.

---

## 18. Current Technology Direction

Current build has used:

- Supabase
- Vercel
- Railway

Future architecture should separate workloads rather than force everything into one database/provider.

Strategic infrastructure direction:

- Cloudflare Workers for API/MCP gateway
- Postgres for transactional system of record
- Cloudflare R2 for raw files/data lake
- Cloudflare Queues for event/background pipelines
- Durable Objects for live agent/session coordination where useful
- Typesense or comparable search engine for vehicle search
- ClickHouse for high-volume analytics
- Twilio + ElevenLabs for optional voice/SMS communication where needed
- OpenAI for reasoning and agent capabilities

Do not overbuild infrastructure before traffic requires it, but preserve the architecture boundaries.

---

## 19. Open Questions

### MarketCheck

- Does the quoted $15k-$17k include storage rights?
- What exact storage rights are granted?
- Does the contract allow Drevvy to serve inventory through its MCP/API?
- Does it allow consumer-facing display in ChatGPT/mobile?
- Does it allow transaction/lead monetization?
- Are images included?
- Can images be cached/re-hosted?
- Full vs Attributed vs Combined feed pricing
- snapshot vs delta delivery
- historical feed pricing
- schema versioning/change policy
- enterprise API SLA and rate limits
- volume discount structure

### Product/legal

- state-by-state broker/dealer classification
- transaction-based dealer fees
- agent authority boundaries
- financing/prequalification workflow
- call recording/AI disclosure if voice is used
- consumer privacy / masked identity design

---

## 20. Product Principle

When evaluating features, architecture, or monetization, preserve this hierarchy:

1. Consumer gets a materially easier car-buying experience.
2. Dealer gets high-intent, structured opportunities rather than junk leads.
3. Drevvy owns the communication and intelligence layer.
4. MarketCheck remains the upstream inventory provider, not the end-user product.
5. Every meaningful interaction should improve Drevvy's proprietary data loop.
