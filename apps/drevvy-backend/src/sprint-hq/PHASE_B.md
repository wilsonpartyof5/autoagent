# Phase B — read-only GitHub adapter

Implemented. The admin page loads a server-only reader for the public repo `wilsonpartyof5/autoagent`. There is still no GitHub Project, and this change does not create one, merge, deploy, or edit environment variables.

## Access

`/admin/sprint` is a server component behind the existing `requireAdmin` layout. `loadLiveBoard` runs only on the server. The optional `SPRINT_HQ_GITHUB_TOKEN` is read from the process environment when it is already present. It is not written to the client payload, and this repository does not define it.

A fresh sync is cached for 60 seconds. A rate limit or any other failed read serves the last good payload as **Stale**, or **Unknown** when none exists. Neither state uses the word LIVE, and neither falls back to Cinema Demo or the Nov 9 Snapshot while Live is selected. If the fetch fails before the first paint, the page opens on the Snapshot instead.

## Lane mapping

See the table in `README.md`. The mapper is pure and covered by recorded fixtures in `live/map-github.test.ts`.

- Merged with no successful production deployment that contains the merge SHA is Release-ready (`Merged, not released`), never Live.
- Live requires a successful production deployment status and an exact SHA match or a compare result of `ahead` or `identical`.
- Failed checks are a Building hold with the check name. They do not get inferred from the title.
- An approving review or `qa-verified` / `security-verified` label promotes a green open pull request to Validation. The same signal on a red, running, or draft pull request stays on the supported lane and shows `Needs reconciliation`.
- Backlog and Ready have no source. They say `No backlog source connected (master sheet not wired)`.

## Endpoints

`GET https://api.github.com/repos/wilsonpartyof5/autoagent` plus:

- `/pulls` (open and recently updated closed)
- `/commits/{sha}/check-runs`
- `/commits/{sha}/status` when check runs are empty
- `/pulls/{number}/reviews`
- `/deployments` and `/deployments/{id}/statuses`
- `/compare/{merge}...{deploy}` when an exact SHA match is missing
- `/actions/runs`

Cards show titles, numbers, SHAs, check names, conclusions, and links. Bodies and comments are not read onto the card.

## What stays unconnected

Cursor run telemetry is `Not connected`. The six role bots stay idle, because GitHub does not assign those roles. A GitHub Actions indicator uses the building animation only while a check run on a card head is `in_progress` or queued. `releaseAuthorized` stays null.
