# Drevvy product analytics

Events are sent from `ProductAnalytics` in `lib/data/analytics/`. Names are `snake_case`. A screen view is `screen_viewed`. An action is a separate event.

The PostHog SDK starts only when `POSTHOG_API_KEY` is set at build time. With no key, every call is a no-op and demo mode is unchanged. The Profile Analytics switch can turn capture off on the device. Turning it off records `analytics_toggled` first, then opts out.

## What is never sent

Events do not include raw chat text, search queries, emails, phone numbers, names, addresses, ZIP codes, VINs, dealer names, auth error messages, or typed prices and notes. The sanitizer drops blocked keys and any string that contains `@` or a phone-like run of digits.

The distinct id is the Supabase user id, and only after sign-in. `identify` rejects emails, phones, and names.

Creator attribution is first-touch. A later link does not replace an existing `creator_id`. When present, these properties are attached to every event:

| Property | Source |
| --- | --- |
| `creator_id` | `c`, `creator`, or `creator_id` |
| `video_id` | `v`, `video`, or `video_id` |
| `utm_source` | `utm_source` |
| `utm_medium` | `utm_medium` |
| `utm_campaign` | `utm_campaign` |
| `utm_content` | `utm_content` |
| `utm_term` | `utm_term` |

Tokens must match `^[A-Za-z0-9._-]{1,64}$`. Emails and all-digit phone numbers are dropped.

There is no share button in the app, so there is no share event. There is no support form. Call and Email on the official offer fire `contact_tapped`. Directions fires `directions_tapped`. The "Drevvy is on call" card on the done screen is not a button.

## Screens

`screen_viewed` fires once per appearance. The same screen signature within 400ms is skipped. Named routes are recorded by `AnalyticsRouteObserver`. Sheets that are not routes call `screen()` themselves. Tab taps also record the tab route.

| `screen` | When |
| --- | --- |
| `shop` | `/shop` |
| `shop_results` | Shop mode with inventory results |
| `ask_chat` | Ask mode |
| `deals` | `/deals` |
| `saved` | `/saved` |
| `profile` | Account sheet opens |
| `settings` | Account sheet opens (same surface as Profile) |
| `onboarding_welcome` | `/onboarding/welcome` |
| `onboarding_how_it_works` | `/onboarding/how` |
| `onboarding_location` | `/onboarding/location` |
| `onboarding_preferences` | `/onboarding/preferences` |
| `paywall` | `/paywall` |
| `create_account` | `/account/create` |
| `car_detail` | `/vdp/:id` |
| `deal_detail` | `/deal/:id` |
| `official_offer` | `/deal/:id/official` |
| `deal_done` | `/deal/:id/done` |
| `error` | `/error` |
| `memory` | Remembered-facts sheet |
| `memory_edit` | Edit one fact |
| `chat_memory` | "Using your past searches" sheet |
| `search_history` | Recent searches sheet |
| `chat_history` | Chat history drawer |
| `notification_prompt` | Notification pre-prompt |
| `location_prompt` | Pickup-check location prompt |
| `pack_picker` | Key-pack picker |
| `out_of_cars` | Out-of-keys sheet |
| `add_to_drevvy` | Add-to-Drevvy sheet |
| `market_intel` | Key A market-intel confirm |
| `dealer_chat` | In-network conversation sheet |
| `otd_request` | Off-network OTD analytics form |
| `accept_confirm` | Accept-offer confirmation |
| `remove_deal` | Remove-deal sheet |
| `outcome` | Did-you-buy sheet |
| `ask_deal` | Deal-scoped Ask sheet |
| `trade_in` | Trade-in and financing sheet |
| `left_dealership` | Left-dealership sheet |
| `changed_offer` | Offer-changed sheet |
| `withdraw_acceptance` | Withdraw-acceptance sheet |
| `privacy` | Analytics privacy dialog |

Route properties, when safe: `listing_id`, `deal_id`, `placement` (`onboarding` or `paywall`), `code`. Ids with `@`, spaces, or more than 80 characters are omitted. The screen event still fires.

## Events

### `app_install`

Fired once, with `first_open`, on the first launch where capture is allowed. Not repeated after opt-out and opt-in if it already sent.

Properties: attribution only.

### `first_open`

Same moment as `app_install`.

Properties: attribution only.

### `session_started`

App launch, and again when the app returns to `resumed`. `inactive` is ignored.

| Property | Values |
| --- | --- |
| `resumed` | `false` on cold start, `true` when returning to the foreground |

### `session_ended`

App moves to `paused`, `hidden`, or `detached`.

