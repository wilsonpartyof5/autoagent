# Dealer desk, rooftops, and shopper VDP CTAs

Shopper keys and vehicle-detail CTAs follow the 2026-10-27 locked model. Live matching uses `dealerships` plus `user_dealerships`. The dealer desk at `/dealer` signs in with a Supabase work-email OTP, then loads a rooftop-scoped inbox from `shopper_dealer_conversations`.

This is not the dealer portal removed in October 2026. The public page at `/dealers` is unchanged. The operator console at `/admin` is unchanged. Do not rename the Vercel project `autoagent-dealer-dashboard`.

## Locked rules

- Packs are **generic keys**. Spend kind is assigned at use: market intel, or a dealer conversation when the listing matches an onboarded rooftop.
- Off-network OTD request CTA is **free** (no key). Persist for analytics/acquisition only. Not chat. Not Telnyx.
- The 7-day conversation-key no-reply refund clock starts at **confirmed delivery**, not send or outreach.
- **$300 close fee:** the dealer pays when the **shopper confirms a purchase**. Not when a dealer marks sold. Stripe is not connected; live rows stay `due`.
- In-network dealers see the shopper **first name only**.

## Drevvy Desk

Dealer-facing pages under `/dealer`, plus APIs under `/api/dealer/v1`. A signed-in rooftop member sees live auth, inbox, conversation threads, and analytics. Unsigned access in non-production with `DEALER_PREVIEW=1` or `ADMIN_PREVIEW=1` still serves the in-memory mock. Production always requires a `user_dealerships` membership.

The desk and `/admin` use the locked glass tokens: Manrope, dark `#07080C` / light `#F4F6FB`, orbs `#5B4FE9` / `#3563E0` / `#1FB8C9`, frosted cards (`blur(24px)`, radius 20), and a 72px icon rail plus pill top bar. Dark and light twins switch in the chrome. This is not a standalone glass preview project.

Desktop inbox opens on the numbers-shared conversation in the detail pane. Narrow web and Flutter keep the list until a row is opened. Lead detail in conversation shows message-only chips above the composer.

Desktop (the left rail is visible): **Inbox** is a split of the list and the detail. **Analytics**, **Team**, **Rooftops**, **Roles**, **Billing**, **Settings**, and **Login** are their own pages. Login and onboarding are centered cards, outside the rail.

Narrow web and the Flutter app: **Inbox** is the list. **Lead detail** is full screen, with the composer pinned under the thread. **Analytics** and **Login** are their own screens. Flutter also has **Settings** on the bottom bar. The narrow web lead screen hides that bar so the composer stays on screen.

| Route | Screen |
| --- | --- |
| `/dealer/login` | Work email, then a 6-digit Supabase OTP. Membership is checked on `user_dealerships`. |
| `/dealer/invite/:token` | Accept invite. |
| `/dealer/verify` | Verify work email. |
| `/dealer/onboarding/org` | Dealer group. |
| `/dealer/onboarding/rooftops` | Add rooftops. |
| `/dealer/onboarding/team` | Invite team. |
| `/dealer/onboarding/routing` | Conversation routing. |
| `/dealer/onboarding/terms` | In-network messaging terms `v2026.10`. All 5 boxes required. |
| `/dealer/onboarding/done` | Ready, then inbox. |
| `/dealer/inbox` | Rooftop-scoped conversation list. Beside it, desktop shows a preview thread. |
| `/dealer/leads/:id` | Same split on desktop. On a narrow window the thread and composer fill the screen. |
| `/dealer/analytics` | Live reply rate, median first reply, started, closed, and itemized OTD shares for 7, 30, and 90 days. |
| `/dealer/team` | Owner/GM team invites. Preview-gated demo roster. |
| `/dealer/rooftops` | Preview-gated demo cards. Live rooftops come from the Owner/GM switcher. |
| `/dealer/roles` | Salesperson / BDC / Sales Manager / Owner/GM. Preview-gated. |
| `/dealer/billing` | Owner/GM $300 close fee. Charges from `dealer_close_fees`. Payment method still a stub. |
| `/dealer/settings` | Live work email, live rooftops, sign out. Profile fields are not saved. |

