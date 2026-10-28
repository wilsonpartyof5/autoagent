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

`/dealer` is the salesperson desk. A rooftop member signs in with a work-email code. Each shopper is labeled first name plus a short reference such as #A7F2. Live in-network threads open with `{first} wants your best itemized out-the-door`. Details and the `/api/dealer/v1` routes are in `apps/drevvy-backend/DEALER.md`. The Flutter shell is `apps/drevvy-dealer-app` and still uses demo data. The dealer desk is free day to day. A participating dealer is charged $300 when the shopper confirms a purchase. Stripe is not connected. Shopper keys never appear on the desk. Shopper plan, noted only: one-time key packs (1 key $4.99, 5 keys $19.99, 10 keys $34.99 recommended, 25 keys $74.99). Two spends from the same balance: market-intelligence unlock + save on a VDP, and a separate dealer-conversation key when the VDP URL matches an onboarded rooftop. Off-network out-the-door requests are free (analytics only, no in-app chat). The conversation-key refund clock is 7 days from confirmed delivery. There is no monthly conversation plan and no annual plan. This is not the deleted dealer portal. `/admin` is unchanged.

## Local setup

Node.js 20 and pnpm 8.

```bash
pnpm install
cp apps/drevvy-backend/.env.example apps/drevvy-backend/.env.local
pnpm --filter @drevvy/backend dev
```

`ADMIN_EMAILS` is a comma-separated list of Supabase auth emails allowed into `/admin`. Leave it empty to hide the console. `ADMIN_PREVIEW=1` only works when `NODE_ENV` is not production. The same flag, or `DEALER_PREVIEW=1`, serves the unsigned dealer mock in non-production.

```bash
pnpm --filter @drevvy/backend typecheck
pnpm --filter @drevvy/backend test:shopper
pnpm --filter @drevvy/backend test:shopper-deals
pnpm --filter @drevvy/backend build
```

## Vercel

Root Directory must be `apps/drevvy-backend` after the rename is merged. Install and build commands are in `apps/drevvy-backend/vercel.json`. Crons are empty.
