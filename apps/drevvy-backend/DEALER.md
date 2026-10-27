# Drevvy Desk (web)

Dealer-facing pages under `/dealer`, plus mock APIs under `/api/dealer/v1`. Salespeople talk with anonymous shoppers in Drevvy’s own chat. This is a scaffold. It does not authenticate anyone, and it does not read the database.

This is not the dealer portal removed in October 2026, and it is not a product where dealers pay for leads. The public page at `/dealers` is unchanged. The operator console at `/admin` is unchanged.

## Screens

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

A row shows **Buyer via Drevvy**, a short reference such as **#A7F2**, year/make/model/trim, stock number, stage, advertised price, a snippet, and a timer. If the salesperson has stated a different price, the row says so. The reference is not a name or a city.

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
| `POST` | `/api/dealer/v1/leads/:leadId/sold`                         | Marks an open conversation **Car sold** and records a placeholder $300 close fee. |
| `GET`  | `/api/dealer/v1/billing`                                    | Manager billing stub. No card is charged.                   |
| `GET`  | `/api/dealer/v1/analytics?range=7d\|30d\|90d`               | reply rate, median minutes, started, closed, numbers shared |

The route name `leads` matches the information architecture. The screen label is **Conversation**.

## Pricing

Noted here only. Stripe is not connected. There is no shopper paywall on the dealer desk.

The desk is free day to day. A participating dealer is charged **$300 per closed deal** when someone marks a car sold. Settings shows a Billing stub for Manager and Admin: a placeholder card, that fee, and a mock list of recent charges. Mark as sold asks for confirmation and names the $300 fee. That copy is a placeholder.

Shopper plan, separate from this desk: **$27/month for 10 conversations per month**. Car packs are retired. There is no annual plan.

## Run

From the repo root, with Node 20 and pnpm 8:

```bash
pnpm install
pnpm --filter @drevvy/backend dev
```

Open `http://localhost:3000/dealer/login`.

```bash
pnpm --filter @drevvy/backend test:dealer
pnpm --filter @drevvy/backend typecheck
```

No new environment variables are required. Do not change the Vercel project `autoagent-dealer-dashboard` for this scaffold.

## Later data

| Desk field                                | Intended source, when a real desk exists                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Conversation id                           | A chat row tied to `shopper_deals.id`. How a rooftop is chosen is still open.                                           |
| Year, make, model, trim, advertised price | `shopper_deals.vehicle_snapshot`. Older rows may not have trim.                                                         |
| Stock number                              | Not a column on `shopper_deals` today.                                                                                  |
| Messages                                  | A new in-app chat table. The first row is the Get Best Price template. Do not reuse `shopper_outreach_messages`. Do not wire Telnyx. |
| Short reference                           | An opaque desk label such as `#A7F2`. Do not select a shopper name, city, phone, email, address, or account id.           |
| Stage, reply timer, analytics             | Derived from that chat table. The sample numbers are not live.                                                          |
| Doc fee default                           | Settings only. Not a quote.                                                                                             |

A salesperson reply in the stub moves **New request** to **In conversation** and clears “needs reply.” **Share numbers** moves an open conversation to **Numbers shared** and stores the stated price. **Closed**, **Car sold**, and **No reply** stay closed. Those transitions are demo behavior for this scaffold.

## Open questions

- How a dealership account is provisioned, and how a work email becomes a salesperson
- Whether one login covers more than one rooftop
- Which teammates can share numbers
- When a written out-the-door total in this chat becomes the record the shopper relies on

## Next

Add real auth without touching `/admin`. Store the chat separately from outreach logs. Keep the shopper labeled as Buyer via Drevvy plus a short reference. The Flutter shell is `apps/drevvy-dealer-app` and can call these routes after auth exists. Do not add RevenueCat or Telnyx wiring in that step.
