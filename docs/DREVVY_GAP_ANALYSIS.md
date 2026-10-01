# Drevvy Gap Analysis

Updated 2026-10-01 for the shopper-only product. Compared with the repo on `main` and with draft pull requests #37–#40, which are unmerged.

The build order is [DREVVY_IMPLEMENTATION_PLAN.md](DREVVY_IMPLEMENTATION_PLAN.md).

## What changed

Dealer-app gaps are **deferred**, not the next work. These are no longer MVP requirements:

- An in-app thread between shopper and dealer.
- Dealer iOS reading cases through `DealerAPI`.
- A dealer inbox on the dashboard.
- Opening a case only when the car is an onboarded UVS row.

The gaps that matter now are Ask vs Shop, hiding dealer identity, a paid case, outbound SMS/email/voice, and journey analytics.

## Shopper product

| Need | Status | Notes |
| --- | --- | --- |
| One shopper iOS app | existing | [apps/autogentic](../apps/autogentic). Do not start a second app. |
| Ask mode for research | partial | `POST /api/query/chat-search` returns inventory in chat. Threads are not saved. |
| Shop mode by make, budget, and area | partial | MarketCheck search exists. It is not yet a distinct Shop mode, and responses still expose dealer fields. |
| Hide dealer identity from the shopper | missing | Cards, map, and detail still carry dealer name and contact data from the listing payload. |
| Dealer id kept only on the server | missing | The phone can see dealer fields the server returns. |
| Shopper sign-in for a multi-day paid case | missing on `main` | Draft #39 has Sign in with Apple, a server session, and Keychain storage. Not merged. |
| Shopper pays Drevvy before outreach | missing | No charge row and no gate. |
| Case from a MarketCheck listing | missing on `main` | Draft #40 requires a `uvs_vehicles` row and a `dealerships` row. That rule is cancelled. |
| Mandate, policy, market snapshot | missing on `main` | The ideas in #40 are worth keeping. The UVS-only foreign keys are not. |
| Offers with an out-the-door total | missing | No offer table. |
| SMS, email, and voice outreach | missing | Do not use ADF. No provider integration in the plan change. |
| Journey analytics through accept-deal | missing | Search and widget events exist. They do not follow one shopper case. |
| No ADF on the new path | existing as a rule | `leads` and ADF still exist for the old ChatGPT lead tool. New cases must not write them. |

## Explicitly deferred

| Old requirement | Status now |
| --- | --- |
| Dealer replies inside a Drevvy thread | Deferred. Replies come back as SMS, email, or voice transcripts. |
| Dealer iOS live API rollout | Deferred. |
| Dashboard agent inbox | Deferred. |
| Salesperson assignment in the dealer app | Deferred. |

## Summary

Build the shopper app and the server behind it. Keep MarketCheck as the Shop inventory source. Keep shopper auth and the case ideas from the draft pull requests. Drop the dealer-app roadmap.

The largest gaps are: dealer fields still visible to the shopper, no shopper account on `main`, no paid MarketCheck case, no outreach jobs, and no accept-deal journey.
