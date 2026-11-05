# Phase C desk data views

Recorded with the dealer desk onboarding and thread slice. This is a requirements note for a later data view. It does not add a pipeline, a table, or a job.

## Already on the desk

`/dealer/analytics` already shows reply rate, median first reply, conversations started, conversations closed, and itemized out-the-door shares for 7, 30, and 90 days. Live rows come from `shopper_dealer_conversations` and `shopper_dealer_messages`. Do not build a second analytics pipeline for those five numbers.

Shopper journey events, hashed off-network twins, and ClickPipes stay with the open analytics work (PR #126 and its unapplied draft SQL). This note does not copy that path and does not apply it.

## Views still needed

These are read models for the Owner/GM and the internet manager. They are not charts of the five analytics cards.

1. **Onboarding acceptance audit.** Rooftop ids, terms version, and the message-only and itemized-best-OTD commitments, with who accepted and when. The demo desk stores this only as an isolated fixture (`legalAcceptance: false`). A live view waits on a reviewed migration and on how a work email becomes a salesperson. Do not treat the fixture cookie as that audit log.
2. **Withhold review queue.** Conversations with `otd_warning_count` and `otd_removal_recommended_at`, rooftop name, and first name plus ref only. The third warning recommends removal. A person reviews it. The queue must not delete or unpublish a live rooftop.
3. **Itemized completeness, separate from “numbers shared.”** A reply can share a single total and still be incomplete. The view should show whether the thread has vehicle price, a dealer fee, and at least two of tax, title, and registration. The analytics card can keep counting informational numbers shares.
4. **Stock number.** The desk shows an em dash until `shopper_deals` has a stock field. Do not invent one from the listing title.
5. **Trim on older snapshots.** Newer deals store trim. Older rows do not. The view should show trim when the snapshot has it and leave it blank when it does not.

## Fences

- Shopper phone, email, street address, and last name stay off these views. Optional ZIP only when the opener already included a financing ZIP.
- Off-network OTD requests stay an acquisition count, not a chat transcript.
- No autonomous follow-up, lead drop, or third required question.
- The $300 fee stays a `due` row when the shopper confirms a purchase. No card charge in this view.
- Unknown product choices go back to Dealer Desk. Do not guess a live schema in this slice.

## Unapplied migrations this slice does not run

Existing files marked `NOT APPLIED` stay unapplied, including deal lifecycle, Google shoppers, saved cars, device tokens, and platform bills. PR #126’s draft journey SQL is not in this branch and is not applied. This slice adds no migration. Fixture onboarding is a sealed demo cookie (`legalAcceptance: false`). Fixture threads are an isolated temp file (`persistence: isolated-preview-file`), not Supabase. The live message tables already exist.