| Property | Values |
| --- | --- |
| `duration_seconds` | Whole seconds since `session_started`, minimum 0 |

### `screen_viewed`

Every screen and sheet in the table above.

| Property | Values |
| --- | --- |
| `screen` | Screen name |
| `listing_id` | Car detail, add-to-Drevvy |
| `deal_id` | Deal, offer, outcome, and confirm sheets |
| `placement` | Paywall, pack picker, out of cars |
| `kind` | Memory edit (`budget`, `bodyTypes`, `makes`, `fuel`, `location`, `mustHaves`) |
| `code` | Error screen, safe code or omitted |

### `tab_selected`

Shop, Deals, or Saved tab is tapped.

| Property | Values |
| --- | --- |
| `tab` | `shop`, `deals`, `saved` |
| `reselected` | `true` when the current tab is tapped again |

### `onboarding_step_viewed`

A named onboarding route is shown.

| Property | Values |
| --- | --- |
| `step` | `welcome`, `how_it_works`, `location`, `preferences`, `paywall` |
| `index` | `1` through `5` |

`paywall` is included only for `/paywall?from=onboarding`.

### `onboarding_skipped`

Welcome "I already have an account", or How it works "Skip". Both still complete first run, which can fire `onboarding_completed`.

| Property | Values |
| --- | --- |
| `step` | `welcome` or `how_it_works` |
| `reason` | `existing_account` or `skip` |

### `onboarding_preferences_saved`

Preferences Continue. The ZIP value is not included.

| Property | Values |
| --- | --- |
| `budget_band` | `under_25k`, `25_35`, `35_50`, `over_50`, `unsure` |
| `body_types` | Allowlisted vehicle words, comma-separated, omitted when none match |
| `trade_in` | `yes`, `no`, `unsure` |
| `payment` | `cash`, `finance`, `unsure` |
| `location_granted` | bool |
| `has_zip` | bool |

### `onboarding_completed`

Once, when first-run onboarding is marked complete.

Properties: attribution only.

### `location_permission_asked`

In-app location choice is shown. This is not the OS permission dialog.

| Property | Values |
| --- | --- |
| `surface` | `onboarding` or `pickup` |

### `location_permission_granted`

Shopper chooses Allow.

| Property | Values |
| --- | --- |
| `surface` | `onboarding` or `pickup` |

### `location_permission_denied`

Shopper chooses ZIP instead, or Not now on the pickup sheet.

| Property | Values |
| --- | --- |
| `surface` | `onboarding` or `pickup` |
| `reason` | `zip_instead` on onboarding |
| `has_zip` | `true` when they continue with a ZIP. The ZIP itself is not sent |

### `location_zip_started`

Onboarding "Enter ZIP" is tapped, before a ZIP is stored.

| Property | Values |
| --- | --- |
| `surface` | `onboarding` |

### `sign_in_started`

Apple, Google, or the email demo path is tapped.

| Property | Values |
| --- | --- |
| `provider` | `apple`, `google`, `email` |

### `sign_in_completed`

The provider returns success. Apple and Google identify the Supabase user id inside session save. Email demo does not identify.

| Property | Values |
| --- | --- |
| `provider` | `apple`, `google`, `email` |
| `identified` | `true` for Apple and Google, `false` for email demo |

### `sign_in_cancelled`

The shopper dismisses the provider sheet.

| Property | Values |
| --- | --- |
| `provider` | `apple` or `google` |

### `sign_in_failed`

The provider returns a failure. The provider message stays in the snackbar and is not a property.

| Property | Values |
| --- | --- |
| `provider` | `apple` or `google` |
| `reason` | `auth_rejected` |

### `sign_out`

Profile sign-out, before the PostHog distinct id is reset. Attribution is registered again after reset.

Properties: attribution only.

### `account_delete_started`

Delete-account dialog opens. Deletion is still a demo confirmation.

Properties: attribution only.

### `account_delete_confirmed`

Delete is confirmed.

Properties: attribution only.

### `account_delete_cancelled`

Delete dialog is dismissed.

Properties: attribution only.

### `search_submitted`

Ask composer or starter, Shop search, or a deal Ask message. The raw text is not a property. A word that is only an email address becomes `query_category` `unspecified`.

| Property | Values |
| --- | --- |
| `surface` | `ask`, `shop`, `deal_ask` |
| `source` | `composer`, `starter`, `ask_handoff`, `saved_search`, `quick_reply` |
| `query_length` | Character count of the trimmed text |
| `query_category` | Up to three allowlisted vehicle words (`suv`, `sedan`, `truck`, `van`, `minivan`, `coupe`, `hatchback`, `wagon`, `convertible`, `electric`, `hybrid`, `diesel`, `cpo`, `used`, `new`, `luxury`), else `unspecified` |
| filter fields | See `search_refined` when Shop filters are present |

