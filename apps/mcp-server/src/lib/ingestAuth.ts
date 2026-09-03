import { tokensEqual } from './tokensEqual.js';

export type IngestAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Fail closed: ingest is unavailable until INGESTION_API_TOKEN is set.
 * Query-string tokens are rejected so the secret cannot leak via logs or referrers.
 */
export function authorizeIngestRequest(
  headers: { authorization?: string | string[] },
  envToken?: string | null,
): IngestAuthResult {
  if (!envToken) {
    return { ok: false, status: 503, error: 'Ingestion is not configured' };
  }

  const raw = headers.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';

  if (!tokensEqual(token, envToken)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true };
}

export function resolveDeletionStrategy<T extends string>(
  strategy: T | undefined,
  dealerId?: string | null,
  fallback: T = 'none' as T,
): T {
  const requested = (strategy ?? fallback) as T;
  if (requested !== 'none' && !dealerId?.trim()) {
    return 'none' as T;
  }
  return requested;
}
