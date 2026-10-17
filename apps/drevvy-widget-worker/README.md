# Drevvy widget worker

Standalone Node worker for day-0 dealer outreach:

1. **Research.** Given a dealer vehicle page, fetch that page and the dealer site, ask an OpenAI-compatible model for the widget vendor, phone numbers, and emails, check those values against the page, and upsert `dealer_directory`.
2. **Scan.** Open the page, wait for a late widget, and record whether the chat widget is ready.
3. **Day-0 channels.** `run` uses that scan. A ready widget gets the widget chat and the lead form. Every other widget status gets the lead form only. A bot wall gets neither, and is marked for email, text, and call.
4. **Lead form.** On the vehicle page, fill one dealer form such as "Ask a Question", "Check Availability", "Get Today's Price", or "Unlock Instant Price".
5. **Widget chat.** Open the same page in Chromium, detect a known chat widget, fill a pre-chat gate when the widget has one, and follow a fixed script.

Lead forms and pre-chat gates use the shopper's first name, the last name `via Drevvy` (or `LEAD_LAST_NAME`), `DREVVY_TEXT_NUMBER`, `DREVVY_EMAIL`, and `DREVVY_ZIP` when the form has a ZIP field. The shopper's own phone, email, last name, address, date of birth, SSN, and trade details are never typed and never stored. If a dealer asks whether this is a bot, the chat reply is `I'm Drevvy's AI, working for {first}.`

MarketCheck contact data can be passed as a hint file. Hints are not written to the database. A phone, email, or name is stored only when it appears on the fetched dealer page. Do not point this worker at a MarketCheck listing URL.

Migrations, applied separately from this package:

- `supabase/migrations/20261018014500_dealer_directory_widget_chat.sql`
- `supabase/migrations/20261018030000_widget_attempt_channels.sql` adds `channel` (`widget`, `lead_form`, `prechat`) and `first_reply_channel` on `widget_chat_attempts`.
- `supabase/migrations/20261018120000_widget_playbooks.sql` adds `dealer_directory.widget_playbook` and the scan statuses `widget_offline`, `page_timeout`, and `composer_not_found`.
- `supabase/migrations/20261018150000_day0_channel_selection.sql` adds `selected_channels`, `channel_reason`, and `fallback` on `widget_chat_attempts`. `fallback` is `email_text_call` when a bot wall skips both channels.
- `supabase/migrations/20261018180000_dealer_directory_blocked_status.sql` allows `dealer_directory.status = blocked` when a dealer site presents a bot wall.

## Commands

```bash
pnpm --filter @drevvy/widget-worker research urls.txt --hints hints.json
pnpm --filter @drevvy/widget-worker seed launch-areas.txt --radius 25
pnpm --filter @drevvy/widget-worker report
pnpm --filter @drevvy/widget-worker scan urls.txt --concurrency 3
pnpm --filter @drevvy/widget-worker lead urls.txt
pnpm --filter @drevvy/widget-worker chat urls.txt
pnpm --filter @drevvy/widget-worker run urls.txt
```

`run` researches the dealer, scans the widget, then sends only the channels that scan selects. It records `selected_channels`, `channel_reason`, and `fallback` on the scan row and on each later lead, chat, and pre-chat row.

| Widget status | Channels | Lead identity |
| --- | --- | --- |
| `dry_run` (launcher and composer, or a pre-chat gate) | `widget,lead_form` | First name and `DREVVY_TEXT_NUMBER` only. The message says `Please text us at {DREVVY_TEXT_NUMBER}.` A required last name, email, or ZIP stops that form with nothing filled. |
| `no_widget`, `widget_offline`, `composer_not_found`, `page_timeout`, `error` | `lead_form` | The full lead identity below, including `LEAD_LAST_NAME`, `DREVVY_EMAIL`, and `DREVVY_ZIP`. |
| `captcha`, `contact_form` | `lead_form` | Same full lead identity. The reason says `blocked-for-chat`. |
| `blocked` | none | Nothing is sent. `fallback` is `email_text_call`. The page is not opened again. |