An automatic empty Shop browse (mode switch, opening a chat) is not a search.

### `search_refined`

Saved-search rerun, Saved sort, or recent-search run. Not a new query.

| Property | Values |
| --- | --- |
| `surface` | `shop`, `saved`, `search_history` |
| `source` | `saved_search`, `sort`, `history` |
| `query_length` | `0` when there is no new text |
| `query_category` | `unspecified` when there is no new text |
| `sort` | Saved sort option name |
| `has_filters` | bool |
| `make_count` | Count only. Make names are not sent |
| `model_count` | Count only |
| `body_count` | Count of selected body types |
| `body_types` | Allowlisted body words, omitted otherwise |
| `fuel_count` | Count only |
| `has_price_max` | bool. The price is not sent |
| `has_year` | bool |
| `has_miles_max` | bool |
| `has_zip` | bool. The ZIP is not sent |
| `condition` | `new`, `used`, or `cpo` |

### `mode_switched`

Ask and Shop toggle.

| Property | Values |
| --- | --- |
| `mode` | `ask` or `shop` |

### `chat_started`

New chat from the history drawer.

Properties: attribution only.

### `chat_opened`

An existing chat is selected.

| Property | Values |
| --- | --- |
| `mode` | `ask` or `shop` |

### `chat_deleted`

A chat is deleted from the drawer. The title is not sent.

Properties: attribution only.

### `chat_renamed`

A chat is renamed. The new title is not sent.

Properties: attribution only.

### `history_opened`

Chat history drawer opens. Also records `screen_viewed` for `chat_history`.

Properties: attribution only.

### `history_filtered`

Debounced history search field is non-empty. The query is not sent.

| Property | Values |
| --- | --- |
| `query_length` | Trimmed length |

### `history_ran`

A recent search is run again.

| Property | Values |
| --- | --- |
| `has_filters` | bool |

`search_refined` fires in the same tap.

### `history_deleted`

A recent search row is deleted. The title is not sent.

Properties: attribution only.

### `history_cleared`

Clear-all is confirmed.

Properties: attribution only.

### `history_restored`

Undo after deleting a recent search.

Properties: attribution only.

### `memory_opened`

Remembered facts from Profile, or the chat memory sheet.

| Property | Values |
| --- | --- |
| `surface` | `chat` on the chat sheet. Omitted for Profile |

### `memory_edit_started`

The edit sheet opens, including a newly added fact.

| Property | Values |
| --- | --- |
| `kind` | `MemoryKind` name |

### `memory_saved`

Save on the edit sheet. The value and ZIP are not sent.

| Property | Values |
| --- | --- |
| `kind` | `MemoryKind` name |
| `source` | `explicit` |

### `memory_deleted`

A fact is deleted.

| Property | Values |
| --- | --- |
| `kind` | `MemoryKind` name |

### `memory_delete_undone`

Undo on the delete snackbar.

| Property | Values |
| --- | --- |
| `kind` | `MemoryKind` name |

### `memory_added`

A new fact kind is chosen, before the edit sheet.

| Property | Values |
| --- | --- |
| `kind` | `MemoryKind` name |

### `personalize_toggled`

Profile personalize switch, or a fact toggle on the chat memory sheet.

| Property | Values |
| --- | --- |
| `enabled` | bool |
| `kind` | Fact kind, chat sheet only |
| `surface` | `chat` on the chat sheet |

### `car_viewed`

Vehicle detail finishes loading. The route `screen_viewed` does not include inventory type, so this event is separate.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `inventory_type` | Listing inventory type name |

### `car_saved`

Heart save.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `inventory_type` | Listing inventory type name |
| `source` | `shop`, `car_detail`, or the caller source |

### `car_unsaved`

Heart remove, including undo.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `source` | `shop`, `car_detail`, `saved`, `undo` |

### `find_similar_tapped`

"Find similar cars" or "Find another car".

| Property | Values |
| --- | --- |
| `source` | `saved`, `deals`, `deal_detail`, `deal_done` |
| `listing_id` | Listing id when the car is known |

### `deal_added`

A listing is added to Deals and it was not already a deal.

| Property | Values |
| --- | --- |
| `deal_id` | New deal id |
| `listing_id` | Listing id |

### `deal_add_blocked`

Add is refused because the car balance is 0.

| Property | Values |
| --- | --- |
| `reason` | `no_credits` |
| `listing_id` | Listing id |

### `deal_removed`

