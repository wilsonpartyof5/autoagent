# Drevvy

Drevvy is a shopper app. A shopper stays anonymous and uses Drevvy to converse with a salesperson. The API is a Next.js app on Vercel.

The git repo is still `autoagent`. The Vercel project is still `autoagent-dealer-dashboard`. Do not rename that project: shipped iOS builds call `https://autoagent-dealer-dashboard.vercel.app`.

## What is in the repo

- `apps/autogentic` — SwiftUI shopper app, until a Flutter app replaces it
- `apps/drevvy-app` — Flutter shopper app
- `apps/drevvy-dealer-app` — Flutter dealer desk for iOS and Android. Demo data only. See its README.
- `apps/drevvy-backend` — package `@drevvy/backend`. Shopper APIs, operator sign-in, the admin allowlist, and the dealer desk at `/dealer`
- `supabase/migrations` — schema history. Do not apply these as part of a cleanup. Dealer tables stay until a later, separate migration
- `docs/drevvy` — product plan and the shopper journey notes that land with the admin console
- `docs/marketcheck` — MarketCheck reference notes

## Shopper routes

These paths stay stable:

- `POST /api/query/chat-search`
- `POST /api/query/parse`
- `POST /api/inventory/search`
- `GET /api/inventory/detail/:id`
- `GET /api/inventory/health`
- `GET /api/inventory/usage`
- `/api/consumer/*`

Search calls MarketCheck's hosted MCP from `apps/drevvy-backend/src/lib/marketcheck`. It does not use a ChatGPT server.

## Dealer desk

`/dealer` is a mock conversation desk for salespeople. Shoppers stay anonymous. The chat is in the app, not SMS. Details and the mock API are in `apps/drevvy-backend/DEALER.md`. The mobile shell is `apps/drevvy-dealer-app`. Shopper plan, noted only: $27/month for 10 conversations per month. Car packs are retired. There is no annual plan. This is not the deleted dealer portal. `/admin` is unchanged.

## Local setup

Node.js 20 and pnpm 8.

```bash
pnpm install
cp apps/drevvy-backend/.env.example apps/drevvy-backend/.env.local
pnpm --filter @drevvy/backend dev
```

`ADMIN_EMAILS` is a comma-separated list of Supabase auth emails allowed into `/admin`. Leave it empty to hide the console. `ADMIN_PREVIEW=1` only works when `NODE_ENV` is not production.

```bash
pnpm --filter @drevvy/backend typecheck
pnpm --filter @drevvy/backend test:shopper
pnpm --filter @drevvy/backend test:shopper-deals
pnpm --filter @drevvy/backend build
```

## Vercel

Root Directory must be `apps/drevvy-backend` after the rename is merged. Install and build commands are in `apps/drevvy-backend/vercel.json`. Crons are empty.