`lead` and `chat` stay independent: `lead` always uses the full identity, and `chat` always runs its own script.

`scan` needs Supabase and does not need an API key, a shopper name, or the allowlist. It never fills or submits a chat or a form. `--concurrency` defaults to 3. Each site is capped at `WIDGET_SCAN_TIMEOUT_MS` (default 25 seconds). A navigation crash or a timeout is stored as `error` or `page_timeout` for that URL, and the rest of the list still runs. Each result is written as soon as that site finishes.

`urls.txt` has one vehicle page URL per line. An optional second column is the stock number. `#` starts a comment.

```text
https://www.example-motors.test/inventory/2024-honda-civic H24118
```

`hints.json` is keyed by that same URL. Only `dealerName`, `phone`, and `email` are read. Any other field, including a VIN or a raw listing, is dropped.

```json
{
  "https://www.example-motors.test/inventory/2024-honda-civic": {
    "dealerName": "Example Motors",
    "phone": "8035550199",
    "email": "sales@example-motors.test"
  }
}
```

A directory row is skipped when `last_checked_at` is under 30 days old. `--force` fetches again.

## Seeding launch areas

`seed` builds `dealer_directory` for a list of ZIP codes and a radius in miles. It asks MarketCheck for dealer names and websites, then runs the same research step as `research` against each dealer's own site. Phone, email, and widget vendor are stored only when they appear on that site, with the page URL and a confidence.

MarketCheck is a hint. The client reads the dealers list and keeps the name, website, and optional phone and email. VIN, price, photos, address, and the rest of the payload are dropped immediately and are not written to the database. A response that contains listings and no dealers list is refused.

```text
# ZIP and radius in miles. A ZIP alone uses --radius.
29201 25
29401
```

```bash
pnpm --filter @drevvy/widget-worker seed launch-areas.txt --radius 25
```

A bot wall (SOKAL, Cloudflare, Akamai, PerimeterX, DataDome, or an HTTP 403/429 wall) is stored as `blocked`. The model is not called, and contacts are not taken from the wall page. A page that only says "access denied" is not a wall.

Rows younger than 30 days are skipped, including `blocked` rows, so running the same file again resumes where it left off. A row older than 30 days is fetched again. Requests to MarketCheck and to dealer sites are spaced by `SEED_MIN_INTERVAL_MS` (default 1 second). One failed ZIP or dealer does not stop the rest.

`seed` does not open a browser, fill a form, or send a message.

`report` prints counts by status, counts by widget vendor, and how many rows have a phone, an email, both, or neither.

Each command prints a table. `channel` is `widget`, `lead_form`, or `prechat` for a single attempt, and `widget,lead_form` on the day-0 row when both are sent. A scan also prints `playbook` and `reason`. `run` adds `fallback`, which is `email_text_call` for a bot wall and `-` otherwise.

```text
url                         vendor    status    price    dry_run  channel
https://www.example...      gubagoo   dry_run   -        true     widget
```

## Finding the widget

A scan and a chat both wait before they decide a page has no widget:

1. Wait for network idle, then `WIDGET_SCAN_SETTLE_MS` (default 3 seconds).
2. Move the pointer a short distance and scroll a little, so late launchers can render.
3. Dismiss a cookie banner (ComplyAuto, OneTrust, and similar Accept All controls) and a trade-in popup. Chat, text-us, availability, and price controls are left alone.
4. Detect the vendor from network request hosts, script `src` values, iframe URLs, the iframe document, and then the main page. Known vendors include Gubagoo, CarNow, Podium, Impel, Fullpath, Toyota SmartPath, and TruVideo AIVA.
5. Look for the launcher and the message composer in the main page and inside a vendor iframe.
6. A captcha counts when a challenge checkbox or image grid is visible in the viewport, or when that challenge sits inside the chat widget's own frame. An invisible reCAPTCHA, a `data-size="invisible"` widget, and the reCAPTCHA badge do not count.
7. If no launcher and no pre-chat gate are visible, and the page is not a captcha, send one screenshot to the model. The model returns a click point. The worker clicks that point only. A point whose reason mentions a captcha, cookie banner, trade-in popup, lead form, phone, or email is ignored.

