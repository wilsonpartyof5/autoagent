# Drevvy Implementation Plan

Updated 2026-10-01 for the shopper-only pivot. This plan replaces the old Phase 4–6 roadmap. Those phases are cancelled below. Do not start them.

The audit facts live in [DREVVY_CURRENT_ARCHITECTURE.md](DREVVY_CURRENT_ARCHITECTURE.md). What the new product still lacks is in [DREVVY_GAP_ANALYSIS.md](DREVVY_GAP_ANALYSIS.md). The data-platform constraint is [DREVVY_DATA_PLATFORM_NORTH_STAR.md](DREVVY_DATA_PLATFORM_NORTH_STAR.md).

This document is a plan and a schema sketch. It does not add SMS, email, or voice provider code, and it does not apply a database migration.

## Product

Drevvy for this MVP is one shopper iOS app: [apps/autogentic](../apps/autogentic), Xcode project `Autogentic.xcodeproj`. The in-app name is Drevvy.

The shopper uses a chat with two modes:

1. **Ask** — research which car to buy. Keep the existing MarketCheck chat-search path.
2. **Shop** — search inventory by make, budget, and area through **MarketCheck**. Cards, the map, and details show price. They hide dealer name, phone, address, and website. Dealer ids stay on the server.

The shopper pays Drevvy to contact dealers and get the best out-the-door price. Outreach is SMS, email, and some voice (ElevenLabs), using negotiation rules for line items, comps, and days on the lot. This MVP does not send ADF or CRM lead email.

Dealer iOS ([apps/drevvy-dealer](../apps/drevvy-dealer)) and the dealer dashboard as a dealer product are deferred. The Next.js app may keep hosting shopper APIs. It is not the near-term place to build a dealer inbox.

## Cancelled

These phases from the 2026-09-24 plan are **cancelled**. Do not implement them.

| Old phase | What it was | Why it stopped |
| --- | --- | --- |
| Phase 4 — in-app messaging | Shopper and dealer share a thread inside Drevvy, with visibility rules and a dealer inbox. | Dealers are not in the app. The agent contacts them by SMS, email, and voice. |
| Phase 5 — Autogentic as a dealer thread | Phone UI for dealer messages, approvals, and an in-app deal conversation. | The phone UI is Ask and Shop chat, plus the shopper’s own case status. It is not a dealer messenger. |
| Phase 6 — live DealerAPI / dealer app | Turn on `LiveDealerAPI`, push, and a dealer case inbox. | Dealer iOS and the dealer product are deferred. |

Also cancelled as an MVP rule: a negotiation case may be opened only when the listing is an onboarded UVS dealer. Shop mode uses MarketCheck listings. UVS is not required to open a case.

Do not apply the draft migration in pull request #40 until it is rewritten for MarketCheck listings and this outreach model. That migration requires `uvs_vehicles` and `dealerships` rows.

## Salvage from draft pull requests #37–#40

Leave those pull requests **open and unmerged**. Do not rebase the stack onto `main` in order to continue the old phases. The next coding change starts from `main` (after this plan) and copies only the pieces below.