A deal is removed.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |
| `refunded` | `true` when the early-removal refund applies |

### `deal_remove_kept`

Remove sheet "Keep it".

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |

### `deal_state_viewed`

Deal detail finishes loading. Reloading after accept fires it again.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |
| `status` | `DealStatus` name |
| `offer_count` | Number of offers |
| `round_count` | Number of offers |

### `price_drop_round_viewed`

Deal detail loads with more than one offer.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |
| `round_count` | Number of offers |

### `offer_viewed`

Deal detail has at least one offer, or the official offer screen loads.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |
| `surface` | `deal_detail` or `official_offer` |
| `round_count` | Number of offers |

### `offer_accept_started`

Accept is tapped and the confirm sheet opens.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |

### `offer_accept_confirmed`

Confirm sheet returns accept. `deal_accepted` follows from the repository.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |

### `offer_accept_cancelled`

Confirm sheet returns "Not yet" or is dismissed.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |

### `deal_accepted`

Repository records the acceptance.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |
| `listing_id` | Listing id |

### `deal_keep_going`

Keep-going is recorded.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |

### `outcome_submitted`

Did-you-buy Submit. The note and the typed price are not sent.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |
| `outcome` | `bought`, `bought_different_price`, `not_yet`, `no` |
| `has_note` | bool |
| `has_price` | bool |

### `deal_banner_dismissed`

A deal-list banner is dismissed.

| Property | Values |
| --- | --- |
| `status` | Deal status name, or `unknown` |

### `add_to_drevvy_confirmed`

Add-to-Drevvy confirm, before the repository `deal_added`. Also fired for Key A market-intel confirm.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `spend_kind` | `market_intel` when Key A |

### `rooftop_match_resolved`

VDP loaded a rooftop match for the listing URL.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `matched` | bool |
| `rooftop_id` | Present when matched |
| `source` | `live` or `stub` |

### `market_intel_unlocked`

Key A spent: market intel + save.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `source` | `live` or `stub` |

### `dealer_conversation_started`

Key B spent on an in-network rooftop chat.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `rooftop_id` | Rooftop id |
| `template_id` | Deal Brain chip id when a chip was used |
| `source` | `live` or `stub` |

### `deal_brain_chip_tapped`

A one-click in-network message chip was tapped.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `template_id` | Chip template id |

### `otd_number_requested`

Off-network out-the-door request form submitted. Free, not chat, no key.

| Property | Values |
| --- | --- |
| `listing_id` | Listing id |
| `free` | `true` |
| `uses_key` | `false` |
| `has_note` | bool |
| `has_vdp_url` | Present when the listing has a URL |

### `paywall_viewed`

Onboarding paywall route, pack picker, out-of-cars sheet, or a Superwall presentation.

| Property | Values |
| --- | --- |
| `placement` | `onboarding`, `paywall`, `unlock_my_price`, `out_of_cars`, `account`, or the Superwall placement name |
| `provider` | `local` or `superwall` |

The local sheet still fires its own `paywall_viewed` when Superwall falls back. A presented Superwall paywall does not also fire the local one.

### `paywall_dismissed`

Back, close, start shopping free, keep shopping, not now, or Superwall dismiss without purchase or restore.

| Property | Values |
| --- | --- |
| `placement` | Same set as `paywall_viewed` |
| `action` | `back`, `close`, `start_shopping_free`, `keep_shopping`, `not_now`, `dismiss` |
| `provider` | `local` or `superwall` |

### `pack_viewed`

Paywall route or a pack sheet is shown.

| Property | Values |
| --- | --- |
| `placement` | Same set as `paywall_viewed` |
| `pack_count` | `4` |
| `pack_mix` | `1,5,10,25` |

### `pack_selected`

A pack card is tapped (`stage` `preview`) or purchase starts (`stage` `purchase`). Price is the catalog USD amount, not the store-localized price. `pack_size` is the pack-mix dimension and includes `1`.

| Property | Values |
| --- | --- |
| `pack_id` | Product id |
| `pack_size` | `1`, `5`, `10`, or `25` |
| `pack_mix` | `1,5,10,25` |
| `price` | Catalog USD amount |
| `currency` | `USD` |
| `stage` | `preview` or `purchase` |
| `placement` | Sheet placement on preview |

### `purchase_completed`

The store purchase succeeds.

| Property | Values |
| --- | --- |
| `pack_id` | Product id |
| `pack_size` | `1`, `5`, `10`, or `25` |
| `pack_mix` | `1,5,10,25` |
| `price` | Catalog USD amount |
| `currency` | `USD` |

### `purchase_failed`

The store purchase does not succeed. The store message is not sent.

