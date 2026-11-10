# Drevvy Sprint HQ (Phase A)

Read-only sprint control room inside the existing admin console. The route is `/admin/sprint`. It uses the same admin gate as the rest of `/admin` (`ADMIN_EMAILS`, sign-in at `/auth`). Nothing in this folder talks to GitHub, Cursor, or Supabase.

## Default mode

This route is a founder-internal dashboard, so the first view is **Nov 9 Snapshot**, not Cinema Demo. The Snapshot control is marked Default. Cinema Demo is one press away. Live is visible and always says `Live connection unavailable — not configured`.

## Modes

| Mode | Banner | What it shows |
|---|---|---|
| Nov 9 Snapshot | `PROPOSAL SNAPSHOT — Nov 9, 2026` | The eight proposal cards in the columns from the Phase A table. Building, Release-ready, and Live are empty. |
| Cinema Demo | `SIMULATION — NOT LIVE` | A deterministic 3 minute 12 second script. Card ids are `DEMO-###`. Reset returns the script clock to the start. |
| Live | `Live connection unavailable — not configured` | No cards and no telemetry. It does not fall back to demo data. |

Snapshot cards do not move when Play is pressed. The demo engine refuses any id that is not `DEMO-###` and does not import the snapshot fixture.

## What is real vs simulated

The snapshot is a frozen reading of the 9 November 2026 proposal (with the 10 November v2 notes). It is not a live board. Greg's master sheet stays the canonical backlog until a migration is approved. Short commit ids shown on three cards are the strings written in that proposal, labeled as not a live lookup. Evidence file paths are omitted because this repository is public.

Unknown drawer fields say `Not available`. The metrics strip uses `—` or `Not configured` for progress, builders, and time left. Hold counts are counted from the cards on screen and labeled as such. Percentages, builder counts, and the countdown drawn on the concept image are not used.

Cinema Demo may show a fictional QA fail, a fictional SHA `DEMO-SHA-02`, and a **Simulated approval**. That approval is a script label. There is no Approve, Deploy, or Publish button.

## Screens

Sprint Board, Office Sim, Agents, Runs & Builds, Approvals, and Reports share one state object. On a phone the office sits above a horizontally scrolling seven-lane board, with a lane switcher and a bottom-sheet card drawer. Desktop (around 1440px) puts the board and activity side by side and the office underneath.

Release-ready and Live carry the v2 note: a merge is **Merged-not-released**, not Live. Reports includes the Phase 1 one-cycle pilot (one builder dispatched by Main PM, local first, independent QA and Security, no committed baseline). Two builders is described as a later phase, not as a current fact.

Playback: Play, Pause, Reset, 0.5× / 1× / 2×, Reduce motion. The page also follows `prefers-reduced-motion`. Event rows seek the demo clock. Watch selected card filters that list. Reduce motion keeps the state changes and hides travel and confetti.

## Run the tests

From `apps/drevvy-backend`:

```bash
pnpm test:sprint-hq
```

Typecheck and lint are the app scripts (`pnpm typecheck`, `pnpm lint`). Opening the page locally needs the existing admin preview or an allowlisted session. This feature adds no environment variable.

```bash
ADMIN_PREVIEW=1 pnpm dev
```

Then open `/admin/sprint`. `ADMIN_PREVIEW` only works when `NODE_ENV` is not production. Do not set it in production.

## Layout

- `fixtures/snapshot.ts` — frozen Nov 9 cards
- `fixtures/demo-cards.ts` and `fixtures/demo-script.ts` — synthetic script
- `engine/demo-engine.ts` — pure clock projection
- `components/` — board, office, robots, drawers, panels
- `PHASE_B.md` — read-only GitHub adapter note, not implemented

## Phase B

See `PHASE_B.md`. Do not add tokens or a GitHub Project as part of this folder.
