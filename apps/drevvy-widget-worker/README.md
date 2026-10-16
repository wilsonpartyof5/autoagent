# Drevvy widget worker

Standalone Node worker for day-0 dealer outreach:

1. **Research.** Given a dealer vehicle page, fetch that page and the dealer site, ask an OpenAI-compatible model for the widget vendor, phone numbers, and emails, check those values against the page, and upsert `dealer_directory`.
2. **Lead form.** On the vehicle page, fill one dealer form such as "Ask a Question", "Check Availability", "Get Today's Price", or "Unlock Instant Price".
3. **Widget chat.** Open the same page in Chromium, detect a known chat widget, fill a pre-chat gate when the widget has one, and follow a fixed script.

Lead forms and pre-chat gates use the shopper's first name, the last name `via Drevvy` (or `LEAD_LAST_NAME`), `DREVVY_TEXT_NUMBER`, `DREVVY_EMAIL`, and `DREVVY_ZIP` when the form has a ZIP field. The shopper's own phone, email, last name, address, date of birth, SSN, and trade details are never typed and never stored. If a dealer asks whether this is a bot, the chat reply is `I'm Drevvy's AI, working for {first}.`

MarketCheck contact data can be passed as a hint file. Hints are not written to the database. A phone, email, or name is stored only when it appears on the fetched dealer page. Do not point this worker at a MarketCheck listing URL.

Migrations, applied separately from this package:

- `supabase/migrations/20261018014500_dealer_directory_widget_chat.sql`
- `supabase/migrations/20261018030000_widget_attempt_channels.sql` adds `channel` (`widget`, `lead_form`, `prechat`) and `first_reply_channel` on `widget_chat_attempts`.

## Commands

```bash
pnpm --filter @drevvy/widget-worker research urls.txt --hints hints.json
pnpm --filter @drevvy/widget-worker lead urls.txt
pnpm --filter @drevvy/widget-worker chat urls.txt
pnpm --filter @drevvy/widget-worker run urls.txt
```

`run` researches the dealer, submits the vehicle lead form, then runs the widget chat.

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

Each command prints a table. `channel` is `widget`, `lead_form`, or `prechat`.

```text
url                         vendor    status    price    dry_run  channel
https://www.example...      gubagoo   dry_run   -        true     widget
```

## Lead form and pre-chat

The lead message, used when the form has a message, comment, or question field, is:

`Is this unit still available? Stock #X. What's the price on it? Please text or email us at {DREVVY_TEXT_NUMBER} / {DREVVY_EMAIL}.`

The stock sentence is omitted when the page has no stock number. There is no introduction. A form without a message field is still submitted with the identity fields it does have.

A widget pre-chat gate, such as Podium "Text us", is filled with the shopper's first name and `DREVVY_TEXT_NUMBER`. A single name box on that gate gets the first name only. A lead form with one full-name box gets `{first} {LEAD_LAST_NAME}`.

`first_reply_channel` stays empty until a dealer text reply is read. A screenshot-only turn does not set it. The first text reply updates the earlier attempt rows for that vehicle page.

## Safety

- `DRY_RUN` defaults to true. Only the exact string `false` turns it off. A dry run opens the page, logs the form fields or chat line, and does not type or submit.
- Live sending also requires `WIDGET_CHAT_ALLOWLIST`, a comma-separated list of dealer origins. Matching is by hostname. An empty list sends nowhere.
- The chat agent sends only the four script lines below. Model output cannot add a sentence. The chat composer refuses an email, phone, or name field, so the script is never typed into a contact box.
- Captcha, a required field this worker does not recognize, and any form that asks for an address, date of birth, SSN, or trade details stop that form with nothing filled.
- One live submit is allowed per vehicle page per channel (`lead_form` and `prechat`). A later run records `already_submitted` and does not open the lead form again.
- A bot wall such as a SOKAL "Access Restricted" page is stored as `blocked`. Later runs for that dealer site do not open the page and do not insert another row.
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
```

Railway cron can use that same command. Leave the restart policy at never so a finished job is not restarted in a loop.

Set the environment variables above in the Railway service. Keep `DRY_RUN=true` until `WIDGET_CHAT_ALLOWLIST` contains only dealer sites you intend to message. Apply both Supabase migrations separately before the first write.
