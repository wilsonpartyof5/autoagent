# Dealer desk, rooftops, and shopper VDP CTAs

Shopper keys and vehicle-detail CTAs follow the 2026-10-27 locked model. Live matching uses `dealerships` plus `user_dealerships`. The dealer desk at `/dealer` is still the #102 mock scaffold: it does not authenticate anyone and it does not persist rooftops.

This is not the dealer portal removed in October 2026. The public page at `/dealers` is unchanged. The operator console at `/admin` is unchanged. Do not rename the Vercel project `autoagent-dealer-dashboard`.

## Locked rules

- Packs are **generic keys**. Spend kind is assigned at use: market intel, or a dealer conversation when the listing matches an onboarded rooftop.
- Off-network OTD request CTA is **free** (no key). Persist for analytics/acquisition only. Not chat. Not Telnyx.
- The 7-day conversation-key no-reply refund clock starts at **confirmed delivery**, not send or outreach.
- **$300 close fee:** the dealer pays when the **shopper confirms a purchase**. Not when a dealer marks sold. Stripe is not connected; live rows stay `due`.
- In-network dealers see the shopper **first name only**.

## Drevvy Desk (web scaffold)

Dealer-facing pages under `/dealer`, plus mock APIs under `/api/dealer/v1`. This is a scaffold. It does not authenticate anyone, and it does not read the database.

The high-fi folder `drevvy/handoff/Drevvy-Dealer-Surfaces/mockups/` was not on this machine. The screens follow the named frames and Halo tokens: Manrope, mist `#EEF1F7`, a dark rail, and the Halo gradient only on the primary button, outgoing bubbles, and the numbers-card rule.

Desktop inbox opens on the numbers-shared conversation in the detail pane. Narrow web and Flutter keep the list until a row is opened. Lead detail in conversation shows reply templates above the composer.

Desktop (the left rail is visible): **Inbox** is a split of the list and the detail. **Analytics**, **Settings**, and **Login** are their own pages. Login is a centered card, outside the rail.

Narrow web and the Flutter app: **Inbox** is the list. **Lead detail** is full screen, with the composer pinned under the thread. **Analytics** and **Login** are their own screens. Flutter also has **Settings** on the bottom bar. The narrow web lead screen hides that bar so the composer stays on screen.

| Route               | Screen                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `/dealer/login`     | Work email, then any 6-digit code. Nothing is sent or checked.                                  |
| `/dealer/inbox`     | Conversation list. Beside it, desktop shows “Select a conversation.”                            |
| `/dealer/leads/:id` | Same split on desktop. On a narrow window the thread and composer fill the screen.              |
| `/dealer/analytics` | Sample counts for 7, 30, and 90 days.                                                           |
| `/dealer/settings`  | Profile, notifications, store, team, sign out. Nothing is saved.                                |

Inbox filters: **Needs reply**, **All open**, **Closed**.

A mock row still shows **Buyer via Drevvy** plus a short reference such as **#A7F2**, year/make/model/trim, stock number, stage, advertised price, a snippet, and a timer. That anonymous label is desk-demo only. Live in-network chat uses **first name only** (`shopper_dealer_conversations.shopper_first_name`). Never last name, email, phone, or city.

Stages: **New request → In conversation → Numbers shared**, and the end states **Closed**, **Car sold**, and **No reply**.

The first message is the templated **Get Best Price** opener. After that, both sides write freeform text in this chat. Reply templates only fill the box. **Share numbers** posts an informational card in the thread. It is not a binding offer. v1 is chat inside Drevvy. This desk does not send text, email, or calls, and it does not use Telnyx. One-click reply chips belong on a later shopper screen.

Analytics cards: reply rate, median first-reply time, conversations started, conversations closed, numbers shared.

Settings includes one demo rooftop and a doc-fee default. The team list is a placeholder for managers and above.

## Mock vs real

`src/lib/dealer/mock.ts` holds the demo in process memory. A reply or a shared-number message is visible until that server process exits. It is not written to Supabase.

The inbox timer is a display value. It is not an SLA policy.

`/api/dealer/v1/*` returns the same mock. `source` is `"mock"`.