Inbox filters: **Needs reply**, **In chat**, **All**. The API still accepts `all_open` and `closed`.

A mock row shows **first name + conversation ref** such as **Jordan · #A7F2**, year/make/model/trim, stock number, stage, advertised price, a snippet, and a timer. Never last name, email, phone, or city. Live in-network chat uses the same rule (`shopper_dealer_conversations.shopper_first_name`).

Stages: **New request → In conversation → Numbers shared**, and the end states **Closed**, **Car sold**, and **No reply**.

The mock seed still opens with the templated **Get Best Price** demo line. Live in-network chat does not. Its first dealer-facing message is exactly `{first} wants your best itemized out-the-door` (`inNetworkOpener`), first name only. A ZIP is added only when the shopper is financing and a ZIP is already known. This path does not have a financing flag, so the ZIP is omitted. After that, both sides write freeform text in this chat. Composer chips are message-only: Share itemized OTD · Still available · Answer question · Price & fees · Vehicle details. No come-in or test-drive CTAs. **Share itemized OTD** can also open the informational numbers card. It is not a binding offer. v1 is chat inside Drevvy. This desk does not send text, email, or calls, and it does not use Telnyx. Shopper chips are suggestions. Nothing is sent until the shopper taps.

Analytics cards: reply rate, median first-reply time, conversations started, conversations closed, itemized OTD shared.

The Owner/GM rooftop switcher lists `user_dealerships` memberships. Billing is Owner/GM only. Shopper keys never appear on dealer or admin.

## Mock vs real

Signed-in dealers read `shopper_dealer_conversations` (first name only), `shopper_deals.vehicle_snapshot`, `shopper_dealer_messages`, and rooftop-scoped analytics. Composer replies persist on `shopper_dealer_messages` and still run `recordLiveDealerReply`.

`src/lib/dealer/mock.ts` is the unsigned non-prod preview only (`DEALER_PREVIEW=1` or `ADMIN_PREVIEW=1`). A preview reply is visible until that server process exits.

The inbox timer is a display value. It is not an SLA policy.

`/api/dealer/v1/*` returns `{ source: "live" }` for a rooftop member. Preview without a session returns `{ source: "mock" }`.

| Method | Path                                                        | Body                                                        |
| ------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/api/dealer/v1/session`                                    | `{ source, email, role, rooftops }`                         |
| `GET`  | `/api/dealer/v1/inbox?filter=needs_reply\|in_chat\|all\|all_open\|closed` | `{ source, filter, items }`                                 |
| `GET`  | `/api/dealer/v1/leads/:leadId`                              | `{ source, conversation }` including `messages`             |
| `POST` | `/api/dealer/v1/leads/:leadId/messages`                     | `{ body }`                                                  |
| `POST` | `/api/dealer/v1/leads/:leadId/numbers`                      | `{ statedPriceCents, writtenOtdCents?, note? }`             |
| `POST` | `/api/dealer/v1/leads/:leadId/sold`                         | Marks an open conversation **Car sold** on the desk. Does not write `dealer_close_fees`. Live `dealer_close_fees` rows are written only when the **shopper confirms a purchase**. |
| `GET`  | `/api/dealer/v1/billing`                                    | Close-fee rows for the member rooftops. No card is charged. |
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
- First message is exactly `{first} wants your best itemized out-the-door` (`inNetworkOpener`). Fallback when the first name is missing: `A shopper wants your best itemized out-the-door`.

## Chat quality runtime

Dealer Desk owns this. Deal Brain owns the T1–T12 copy. Chips are suggestions on `POST /api/consumer/deals/:id/chips` (GET returns the same with no extra intel). `autoSend` is false. Labels are at most 18 characters. Bodies are at most 160. A chip with a missing required field is hidden. T3, T4, and T5 use the spec fallback sentence when a market figure is missing. They do not invent a price. Exact dollars, comp counts, and days on market are filled in when that intel is present. Chip copy is dropped if it contains negotiate or haggle language.

Stage order, after the opener is already sent: no dealer reply yet → T6, then T1 when a stock number exists. After availability → T2, T6, T3. After a price → T6, T4, T5, T7. After an itemized OTD → T7, T8, T9, T10, T11, T12. T6 hides once an itemized OTD is in the thread. T11 and T12 also wait for that.

If a dealer reply still does not include an itemized best OTD (vehicle price, a dealer fee, and at least two of tax, title, and registration, with dollar amounts), the desk adds a warning on that conversation:

`Warning {n} of 3: {first} asked for your best itemized out-the-door and hasn't received it. Transparency is why Drevvy exists. After 3 warnings, your store is removed from the Drevvy dealer network.`

