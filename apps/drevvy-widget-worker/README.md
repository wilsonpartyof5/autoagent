# Drevvy widget worker

Standalone Node worker for two dealer steps:

1. **Research.** Given a dealer vehicle page, fetch that page and the dealer site, ask an OpenAI-compatible model for the widget vendor, phone numbers, and emails, check those values against the page, and upsert `dealer_directory`.
2. **Widget chat.** Open the vehicle page in Chromium, detect a known chat widget, and follow a fixed script. By default this is a dry run: it identifies the widget and logs the message it would send.

Shopper phone numbers and email addresses are never typed into a widget and never stored. The handoff message uses Drevvy's own text number and email. If a dealer asks whether this is a bot, the reply is `I'm Drevvy's AI, working for {first}.`

MarketCheck contact data can be passed as a hint file. Hints are not written to the database. A phone, email, or name is stored only when it appears on the fetched dealer page. Do not point this worker at a MarketCheck listing URL.

The migration is `supabase/migrations/20261018014500_dealer_directory_widget_chat.sql`. This package does not apply it.

## Commands

```bash
pnpm --filter @drevvy/widget-worker research urls.txt --hints hints.json
pnpm --filter @drevvy/widget-worker chat urls.txt
pnpm --filter @drevvy/widget-worker run urls.txt
```

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

The chat command prints a table:

```text
url                         vendor    status    price    dry_run
https://www.example...      gubagoo   dry_run   -        true
```

## Safety

- `DRY_RUN` defaults to true. Only the exact string `false` turns it off.
- Live sending also requires `WIDGET_CHAT_ALLOWLIST`, a comma-separated list of dealer origins. Matching is by hostname. An empty list sends nowhere.
- The agent sends only the four script lines below. Model output cannot add a sentence.
- It stops on a captcha, on a widget form that asks for a name, phone, or email, and after 6 sends.
- It does not fill those contact fields.

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
| `DREVVY_TEXT_NUMBER` | chat | Drevvy text number used in the handoff line. |
| `DREVVY_EMAIL` | chat | Drevvy email used in the handoff line. |
| `SHOPPER_FIRST_NAME` | chat | First name only, for the bot disclosure. |
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

Set the environment variables above in the Railway service. Do not set `DRY_RUN=false` until `WIDGET_CHAT_ALLOWLIST` contains only dealer sites you intend to message. Apply the Supabase migration separately before the first write.
