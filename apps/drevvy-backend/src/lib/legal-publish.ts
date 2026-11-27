/**
 * Server-only switch for the draft privacy and deletion pages.
 * On only when LEGAL_DRAFT_PUBLISH is exactly "true". Unset or any other
 * value is off. Do not read this from NEXT_PUBLIC_ or the client.
 */
export function legalDraftPublishEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.LEGAL_DRAFT_PUBLISH === 'true';
}