| PR | Branch | Keep | Do not carry forward |
| --- | --- | --- | --- |
| [#37](https://github.com/wilsonpartyof5/autoagent/pull/37) | `cursor/drevvy-phase-0-audit-17ff` | The map of Autogentic, MarketCheck, auth, and ADF. | The old Phase 4–6 build order. This plan replaces it. |
| [#38](https://github.com/wilsonpartyof5/autoagent/pull/38) | `cursor/drevvy-phase-1-canonical-search-17ff` | One server-side search helper and ranker. Shop mode should call MarketCheck through it. | A requirement to prefer UVS, and a Drevvy-dealer boost, for shopper Shop results. |
| [#39](https://github.com/wilsonpartyof5/autoagent/pull/39) | `cursor/drevvy-phase-2-consumer-auth-17ff` | Sign in with Apple, server session, Keychain, and private routes that reject the shared inventory key. | Treating that work as dealer identity. Email stays in Supabase Auth, not in shopper analytics. |
| [#40](https://github.com/wilsonpartyof5/autoagent/pull/40) | `cursor/drevvy-phase-3-negotiation-domain-17ff` | Case, alias, mandate, versioned policy, market snapshot, state history, agent action log, and “create case does not write a lead.” | In-app dealer actor, dealer-app reads, and `listing_id` as a required `uvs_vehicles` foreign key. |

## Build order

```text
Plan (this change)
    │
    ├── 1  Shopper auth          salvage #39
    ├── 2  Shop search           MarketCheck, hide dealer identity; align #38
    ├── 3  Case, offers, jobs, decisions
    │         rewrite #40 for MarketCheck listings
    ├── 4  Outbound dealer channel
    │         SMS, email, voice jobs — not an in-app dealer
    ├── 5  Agent loop
    │         rules first, model only for wording
    ├── 6  Journey analytics
    └── 7  LLM bakeoff           later, not part of the first outreach

Ask mode stays on the existing chat-search route. It is not a separate phase.
Dealer iOS and dealer-dashboard product work are not in this list.
```

The next coding step for the backend is **Phase 1, shopper auth**, taken from #39 and retargeted at paid multi-day cases. Do not start SMS, Telnyx, or ElevenLabs in that change.

## Rules

- One shopper app. Extend Autogentic. Do not start a second consumer app.
- Shop results come from MarketCheck. Dealer name and contact fields are removed in the server response the phone renders. The server keeps `marketcheck_dealer_id` for outreach.
- Ask may keep the current chat-search behavior. It must not become a second ranker inside the phone.
- A case is not a `leads` row and does not call ADF.
- The shopper’s email and phone stay out of dealer messages and out of analytics properties. Drevvy contacts the dealer. The dealer sees an alias, not the shopper’s contact card.
- Shopper-facing case reads return price, vehicle, offer lines, and agent status. They do not return dealer identity.
- Outreach is a job (`sms`, `email`, or `voice`) with a provider id and a status. A job cannot be sent until the case has a paid Drevvy charge. The provider integration is a later phase, not this plan.
- Negotiation rules (which line items to challenge, how to use comps and days on the lot, when a human must approve) live in a versioned policy. The model may phrase a message. It may not move deal state or send a job by itself.
- Every shopper step that matters is an append-only event: search, view, decision, outreach, dealer reply, offer, accept.
- Supabase remains the live database. ClickHouse, an event lake, and a separate search engine stay future work.

## Schema sketch

Not a migration. Do not apply this until a later phase writes the SQL. Names can change. The rules cannot: MarketCheck listings are enough, dealer identity is server-only, history is append-only, and outreach is jobs rather than an in-app dealer user.

**Shopper profile.** `consumer_user_id` references `auth.users`. Status and timestamps. No email column. Salvage the idea from #39.

**Shopper alias.** Public code such as `A8F21`. Dealer-facing text uses the code only.

**Negotiation case.** `id`, `consumer_user_id`, `shopper_alias_id`, `listing_source` (`marketcheck` for MVP), `external_listing_id`, `vin`, `marketcheck_dealer_id` (server only; not in shopper JSON), optional `dealership_id` when a rooftop row happens to exist, `policy_id`, `policy_version`, current `state`, `outcome`, timestamps. No required foreign key to `uvs_vehicles`. No foreign key to `leads`.

**Shopper mandate.** One current version per case, older versions kept. Max price, max out-the-door, must-haves, deal-breakers. `approved_at` is required before the first outreach job is sent.

**Negotiation policy.** Monotonic `version`, effective window, rules for autonomous actions, approval gates, and a contact deny-list. Cases pin `policy_version`.

**Vehicle market context.** Append-only snapshot: asking price, days on market, comp count, local median, price versus median, confidence, `generated_at`. Built from normalized MarketCheck fields. Raw provider payloads are not copied onto the shopper case.

**Offer and offer line items.** A new row per version. Selling price, taxes, title, doc fee, required add-ons, optional add-ons, out-the-door total. The previous offer stays.

**Shopper decision.** Append-only. `viewed`, `passed`, `shortlisted`, `asked_to_contact`, `accepted_offer`, `declined_offer`. This is the accept-deal trail.

**Payment.** A charge row on the case: amount, status (`pending`, `paid`, `failed`, `refunded`), provider reference. Outreach jobs stay blocked until status is `paid`. No provider is chosen in this plan.

**Outreach job.** `case_id`, `channel` (`sms`, `email`, `voice`), status (`queued`, `sent`, `failed`, `replied`), provider message id, timestamps. Idempotency key. Creating a job does not insert `leads`.

**Outreach message.** Append-only. Direction `outbound` or `inbound`, channel, body, and a shopper-safe summary. Raw dealer text can be stored for the agent. Shopper reads get the summary, still without dealer contact fields.

**Agent action.** Tool name, idempotency key, `policy_version`, redacted input and output, case id. State changes and sent jobs are written only through this log.

**Journey events.** Use the existing `app_events` / `analytics_events` envelope. Properties include `consumer_user_id`, `negotiation_case_id`, `external_listing_id`, `vin`, and `policy_version` when they exist. Properties do not include shopper email, phone, or dealer phone.

Suggested states, not a single line: `draft`, `mandate_approved`, `paid`, `outreach_queued`, `awaiting_dealer`, `offer_received`, `awaiting_shopper`, `accepted`, `closed_lost`, `expired`. Terminal states do not reopen. A mandate edit returns the case to `draft` and requires approval again before another job.

## Phases

### Phase 1 — Shopper auth

**Build.** Bring forward Sign in with Apple, the server session, and Keychain storage from #39. Private routes require that session. The shared inventory key, if it remains for a public search, cannot open a case or a payment.

**North Star.** Transactional: shopper profile linked to `auth.users`. Event: `shopper_signed_in` with `consumer_user_id` only. History: status changes are timestamped. Host: Vercel. Conflict to avoid: using the shared API key as the shopper id.

The bundle id `com..Autogentic` stays a placeholder until provisioning is confirmed.

### Phase 2 — Shop search

**Build.** Shop mode calls one server search that uses MarketCheck. Align the shared ranker from #38, with MarketCheck as the source. Responses used by the phone include price, year, make, model, mileage, and distance. They omit dealer name, phone, address, website, and dealer id. The server may keep the dealer id on the listing record it stores for a later case.

**North Star.** Product events: `search_started`, `search_completed`, `inventory_impression`, `vehicle_viewed`. No dealer contact fields in those properties. Search index: none. Host: Vercel for the phone route. Conflict to avoid: rendering dealer identity on the card, the map pin, or the detail screen.

Ask mode keeps `POST /api/query/chat-search`. Do not fork a second ranker in Swift.

### Phase 3 — Case, offers, jobs, and decisions

**Build.** Rewrite the #40 domain. A shopper session can open a case from a MarketCheck listing id. Save mandate versions, market snapshots, offer versions, shopper decisions, and outreach job rows. Creating a case does not insert `leads` and does not call ADF. Job rows can be queued only after mandate approval and a paid charge. This phase stores the job. It does not call SMS, email, or voice providers.

**North Star.** Transactional: case, mandate, policy, market context, offers, decisions, payment, outreach jobs, agent actions. Domain events: `negotiation_created`, `shopper_mandate_approved`, `payment_recorded`, `negotiation_state_changed`. History: mandates, offers, decisions, and state events are append-only. IDs: `negotiation_case_id`, `external_listing_id`, `vin`, `policy_version`, `consumer_user_id`. `marketcheck_dealer_id` is stored and is not a shopper-facing field. Host: Vercel. Conflict to avoid: a required UVS dealer foreign key, or an in-app dealer user on the message.

### Phase 4 — Outbound dealer channel

**Build.** A worker sends queued jobs through SMS, email, and ElevenLabs voice, and stores inbound replies as outreach messages. Provider credentials stay on the server. Shopper text in the phone is the agent summary.

**North Star.** Domain events: `dealer_contacted`, `dealer_response_received`. History: messages are append-only. Host: Vercel accepts the shopper request; the send/receive loop belongs on Railway once it is long-running. Conflict to avoid: ADF email, or putting the shopper’s phone number in the dealer SMS.

This is the replacement for old Phase 4. It is not an in-app dealer thread.

### Phase 5 — Agent loop

**Build.** A rules-first loop reads the pinned policy, the market snapshot, and the latest offer. It may draft the next outreach body. Sending and state changes go through agent actions. The model does not choose a new policy and does not skip the payment or mandate gates.

**North Star.** `agent_action_id`, `policy_version`, and `market_context` version are stored on the action. Conflict to avoid: prompt text as the only copy of the rules.

### Phase 6 — Journey analytics

**Build.** One query path for the full shopper journey: searches, vehicles viewed, decisions, outreach, replies, offers, and accepted deal. The accept-deal count is a first-class outcome on the case, not a lead status.

**North Star.** Events already emitted in earlier phases are the source. No new warehouse. Properties stay free of shopper and dealer contact fields. Conflict to avoid: a third event table that drops `negotiation_case_id`.

### Phase 7 — LLM bakeoff

**Later.** Compare models for wording quality only, using the same policy and the same tools. Not scheduled until Phases 4–6 have real transcripts. Do not block outreach on this.

## Checklist before each coding phase

1. Which Supabase tables does this change write?
2. Which events does it emit, and which ids do they carry?
3. What history must stay append-only?
4. Does any shopper response include a dealer name or dealer contact field?
5. Can a case be created from a MarketCheck listing with no UVS row?
6. Does this write `leads` or send ADF? If yes, stop.
7. Is this a short Vercel request or a long Railway job?
8. Are we about to build dealer-app screens? If yes, stop.

## Not scheduled

- ClickHouse, object storage, a queue product, or a dedicated search engine.
- Dealer iOS features, `LiveDealerAPI` rollout, and a dealer inbox.
- Renaming AutoAgent packages or the Autogentic bundle id.
- Replacing the legacy ChatGPT `submit-lead` tool in this MVP. It stays unused by the new shopper outreach path.
