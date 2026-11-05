# Dealer activation adapters

Scoped follow-on to the fixture harness. This does not finish live onboarding. Routes still authorize the desk with `user_dealerships` through `requireDealerApi`. They do not call this gate yet, because the commitment table is an unapplied draft.

## Chain

1. Work email is the email on the authenticated Supabase user. This code does not create the user.
2. Membership is a `user_dealerships` row whose `user_id` is that user and whose `dealership_id` is the requested rooftop. Another user's row is `membership_mismatch`. No row is `unknown_membership`. A claimed email that differs from the session email is `email_mismatch`.
3. The rooftop id must also be in the onboarded set: a `dealerships` row that has at least one membership (`loadOnboardedRooftops`). A membership whose dealership row is missing is `rooftop_not_onboarded`.
4. Activation also needs a recorded commitment row for that user and rooftop containing `message-only` and `itemized-otd` at terms `v2026.10`. The demo desk cookie is `demo_cookie_rejected` when it is the only proof. A recorded row still activates if a cookie is also present, and the decision says the cookie was ignored.
5. Shopper identity for this chain is first name, plus ZIP only when financing already has a valid ZIP. Phone, email, street address, and last name are dropped.

## Stores

- `createFixtureCommitmentStore` is process memory, `persistence: test-owned`, `liveWrite: false`. Tests seed it. It does not use the fixture thread file.
- `readSupabaseCommitment` selects `user_id, dealership_id, terms_version, commitments, recorded_at`. It has no insert. A missing table or any read error is `commitments_unavailable`, which does not activate.

## Draft SQL

`supabase/drafts/dealer_onboarding_commitments.sql` is marked `NOT APPLIED`. Authenticated users can read their own row. They cannot insert. Service role is the only writer, and this change does not call it.

## Left unverified

No safe isolated database was used. The live AutoAgent project and the preview branches for other pull requests were not queried or changed. Applying the draft, recording a real commitment, and putting this gate in front of live desk routes remain blocked on that reviewed database. No new credential, env var, or provider is required for the fixture tests.