Gubagoo and CarNow use a vendor playbook: open the launcher, find the composer, send, and read the reply. Every other vendor, including a launcher found only by the screenshot, uses the generic playbook. The detected vendor and playbook are stored on `dealer_directory` (`widget_vendor`, `widget_playbook`).

Scan statuses, with the reason stored on the attempt:

| Status | Meaning |
| --- | --- |
| `dry_run` | A launcher and a composer, or a pre-chat gate, were found. Nothing was typed. |
| `no_widget` | No vendor and no launcher after the wait. |
| `widget_offline` | A vendor script or request was seen, and no launcher appeared. |
| `composer_not_found` | The launcher was opened once, and the composer did not appear. |
| `blocked` | A known bot wall. The reason names the signature: `sokal`, `cloudflare`, `akamai`, `perimeterx`, `datadome`, `http-403`, or `http-429`. |
| `page_timeout` | The page or the per-site cap timed out before the scan finished. |
| `captcha` | A visible challenge, or a challenge inside the chat widget frame. Nothing was clicked. |
| `error` | The page crashed after one retry, for example a navigation that destroyed the locator. The reason is the error message. |

A blocked dealer site is not opened again, and a second scan does not insert another row.

## Lead form and pre-chat

The lead message, used when the form has a message, comment, or question field, is:

`Is this unit still available? Stock #X. What's the price on it? Please text or email us at {DREVVY_TEXT_NUMBER} / {DREVVY_EMAIL}.`

When `run` sends the lead form alongside a ready widget, the last sentence is `Please text us at {DREVVY_TEXT_NUMBER}.` and the form is filled with the first name and that number only.

The stock sentence is omitted when the page has no stock number. There is no introduction. A form without a message field is still submitted with the identity fields it does have.

A widget pre-chat gate, such as Podium "Text us", is filled with the shopper's first name and `DREVVY_TEXT_NUMBER`. A single name box on that gate gets the first name only. A lead form with one full-name box gets `{first} {LEAD_LAST_NAME}`.

`first_reply_channel` stays empty until a dealer text reply is read. A screenshot-only turn does not set it. The first text reply updates the earlier attempt rows for that vehicle page.

## Safety

- `DRY_RUN` defaults to true. Only the exact string `false` turns it off. A dry run opens the page, logs the form fields or chat line, and does not type or submit. A scan may dismiss overlays, scroll, move the pointer, and click a launcher to see whether a composer appears. It does not type into a composer or a form.
- Live sending also requires `WIDGET_CHAT_ALLOWLIST`, a comma-separated list of dealer origins. Matching is by hostname. An empty list sends nowhere.
- The chat agent sends only the four script lines below. Model output cannot add a sentence. The chat composer refuses an email, phone, or name field, so the script is never typed into a contact box.
- A visible captcha, a required field this worker does not recognize, and any form that asks for an address, date of birth, SSN, or trade details stop that form with nothing filled. An invisible reCAPTCHA badge does not.
- One live submit is allowed per vehicle page per channel (`lead_form` and `prechat`). A later run records `already_submitted` and does not open the lead form again.
- A known bot wall is stored as `blocked`, and the reason names the signature that matched. Walls are SOKAL, a Cloudflare interstitial ("Just a moment..." or "Attention Required! | Cloudflare"), Akamai, PerimeterX, DataDome, or an HTTP 403/429 response whose body says the request was denied. A dealer page that merely says "access denied" is not a wall. Later runs for that dealer site do not open the page and do not insert another row.
- The chat stops after 6 sends. If the dealer asks for the shopper's phone or email, the chat stops and does not send a shopper number.

Script:

1. `Is this unit still available?` plus the stock number when we have one. No introduction.
2. If the dealer says it is available: `What is the listing price?`
3. When a price is given: `Thanks. I'd like to continue over text and email, please reach us at {DREVVY_TEXT_NUMBER} or {DREVVY_EMAIL}.`
4. If they ask whether it is a bot: `I'm Drevvy's AI, working for {SHOPPER_FIRST_NAME}.`

