# Drevvy Desk (web)

Dealer-facing pages under `/dealer`, plus mock APIs under `/api/dealer/v1`. Salespeople talk with anonymous shoppers in Drevvy’s own chat. This is a scaffold. It does not authenticate anyone, and it does not read the database.

This is not the dealer portal removed in October 2026, and it is not a product where dealers pay for leads. The public page at `/dealers` is unchanged. The operator console at `/admin` is unchanged.

## Screens

Left rail: **Inbox**, **Analytics**, **Settings**.

| Route               | Screen                                                                              |
| ------------------- | ----------------------------------------------------------------------------------- |
| `/dealer/login`     | Work email, then any 6-digit code. Nothing is sent or checked.                      |
| `/dealer/inbox`     | Conversation list. On a wide window, an empty detail pane sits beside it.           |
| `/dealer/leads/:id` | Same list with that conversation open. On a narrow window the thread is full width. |
| `/dealer/analytics` | Sample counts for 7, 30, and 90 days.                                               |
| `/dealer/settings`  | Profile, notifications, store, team, sign out. Nothing is saved.                    |

Inbox filters: **Needs reply**, **All open**, **Closed**.

A row shows **Buyer via Drevvy**, the first name or **Anonymous shopper**, year/make/model/trim, stock number, stage, advertised price, a snippet, and a timer. If the salesperson has stated a different price, the row says so.

Stages: **New request → In conversation → Numbers shared**, and the end states **Closed**, **Car sold**, and **No reply**.

The thread is the composer. Reply templates only fill the box. **Share numbers** posts an informational message in the chat. It is not a binding offer. Phone, email, and street address are not shown.

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
| `GET`  | `/api/dealer/v1/analytics?range=7d\|30d\|90d`               | reply rate, median minutes, started, closed, numbers shared |

The route name `leads` matches the information architecture. The screen label is **Conversation**.

## Shopper pricing

Noted here only. There is no billing code and no dealer paywall.

Shopper plan: **$27/month for 10 conversations per month**. Car packs are retired. There is no annual plan.

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
| Messages                                  | A new in-app chat table. Do not reuse `shopper_outreach_messages` (operator SMS, email, and voice). Do not wire Telnyx. |
| First name                                | Optional. Do not select a shopper phone, email, address, or account id for this API.                                    |
| Stage, reply timer, analytics             | Derived from that chat table. The sample numbers are not live.                                                          |
| Doc fee default                           | Settings only. Not a quote.                                                                                             |

A salesperson reply in the stub moves **New request** to **In conversation** and clears “needs reply.” **Share numbers** moves an open conversation to **Numbers shared** and stores the stated price. **Closed**, **Car sold**, and **No reply** stay closed. Those transitions are demo behavior for this scaffold.

## Open questions

- How a dealership account is provisioned, and how a work email becomes a salesperson
- Whether one login covers more than one rooftop
- Which teammates can share numbers
- When a written out-the-door total in this chat becomes the record the shopper relies on

## Next

Add real auth without touching `/admin`. Store the chat separately from outreach logs. Keep the shopper anonymous. The Flutter shell is `apps/drevvy-dealer-app` and can call these routes after auth exists. Do not add RevenueCat or Telnyx wiring in that step unless a later decision says so.
