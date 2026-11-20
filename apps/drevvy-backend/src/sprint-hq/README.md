# Drevvy Sprint HQ

Read-only sprint control room inside the existing admin console. The route is `/admin/sprint`. It uses the same admin gate as the rest of `/admin` (`ADMIN_EMAILS`, sign-in at `/auth`). The browser never sees a GitHub token.

## Which mode opens

The reducer still starts on **Nov 9 Snapshot**. The page itself opens **Live** when that request's read-only GitHub fetch succeeds. If the fetch fails or is rate-limited, the page opens on the Snapshot, and choosing Live then shows `Stale` or `Unknown`. It does not show demo cards under a LIVE badge.

Cinema Demo is unchanged and always labeled `SIMULATION — NOT LIVE`.

## Modes

| Mode | Banner | What it shows |
|---|---|---|
| Nov 9 Snapshot | `PROPOSAL SNAPSHOT — Nov 9, 2026` | The eight proposal cards in the columns from the Phase A table. Building, Release-ready, and Live are empty. |
| Cinema Demo | `SIMULATION — NOT LIVE` | A deterministic 3 minute 12 second script. Card ids are `DEMO-###`. Reset returns the script clock to the start. |
| Live, fresh | `LIVE — github.com/wilsonpartyof5/autoagent — Last sync <time> — health fresh` | Pull requests mapped from GitHub. Backlog and Ready say the master sheet is not connected. |
| Live, stale | `Stale — … — last good sync <time>` | The last successful payload. Not a LIVE badge. |
| Live, unknown | `Unknown — no successful sync yet…` | No cards. Demo and snapshot data are not substituted. |

Snapshot cards do not move when Play is pressed. The demo engine refuses any id that is not `DEMO-###` and does not import the snapshot fixture.

## Live lane rules

There is no GitHub Project. Lanes come only from pull-request state, check runs, the combined status when a head has no check runs, reviews, two exact labels, and production deployments. Titles and comments are not evidence.

| Evidence | Lane |
|---|---|
| Draft | Building. An approving review or evidence label on a draft is `Needs reconciliation`. |
| Open, no check runs and no status contexts | Building |
| Open, a check queued or `in_progress`, or a pending status context | Building. The office shows GitHub Actions as building only in this case. |
| Open, a failed, timed-out, cancelled, or action-required check, or a failure/error status | Building, with a hold whose reason names the check |
| Open, checks green, no independent approving review and no evidence label | Review |
| Open, checks green, and either a non-author `APPROVED` review or a `qa-verified` / `security-verified` label | Validation |
| Green checks missing, but an approval or evidence label is present | Stay on the check lane and show `Needs reconciliation` |
| Merged, and no successful production deployment whose SHA is the merge SHA or a descendant of it | Release-ready, `Merged, not released`. Never Live. |
| Merged, and a successful production deployment status exists for the merge SHA or a commit that contains it | Live. The drawer shows the deployment URL and time. |
| Closed and not merged | Not placed on a lane. Listed as closed, not merged. |

Production means the deployment environment matches `Production` (a leading word, so `Preview` does not count). The newest status on that deployment must be `success`. Containment is an exact SHA match, or a compare of `mergeSha...deploySha` whose status is `ahead` or `identical`. A missing compare is not proof.

A merged pull request with no merge SHA stays Release-ready and says `Needs reconciliation`. `releaseAuthorized` stays null. GitHub does not record a DW approval.

Backlog and Ready show `No backlog source connected (master sheet not wired)`.

The six role bots stay idle in Live. Cursor run telemetry stays `Not connected`. GitHub Actions workflow runs are listed under Agents and Runs.

## GitHub endpoints

Unauthenticated `GET` requests to `https://api.github.com` for `wilsonpartyof5/autoagent`, cached for 60 seconds:

- `/pulls?state=open&sort=updated&direction=desc&per_page=15`
- `/pulls?state=closed&sort=updated&direction=desc&per_page=8`
- `/commits/{head}/check-runs?per_page=20`
- `/commits/{head}/status` only when that head has no check runs
- `/pulls/{number}/reviews?per_page=20` for open pull requests
- `/deployments?per_page=15`
- `/deployments/{id}/statuses?per_page=10` for production deployments
- `/compare/{mergeSha}...{deploySha}` only when a merged SHA is not an exact production match, against at most three successful production SHAs
- `/actions/runs?per_page=15`

The adapter reads pull-request titles, numbers, SHAs, labels, draft state, review states, check names and conclusions, deployment URLs, and times. It does not render pull-request bodies or comments.

## Optional token

If the server process already has `SPRINT_HQ_GITHUB_TOKEN`, it is sent as a bearer token to `api.github.com` and is not returned to the browser. This change does not add or edit an environment variable. Leave it unset to use the unauthenticated public rate limit (60 requests per hour). A read-only token is what keeps a cold sync inside that limit, because one sync makes several REST calls. Do not grant the token write access.

## What is real vs simulated

The snapshot is a frozen reading of the 9 November 2026 proposal (with the 10 November v2 notes). It is not a live board. Greg's master sheet stays the canonical backlog. Short commit ids shown on three snapshot cards are the strings written in that proposal, labeled as not a live lookup. Evidence file paths are omitted because this repository is public.

Unknown drawer fields say `Not available`. The metrics strip uses `—` or `Not configured` for progress, builders, and time left. Live hold counts are counted from failed GitHub checks and labeled as such. Percentages, builder counts, and the countdown drawn on the concept image are not used.

Cinema Demo may show a fictional QA fail, a fictional SHA `DEMO-SHA-02`, and a **Simulated approval**. That approval is a script label. There is no Approve, Deploy, or Publish button.

## Run the tests

From `apps/drevvy-backend`:

```bash
pnpm test:sprint-hq
```

Typecheck and lint are the app scripts (`pnpm typecheck`, `pnpm lint`). Opening the page locally needs the existing admin preview or an allowlisted session.

```bash
ADMIN_PREVIEW=1 pnpm dev
```

Then open `/admin/sprint`. `ADMIN_PREVIEW` only works when `NODE_ENV` is not production. Do not set it in production.

## Layout

- `fixtures/snapshot.ts` — frozen Nov 9 cards
- `fixtures/demo-cards.ts` and `fixtures/demo-script.ts` — synthetic script
- `engine/demo-engine.ts` — pure clock projection
- `live/map-github.ts` — pure pull-request lane mapper
- `live/load.ts` — server-only GitHub reader
- `components/` — board, office, robots, drawers, panels
- `PHASE_B.md` — the read-only adapter rules