Each turn reads the latest dealer message as text. If that text is missing, the turn sends a screenshot to the model. The model returns JSON with `status` (`available`, `sold`, `price_given`, `asked_contact`, `human_handoff`, `unknown`), `price`, and `next_message` limited to the script ids. The worker still decides the next line from the status so a mismatched `next_message` is not sent.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_BASE_URL` | no | OpenAI-compatible base URL. Default `https://api.openai.com/v1`. For Grok use `https://api.x.ai/v1`. |
| `AI_API_KEY` | research, and live chat | API key. Never logged. |
| `AI_MODEL` | research, and live chat | Model name, for example `grok-4` or `gpt-4o`. |
| `SUPABASE_URL` | yes | Project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key. The tables are locked to `service_role`. |
| `DRY_RUN` | no | Default true. Set to `false` to allow sends. |
| `WIDGET_CHAT_ALLOWLIST` | live chat | Comma-separated dealer site URLs or hostnames. |
| `DREVVY_TEXT_NUMBER` | lead and chat | Drevvy Telnyx text number. Used in the handoff line and in lead and pre-chat phone fields. |
| `DREVVY_EMAIL` | lead and chat | Drevvy email. Used in the handoff line, the lead message, and lead email fields. |
| `SHOPPER_FIRST_NAME` | lead and chat | First name only. Used on lead forms and in the bot disclosure. |
| `LEAD_LAST_NAME` | no | Last-name box on a lead form. Default `via Drevvy`. |
| `DREVVY_ZIP` | when a form has ZIP | Five-digit ZIP, or ZIP+4. A ZIP field without this value stops the form. |
| `RESEARCH_FETCH_TIMEOUT_MS` | no | Page fetch timeout. Default `15000`. |
| `WIDGET_CHAT_MAX_TURNS` | no | Send cap. Values above 6 are clamped to 6. |
| `WIDGET_SCAN_SETTLE_MS` | no | Extra wait after network idle before widget detection. Default `3000`. |
| `WIDGET_SCAN_CONCURRENCY` | no | How many scans run at once. Default `3`. `--concurrency` overrides it. |
| `WIDGET_SCAN_TIMEOUT_MS` | no | Per-site scan cap. Default `25000`. |
| `MARKETCHECK_API_KEY` | seed | MarketCheck key. Used to list dealer names and websites. Never stored or logged. |
| `MARKETCHECK_BASE_URL` | no | Default `https://api.marketcheck.com`. |
| `SEED_MIN_INTERVAL_MS` | no | Minimum gap between MarketCheck pages and dealer-site fetches. Default `1000`. `0` disables the gap. |

Copy `.env.example` and export it, or run Node with `--env-file`.

## Local checks

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install
pnpm --filter @drevvy/widget-worker lint
pnpm --filter @drevvy/widget-worker typecheck
pnpm --filter @drevvy/widget-worker test
```

Unit tests use saved HTML snapshots and a fake chat client. They do not launch Chromium. Install browsers before a live run:

```bash
pnpm --filter @drevvy/widget-worker exec playwright install chromium
```

## Railway

Create a service from this repo with root directory `apps/drevvy-widget-worker`. `railway.toml` builds the included Dockerfile, which is based on `mcr.microsoft.com/playwright:v1.49.1-jammy` so Chromium matches the `playwright@1.49.1` dependency. Keep those two versions together.

This is a one-shot worker, not a web server. The image defaults to `DRY_RUN=true` and exits after printing help. Set the start command to the batch you want, or run a one-off:

```bash
node dist/cli.js run /data/urls.txt
node dist/cli.js seed /data/launch-areas.txt --radius 25
node dist/cli.js report
```

`seed` and `report` do not send messages.

Railway cron can use that same command. Leave the restart policy at never so a finished job is not restarted in a loop.

Set the environment variables above in the Railway service. Keep `DRY_RUN=true` until `WIDGET_CHAT_ALLOWLIST` contains only dealer sites you intend to message. Apply the Supabase migrations separately before the first write.