The count is `shopper_dealer_conversations.otd_warning_count`, with each warning row in `dealer_otd_warnings`. The third warning also posts:

`Your store has been removed from the Drevvy dealer network after 3 warnings for not giving an itemized best out-the-door. Transparency is why Drevvy exists.`

That sets `otd_removal_recommended_at`. It recommends network removal for an admin. It does not delete the rooftop. A come-in push more than once sets `come_in_admin_flag` and stays separate from this ladder. There is no come-in rebuttal. The mock desk runs the same check when the thread opener is the live sentence. Demo **Get Best Price** rows are not warned.

## Keys

Packs never expire: `drevvy_keys_1/5/10/25` at $4.99 / $19.99 / $34.99 / $74.99. RevenueCat packages `keys_1/5/10/25`. The brief’s `drevvy_key_*` ids alias the same packs. The 10-key pack is recommended. Two spends from the same balance: market-intelligence unlock + save on a VDP, and a separate dealer-conversation key when the VDP URL matches an onboarded rooftop. Off-network out-the-door requests are free (analytics only, no in-app chat). Retired car packs grant nothing. There is no monthly conversation plan.

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

`DEALER_PREVIEW=1` (or `ADMIN_PREVIEW=1`) serves the mock desk without a session only when `NODE_ENV` is not production. Do not change the Vercel project `autoagent-dealer-dashboard`.

## Later data

| Desk field                                | Live source                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Conversation id                           | `shopper_dealer_conversations.deal_id` (`shopper_deals.id`), matched with `matchOnboardedRooftop`.                      |
| Year, make, model, trim, advertised price | `shopper_deals.vehicle_snapshot`. Older rows may not have trim. VIN, city, and contact are stripped before the desk.    |
| Stock number                              | Not a column on `shopper_deals` today. Desk shows — until it is.                                                        |
| Messages                                  | `shopper_dealer_messages`. The first row is `inNetworkOpener`. Do not reuse `shopper_outreach_messages`. Do not wire Telnyx. |
| Shopper label                             | First name only from `shopper_dealer_conversations.shopper_first_name`. Ref is `#` plus the first four of the deal id.  |
| Stage, reply timer, analytics             | Derived from that chat table plus OTD / sold flags, scoped to member rooftops.                                          |
| Doc fee default                           | Settings only. Not a quote. Preview-gated.                                                                              |

A salesperson reply moves **New request** to **In conversation** and clears “needs reply.” **Share numbers** moves an open conversation to **Numbers shared** and stores the stated price. **Closed**, **Car sold**, and **No reply** stay closed. Desk mark-sold does not write `dealer_close_fees`.

## Open questions

- How a dealership account is provisioned, and how a work email becomes a salesperson
- Which teammates can share numbers
- When a written out-the-door total in this chat becomes the record the shopper relies on

## Next

Team, rooftops, roles, onboarding (except Terms), and the Flutter shell stay preview-gated. `apps/drevvy-dealer-app` can call `/api/dealer/v1` with a Bearer session after that auth exists. Do not add RevenueCat or Telnyx wiring in that step.
