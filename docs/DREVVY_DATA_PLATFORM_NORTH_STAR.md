# Drevvy Data Platform North Star

This is a constraint for later data systems. It is not permission to build them now, and it is not permission to build a dealer app.

The product plan is [DREVVY_IMPLEMENTATION_PLAN.md](DREVVY_IMPLEMENTATION_PLAN.md). What exists today is [DREVVY_CURRENT_ARCHITECTURE.md](DREVVY_CURRENT_ARCHITECTURE.md).

## MVP application layer

Near term, the only shopper product is Autogentic. Dealer iOS and the dealer dashboard product are deferred.

```text
Shopper iOS (Ask + Shop)
        │
        ▼
Drevvy API (Vercel now, Railway for long jobs later)
        │
        ├── Supabase   live cases, offers, jobs, decisions
        ├── MarketCheck   Shop inventory
        └── Later: SMS, email, ElevenLabs voice
```

ChatGPT search may keep using the MCP server. It is not a second shopper app. Dealer surfaces can return in a later product. They are not required for the first paid outreach.

## What stays true

Supabase is the database for live state: the shopper account, the case, the mandate, the current offer, whether the shopper paid, and whether a job was sent.

Analytics is a history of events, not a replacement for those rows. High-volume events can move to an object store and ClickHouse later. Do not deploy that infrastructure for this MVP.

Do not use ClickHouse as the car search engine. Shop search reads MarketCheck through the API. A future search index, if any, is a rebuildable copy.

Stable ids connect the journey: `consumer_user_id`, `session_id`, `negotiation_case_id`, `external_listing_id`, `vin`, `policy_version`, `offer_id`, `outreach_job_id`, `agent_action_id`, `event_id`. `marketcheck_dealer_id` is a server id. It is not shown to the shopper and it is not a substitute for a shopper id.

Keep history when the fact is a change: price before and after, state before and after, each offer version, each decision, each outreach attempt. The case row may point at the current offer. It must not be the only copy.

Shopper email and phone stay in the auth system. They do not go in event properties, in dealer messages, or in a future warehouse. Dealer phone numbers used to send SMS stay on the server and out of shopper responses.

`leads.enc_payload` is the old ADF contact blob. Do not copy it into case events.

## Events to emit with the feature

Product events: `search_started`, `search_completed`, `inventory_impression`, `vehicle_viewed`, `shopper_signed_in`, `ask_submitted`, `shop_submitted`.

Domain events: `negotiation_created`, `shopper_mandate_approved`, `payment_recorded`, `negotiation_state_changed`, `dealer_contacted`, `dealer_response_received`, `offer_received`, `deal_accepted`, `deal_closed`.

Both kinds can live in the current Supabase event tables until volume requires a separate pipeline. New events must carry the ids above and must not carry contact fields.

Existing tables `analytics_events` and `app_events` are the starting stores. Do not add a third log in the first analytics change. Their current `source` checks are narrower than this list. A later migration may widen `source`. Do not break old rows.

## Vercel and Railway

Vercel: shopper HTTP routes, auth checks, search, creating a case.

Railway: provider sends and reply handling once those calls are long-running or need a worker. Do not add that service until Phase 4 of the implementation plan.

## Checklist

Before a coding phase:

1. What is stored in Supabase as live state?
2. Which events are emitted?
3. What history must not be overwritten?
4. Which ids tie the event to the case and the listing?
5. Could the rows be copied to a warehouse later without shopper contact fields?
6. Is dealer identity absent from the shopper payload?
7. Is this a short API call or a long job?
8. Would this make a later event lake or search index harder?

Do not add ClickHouse, a queue, object storage, or a search cluster to satisfy this document.
