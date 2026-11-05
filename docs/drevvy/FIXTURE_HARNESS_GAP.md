# Fixture harness gap

This branch is an isolated fixture harness. It is not live Phase A/B completion. Main decides whether an isolated hosted preview is provisioned. This note does not choose that.

## What the harness does

- Demo onboarding stores rooftop ids from the demo list plus the message-only and itemized-best-OTD commitments in a signed cookie. `legalAcceptance` stays false. The cookie cannot set `source: live`, a real user id, or a real `user_dealerships` row.
- Shopper and dealer fixture routes share one temp file when `DEALER_THREAD_FIXTURE=1` and `NODE_ENV` is set and is not production. The file is mode `0600`, locked per read/write, and labeled `TEST FIXTURE`. Tests use `DREVYY_FIXTURE_BOOK` so they do not share the preview server file.
- Three withhold warnings remove only `fixroof_lakeside` inside that file. Live replies still set `otd_removal_recommended_at` and do not update `dealerships`.

## Shopper APIs

- `POST /api/consumer/fixture/threads` is fixture-only. It returns 404 when the flag is off, when `NODE_ENV` is production, or when `NODE_ENV` is empty.
- `GET` and `POST /api/consumer/deals/:id/messages` are both. The fixture branch runs only for an id starting with `fixconv_`, header `x-drevvy-fixture: isolated`, and the flag above. Every other call requires the signed-in shopper and reads or inserts `shopper_dealer_messages` for an `in_app_message` conversation that shopper owns. A different channel returns `not_chat`. Another shopper gets `not_found`. The select list is first name, opener, channel, and message text.

## Still live work, not done here

- No hosted preview URL and no isolated remote database. Local server only.
- Live onboarding does not write `user_dealerships` or accept terms for a real dealer.
- A live shopper/dealer round trip was not run against Supabase. The live message helpers are covered with in-memory fakes.
- Network removal of a real rooftop stays a recommendation. Nothing unpublishes a live store.
- The $300 fee is not charged. Stripe is not connected.
- How a work email becomes a salesperson, and how a live rooftop is provisioned, goes back to Dealer Desk.
- Phase C views stay in `docs/drevvy/PHASE_C_DESK_DATA_VIEWS.md`. No migration was added. PR #126 draft SQL stays unapplied.
