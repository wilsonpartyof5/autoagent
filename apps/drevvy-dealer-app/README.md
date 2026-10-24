# Drevvy Desk (Flutter)

Dealer-facing iOS and Android shell for conversations with anonymous shoppers. This is a scaffold with demo data. It does not sign anyone in, and it does not talk to a live API.

This is not the old SwiftUI dealer app, and it is not the deleted “dealers pay for leads” portal.

## What you can open

Bottom tabs: **Inbox**, **Analytics**, **Settings**. A conversation opens full screen.

- **Sign in.** Work email, then any 6-digit code. Nothing is emailed or checked.
- **Inbox.** Filters: Needs reply, All open, Closed. Each row is a buyer via Drevvy, a year/make/model/trim, a stock number, a stage, the advertised price, a snippet, and a timer.
- **Conversation.** In-app chat. Reply templates fill the composer. **Share numbers** posts an informational message. It is not a binding offer.
- **Analytics.** Reply rate, median first-reply time, conversations started, conversations closed, numbers shared. Ranges: 7, 30, and 90 days. The figures are samples.
- **Settings.** Profile, notifications, one demo rooftop with a doc-fee default, a team list, and sign out. Nothing is saved.

Stages: New request, In conversation, Numbers shared, Closed, Car sold, No reply.

The shopper is shown as **Buyer via Drevvy**. A first name appears only when the demo includes one. Otherwise the label is **Anonymous shopper**. Phone, email, and address are not on these screens.

## Mock vs real

The conversations live in `lib/data/demo_desk.dart`. They mirror the web demo in `apps/drevvy-backend/src/lib/dealer/mock.ts`. Sending a message or sharing numbers updates that in-memory list only.

The timer is a display value from the demo clock. It is not an SLA policy.

## Shopper pricing

Noted here only. No billing code, and no dealer paywall.

Shopper plan: **$27/month for 10 conversations per month**. Car packs are retired. There is no annual plan.

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
