# Drevvy Desk (Flutter)

Dealer-facing iOS and Android shell for conversations with anonymous shoppers. This is a scaffold with demo data. It does not sign anyone in, and it does not talk to a live API.

This is not the old SwiftUI dealer app, and it is not the deleted “dealers pay for leads” portal.

## What you can open

Bottom tabs: **Inbox**, **Analytics**, **Settings**. The bar is dark. A conversation opens full screen, with reply templates and the composer pinned under the thread. Outgoing bubbles and the numbers-card rule use the Halo gradient. The list does not stay beside the thread.

- **Sign in.** Work email, then any 6-digit code. Nothing is emailed or checked.
- **Inbox.** Filters: Needs reply, All open, Closed. Each row is Buyer via Drevvy, a short reference such as #A7F2, a year/make/model/trim, a stock number, a stage, the advertised price, a snippet, and a timer.
- **Conversation.** The thread opens with a templated Get Best Price message, then freeform chat. Reply templates fill the composer. **Share numbers** posts an informational card. It is not a binding offer. Chat stays inside Drevvy. There is no text, email, or call.
- **Analytics.** Reply rate, median first-reply time, conversations started, conversations closed, numbers shared. Ranges: 7, 30, and 90 days. The figures are samples.
- **Settings.** Profile, notifications, one demo rooftop with a doc-fee default, a team list, and sign out. Nothing is saved.

Stages: New request, In conversation, Numbers shared, Closed, Car sold, No reply.

The shopper is labeled **Buyer via Drevvy** plus a short reference. Name, city, phone, email, and address are not on these screens. One-click reply chips are a later shopper-app helper, not this desk.

## Mock vs real

The conversations live in `lib/data/demo_desk.dart`. They mirror the web demo in `apps/drevvy-backend/src/lib/dealer/mock.ts`. Sending a message or sharing numbers updates that in-memory list only.

The timer is a display value from the demo clock. It is not an SLA policy.

## Pricing

Noted here only. Stripe is not connected. There is no shopper paywall in this app.

The desk is free day to day. A participating dealer is charged **$300 per closed deal**. Settings includes a Billing stub for a manager: a placeholder card, that fee, and mock recent charges. Mark as sold asks for confirmation and names the $300 fee. That copy is a placeholder.

Shopper plan, separate from this desk: one-time **key packs** (1 key $4.99, 5 keys $19.99, 10 keys $34.99 recommended, 25 keys $74.99). Two spends from the same balance: market-intelligence unlock + save on a VDP, and a separate dealer-conversation key when the VDP URL matches an onboarded rooftop. Off-network out-the-door requests are free (analytics only, no in-app chat). The conversation-key refund clock is 7 days from confirmed delivery. There is no monthly conversation plan and no annual plan.

## Run

Flutter 3.47 (Dart 3.13) or newer.

```bash
cd apps/drevvy-dealer-app
flutter pub get
flutter analyze
flutter test
flutter run
```

`flutter run` needs a simulator or a device. `flutter analyze` and `flutter test` are enough to check the shell on a machine without one.

## Open questions

This scaffold does not answer:

- How a dealership account is provisioned, or how a work email becomes a salesperson
- Whether one login covers more than one rooftop
- Which teammates can share numbers
- When a written out-the-door total in this chat becomes the record a shopper relies on

## Next

Point the app at `GET /api/dealer/v1/inbox`, `GET /api/dealer/v1/leads/:id`, `POST /api/dealer/v1/leads/:id/messages`, and `POST /api/dealer/v1/leads/:id/numbers` after real auth exists. Keep shopper contact details off the payload. Do not wire Telnyx or RevenueCat for this surface.
