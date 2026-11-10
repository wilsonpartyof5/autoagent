# Phase B note — read-only GitHub adapter

Not implemented. Phase A does not call GitHub, Cursor, or Supabase, and it does not create a Project or a workflow.

## When it would be allowed

Only after DW approves a migration and the private project proposed in the Nov 10 operating model actually exists. Until then Greg's master sheet stays the canonical backlog. If the project is missing or the token cannot read it, the screen keeps saying `Live connection unavailable — not configured`. It must not invent a second backlog and it must not keep a LIVE badge while showing demo or snapshot cards.

## Shape

A server-only adapter, outside the browser, would:

1. Read project items plus the linked pull request, review, and check status.
2. Normalize them into the existing `SprintCard` shape with a `SourceStamp` (`system`, external id, url, recorded time, head SHA).
3. Leave `releaseAuthorized` null unless a recorded approval says otherwise. A merged pull request maps to the Merged-not-released note, not to Live.
4. Mark the payload stale when a poll or webhook is missing. Stale is not healthy and not idle.
5. Refuse writes. No Projects mutation, no merge, no deploy, no SQL, no dispatch.

The browser would call a same-origin admin route that already sits behind `requireAdmin`. The token stays on the server.

## Permissions DW would have to create

These do not exist today and this change does not create them.

- A project-scoped token or GitHub App that can **read** the project and the repo's pull requests and checks. The repo's built-in Actions token cannot write to Projects; Phase B should not be given write scope either.
- The token stored as a server secret, not in this public repo, not in `NEXT_PUBLIC_*`, and not in the fixture files.
- Admin session already required by `/admin`. The adapter should not add a second public endpoint.
- No Cursor API key for Phase B. Run telemetry stays "No run telemetry connected" until a later, separate approval.

## What the adapter must not do

- Create the project, re-point workflows, or open pull requests.
- Treat a chat message as a lane change.
- Copy shopper, dealer, or credential material into the public repo or the browser payload.
- Show author-local test output as independent QA, or a merge as Live.