| Property | Values |
| --- | --- |
| `pack_id` | Product id |
| `pack_size` | `1`, `5`, `10`, or `25` |
| `pack_mix` | `1,5,10,25` |
| `reason` | `cancelled`, `pending`, `store_error` |

### `purchases_restore_started`

Restore purchases begins.

Properties: attribution only.

### `purchases_restored`

Restore finishes.

| Property | Values |
| --- | --- |
| `result` | `success`, `empty`, `error` |
| `credits` | Credits restored, or `0` |

### `pack_balance_changed`

Local car balance changes after purchase, spend, refund, or a remote credit sync.

| Property | Values |
| --- | --- |
| `reason` | Ledger reason name |
| `delta` | Signed car count |
| `balance` | Balance after the change |

### `notification_permission_asked`

In-app notification pre-prompt is shown.

| Property | Values |
| --- | --- |
| `surface` | `add_car` |

### `notification_permission_granted`

"Turn on notifications" on the pre-prompt.

| Property | Values |
| --- | --- |
| `surface` | `add_car` |

### `notification_permission_denied`

"Not now" on the pre-prompt.

| Property | Values |
| --- | --- |
| `surface` | `add_car` |

### `notification_os_result`

The OS notification prompt returns. Resume-without-prompt does not fire this. The FCM token is not sent.

| Property | Values |
| --- | --- |
| `granted` | bool |
| `configured` | bool |

### `push_opened`

A push notification is opened. The payload is not forwarded.

| Property | Values |
| --- | --- |
| `notification_type` | Lowercase `[a-z0-9_]{1,40}`, else `unknown` |
| `has_deal` | bool |

### `settings_row_tapped`

A settings row that does not have its own event.

| Property | Values |
| --- | --- |
| `row` | `notifications`, `location`, `edit_memory` |

### `analytics_toggled`

Profile Analytics switch. Off is captured while still opted in. On is captured after opt-in.

| Property | Values |
| --- | --- |
| `enabled` | bool |

### `privacy_viewed`

The analytics privacy dialog opens from Profile or the pack picker.

Properties: attribution only. Also records `screen_viewed` for `privacy`.

### `contact_tapped`

Call or Email on the official offer. The number and address are not sent.

| Property | Values |
| --- | --- |
| `channel` | `phone` or `email` |

### `directions_tapped`

Get directions on the official offer. The address is not sent.

Properties: attribution only.

### `empty_state_viewed`

Shop search returns no cars (once until a non-empty result), or Saved or Deals finishes loading empty. Not fired from `build`.

| Property | Values |
| --- | --- |
| `surface` | `shop`, `saved`, `deals` |

### `error_shown`

The error route is shown.

| Property | Values |
| --- | --- |
| `surface` | `navigation` |
| `code` | Safe code or `unknown` |

### `error_retry`

Try again, Go back, or the error-screen back arrow. The message is not sent.

| Property | Values |
| --- | --- |
| `surface` | `navigation` |
| `code` | Safe code or `unknown` |
| `action` | `try_again`, `go_back`, `back` |

### `api_failed`

Credits request fails with a real HTTP or network error, or auth refresh fails. Missing credits routes (`404`, `405`, `501`) and `503` "purchases not configured" stay quiet so demo mode does not look like an outage. Response bodies are not sent.

| Property | Values |
| --- | --- |
| `surface` | `credits`, `credits_restore`, `auth_refresh` |
| `status` | HTTP status, `0` for a network exception, `401` for auth refresh |

### `offline_banner_retried`

Offline banner retry is tapped.

Properties: attribution only.

### `trade_in_answered`

Trade-in sheet answer.

| Property | Values |
| --- | --- |
| `answer` | `yes` or `no` |

### `left_dealership_answered`

Left-dealership sheet answer. The dealer name is not sent.

| Property | Values |
| --- | --- |
| `answer` | `bought`, `still_looking`, `dismissed` |

### `changed_offer_action`

Changed-offer sheet action. The sheet is instrumented even when no screen presents it yet.

| Property | Values |
| --- | --- |
| `action` | `accept_new`, `try_once_more`, `end_deal` |

### `acceptance_withdraw_confirmed`

Withdraw acceptance. The sheet is instrumented even when no screen presents it yet.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |

### `acceptance_withdraw_cancelled`

Keep this deal on the withdraw sheet.

| Property | Values |
| --- | --- |
| `deal_id` | Deal id |

### `done_action`

I'm all set, Back to Deals, or Find another car. Find another car also fires `find_similar_tapped`.

| Property | Values |
| --- | --- |
| `action` | `continue`, `back_to_deals`, `find_another` |