| Method | Path                                                        | Body                                                        |
| ------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/api/dealer/v1/inbox?filter=needs_reply\|all_open\|closed` | `{ source, filter, items }`                                 |
| `GET`  | `/api/dealer/v1/leads/:leadId`                              | `{ source, conversation }` including `messages`             |
| `POST` | `/api/dealer/v1/leads/:leadId/messages`                     | `{ body }`                                                  |
| `POST` | `/api/dealer/v1/leads/:leadId/numbers`                      | `{ statedPriceCents, writtenOtdCents?, note? }`             |
| `POST` | `/api/dealer/v1/leads/:leadId/sold`                         | Marks an open conversation **Car sold**. Mock billing still records a placeholder $300 in memory. Live `dealer_close_fees` rows are written only when the **shopper confirms a purchase**. |
| `GET`  | `/api/dealer/v1/billing`                                    | Manager billing stub. No card is charged.                   |
| `GET`  | `/api/dealer/v1/analytics?range=7d\|30d\|90d`               | reply rate, median minutes, started, closed, numbers shared |

The route name `leads` matches the information architecture. The screen label is **Conversation**.

## Onboarded rooftop

A rooftop is onboarded when:

1. A row exists in `dealerships` (name, optional `marketcheck_dealer_id`, optional `marketcheck_website_url`).
2. At least one `user_dealerships` membership points at that row (someone can sign in on the dealer dashboard).

`loadOnboardedRooftops` in `src/lib/dealer/rooftop-store.ts` loads that set. A `dealerships` row with no membership is not in-network. The mock desk settings rooftop is not this registry.

## `matchOnboardedRooftop`

Pure function in `src/lib/dealer/rooftop-match.ts`. Inputs are listing identity (server-fetched MarketCheck dealer id / website / VDP URL, plus an optional client listing URL) and the onboarded rooftop list.

Normalization:

- Host: lowercase, strip leading `www.`, strip a trailing dot.
- Listing URL: host + pathname, lowercase, no query, no hash, no trailing slash.
- MarketCheck dealer id: trim, compare as text (`1038994` equals `1038994`).

Match order (first hit wins):

1. **`marketcheck_dealer_id`** — listing dealer id equals `dealerships.marketcheck_dealer_id`.
2. **`listing_url`** — VDP host equals the rooftop website host. If the rooftop URL has a path, the VDP path must equal it or sit under it.
3. **`dealer_domain`** — MarketCheck `dealer.website` host equals the rooftop website host, same path rule.

A cars.com (or other aggregator) VDP does not match unless the MarketCheck dealer id or the dealer website domain hits a rooftop. No match means **off-network**.

## VDP CTAs

`POST /api/consumer/listings/network` returns the CTAs the shopper app should show.

| Network | Keys | CTAs |
| --- | --- | --- |
| In-network | 1 generic key as market intel; 1 generic key as dealer conversation | Unlock market intel + save. Start in-app chat with a salesperson. |
| Off-network | 1 generic key as market intel; OTD request is free | Unlock market intel + save. Request the dealership’s out-the-door number. **Do not** offer conversation. |

Heart save on `POST /api/consumer/saved-cars` still does not spend a key.

## Shopper endpoints

| Method | Path | Spend | When |
| --- | --- | --- | --- |
| `POST` | `/api/consumer/keys/market-save` | 1 key, spend kind `market_save`, never refunded | Any listing. Same listing is idempotent. |
| `POST` | `/api/consumer/keys/conversation` | 1 key, spend kind `dealer_conversation` | In-network only. `409 off_network` otherwise. Also the gated path for `POST /api/consumer/deals`. |
| `POST` | `/api/consumer/otd-requests` | none | Off-network only. `409 in_network` otherwise. Persisted on `off_network_otd_requests` for analytics/acquisition. Not chat. Not Telnyx. |
| `POST` | `/api/consumer/listings/network` | none | Resolve match + CTA list. |

In-network conversation rules (stored on `shopper_dealer_conversations`):

- Shopper is known in-message. The dealer sees **first name only** (`shopper_first_name`). Never last name, email, or phone.
- Message-only (`channel = in_app_message`). Do not start SMS, email, or voice from this row.
- First message asks for the itemized best out-the-door price at the rooftop’s signup terms (`inNetworkOpener`).

## Keys

Packs never expire: `drevvy_keys_1/5/10/25` at $4.99 / $19.99 / $34.99 / $74.99. RevenueCat packages `keys_1/5/10/25`. The brief’s `drevvy_key_*` ids alias the same packs. Retired car packs grant nothing. The 10-key pack is recommended. There is no $27/month conversation plan.

Dealer-conversation refunds (that spend only):

- Full refund if the dealer does not reply in 7 days. The clock starts at **confirmed delivery**.
- Refund if the car is sold.
- No refund on a 30-minute cancel before outreach.

The market-intel spend is not refunded.

## Close fee

When the shopper confirms a purchase (`POST .../outcome` with `bought: true`), record `$300` (`30000` cents) on `dealer_close_fees` with reason `shopper_confirmed_purchase` and status `due`. A dealer `end`/`sold` event does not write this row. Stripe is not connected. The desk `/sold` mock may still append a placeholder charge in memory; that is not the live fee.

## Run

From the repo root, with Node 20 and pnpm 8:

```bash
pnpm install
pnpm --filter @drevvy/backend dev
```

Open `http://localhost:3000/dealer/login`.

```bash
pnpm --filter @drevvy/backend test:shopper
pnpm --filter @drevvy/backend test:dealer
pnpm --filter @drevvy/backend typecheck
```

No new environment variables are required. Do not change the Vercel project `autoagent-dealer-dashboard` for this scaffold.

## Later data

| Desk field                                | Intended source, when a real desk exists                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Conversation id                           | A chat row tied to `shopper_deals.id`, matched with `matchOnboardedRooftop`.                                             |
| Year, make, model, trim, advertised price | `shopper_deals.vehicle_snapshot`. Older rows may not have trim.                                                         |
| Stock number                              | Not a column on `shopper_deals` today.                                                                                  |
| Messages                                  | A new in-app chat table. The first row is the Get Best Price template. Do not reuse `shopper_outreach_messages`. Do not wire Telnyx. |
| Shopper label                             | First name only from `shopper_dealer_conversations.shopper_first_name`. The mock `#A7F2` reference is desk-demo.        |
| Stage, reply timer, analytics             | Derived from that chat table. The sample numbers are not live.                                                          |
| Doc fee default                           | Settings only. Not a quote.                                                                                             |

A salesperson reply in the stub moves **New request** to **In conversation** and clears “needs reply.” **Share numbers** moves an open conversation to **Numbers shared** and stores the stated price. **Closed**, **Car sold**, and **No reply** stay closed. Those transitions are demo behavior for this scaffold.

## Open questions

- How a dealership account is provisioned, and how a work email becomes a salesperson
- Whether one login covers more than one rooftop
- Which teammates can share numbers
- When a written out-the-door total in this chat becomes the record the shopper relies on

## Next

Add real auth without touching `/admin`. Store the chat separately from outreach logs. Wire the desk to `shopper_dealer_conversations` (first name only). The Flutter shell is `apps/drevvy-dealer-app` and can call these routes after auth exists. Do not add RevenueCat or Telnyx wiring in that step.
