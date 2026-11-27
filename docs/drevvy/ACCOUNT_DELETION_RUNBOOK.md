# Account deletion runbook

Held SQL `supabase/held/consumer_account_deletion.sql` is not applied by this pull request. Until DW applies it, `DELETE /api/consumer/profile` returns `deletion_schema_pending` and does not delete the auth user.

The API calls `public.delete_consumer_account(uuid)` once, then `auth.admin.deleteUser`. `shopper_credit_events` is not updated by the function. Its `user_id` becomes null only through `ON DELETE SET NULL` when that auth delete commits.

## Residual identifier

`conversation_identities.email_alias` keeps its first-name local part, for example `maya.ab12@offers.drevvy.com`. That is not the shopper's real email. It stays so a dealer reply still reaches the open thread.

The profile ZIP is deleted with `consumer_profiles`. In the text we scrub, that same ZIP is removed wherever it stands alone, including `62701-1234`, and the opener suffix `. ZIP #####` is removed too. A longer number that only contains those digits is left in place. The dealer email alias is not rewritten.

## RevenueCat

The backend already has `REVENUECAT_SECRET_API_KEY`. After the auth user is deleted, the API sends:

`DELETE https://api.revenuecat.com/v1/subscribers/<supabase-user-id>`

`Authorization: Bearer <REVENUECAT_SECRET_API_KEY>`

Do not print the key. A 200 or 404 is success. If the log event is `account_deletion_revenuecat_failed`, repeat that DELETE for the Supabase user id. Do not call it when `deleteUser` itself failed. The shopper still exists, and the credit ledger still blocks a pack replay.

## PostHog

The shopper app identifies a person with the Supabase user id. The app key is a client project key (`phc_`) sent to the ingest host `https://us.i.posthog.com`. That key cannot delete a person, and this repo has no PostHog personal API key on the server.

Until a personal API key and project id are configured on the server (not in the client), delete the person by hand:

1. In the PostHog project, open Persons and search the Supabase user id. Delete that person, including their events.
2. Or, from a machine that holds a PostHog personal API key (not the client `phc_` key):

`POST https://us.posthog.com/api/projects/<project-id>/persons/bulk_delete/`

`Authorization: Bearer <PostHog personal API key>`

`{"distinct_ids":["<supabase-user-id>"]}`

The log event `account_deletion_posthog_manual` includes the user id and no key. Do this after the auth user is deleted. Do not put the personal key in the iOS app or in a client env var.
