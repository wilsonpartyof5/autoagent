# Held SQL

These files are **not migrations**. They are not applied to any database.
Do not move them into `supabase/migrations`. The shopper app works without them.

Prod already has these two migrations, as written:

1. `supabase/migrations/20261120180000_shopper_market_unlocks.sql`
2. `supabase/migrations/20261120201000_market_save_lookup_guards.sql`

`20261124190000_market_refund_insert_only.sql` is the unapplied replacement.
It inserts `refund:market_save:<listing id>:<spend event id>` and does not
update or delete `shopper_credit_events`. A use counts as open only when that
refund row is absent. The retry spend key is
`use:market_save:<listing id>:after:<refund event id>`.

`market_intel_call_ceiling.sql` is a later design for a durable price-call cap.
Until it is applied, the process enforces `FAIR_PRICE_DAILY_CAP` (20 per user
per UTC day) and `FAIR_PRICE_GLOBAL_DAILY_CAP` (200 per process per UTC day)
in memory. A short empty quote is also remembered in memory for 10 minutes
for that shopper only. None of that calls an unapplied RPC.
