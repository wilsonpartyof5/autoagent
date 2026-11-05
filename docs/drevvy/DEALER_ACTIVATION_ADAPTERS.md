# Dealer activation adapters

Follow-on to the fixture harness. Desk routes now call the activation gate. Recording a commitment is a real write. The harness temp file and the demo cookie stay labeled and separate.

## Chain

1. Work email is the email on the authenticated user. This code does not create the user.
2. Membership is a `user_dealerships` row whose `user_id` is that user and whose `dealership_id` is the requested rooftop. Another user's row is `membership_mismatch`. No row is `unknown_membership`. A claimed email that differs from the session email is `email_mismatch`.
3. The rooftop id must also be in the onboarded set from `loadOnboardedRooftops`. A membership whose dealership row is missing is `rooftop_not_onboarded`.
4. `withDealerApi` then requires a recorded commitment row for that user and rooftop containing `message-only` and `itemized-otd` at terms `v2026.10`. The demo desk cookie is `demo_cookie_rejected` when it is the only proof. A recorded row still activates if a cookie is also present, and the response says the cookie was ignored.
5. `POST /api/dealer/v1/onboarding/commitments` writes that row for the signed-in member. A second write returns the same `recorded_at`. The route does not accept a demo cookie as the record.
6. Shopper and dealer message routes use the existing `shopper_dealer_messages` table. Shopper identity on that path is the stored first name. Phone, email, street address, and last name are not selected.

`DREVYY_LOCAL_PG=1` is ignored when `NODE_ENV` is production or empty. It binds a disposable local database for tests. It does not select a hosted project.

## Stores

- `createFixtureCommitmentStore` remains process memory for the decision unit tests. Desk routes do not read it.
- `recordSupabaseCommitment` inserts once and returns the existing row on retry. `readSupabaseCommitment` selects `user_id, dealership_id, terms_version, commitments, recorded_at`. A missing table or any read error is `commitments_unavailable`, and the desk stays closed.
- Live message writes stay on `postLiveMessage`, `shareLiveNumbers`, and `postShopperThreadMessage`.

## Draft SQL

`supabase/drafts/dealer_onboarding_commitments.sql` is marked `NOT APPLIED` for hosted databases. Authenticated users can read their own row. They cannot insert. Service role is the writer the route uses.

## Local proof and what is still hosted-only

`local-persistence.test.ts` applies that draft only to a disposable PGlite database in this environment, using test-owned ids. That run is local Postgres evidence, not hosted Supabase and not a preview branch. It reopens the same data directory and reads the commitment and the shopper/dealer thread again.

Still unverified against hosted Supabase: Auth `getUser` for a real token, the hosted service-role connection, and applying the draft on any hosted database. No new env var is required for the production path. It uses the existing service-role client when `DREVYY_LOCAL_PG` is off. Hosted preview cost is unknown. The smallest later permission is a human applying the same draft on an isolated database they choose. Do not apply it to the live AutoAgent project or to another pull request's preview branch.
