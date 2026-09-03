import { describe, expect, it } from 'vitest';
import { authorizeIngestRequest, resolveDeletionStrategy } from '../src/lib/ingestAuth.js';

describe('authorizeIngestRequest', () => {
  it('fails closed when the ingest token is unset', () => {
    const result = authorizeIngestRequest(
      { authorization: 'Bearer anything' },
      undefined,
    );
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: 'Ingestion is not configured',
    });
  });

  it('rejects missing or query-style tokens', () => {
    expect(authorizeIngestRequest({}, 'secret-token')).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('rejects a wrong bearer token', () => {
    expect(
      authorizeIngestRequest({ authorization: 'Bearer wrong' }, 'secret-token'),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it('accepts the matching bearer token', () => {
    expect(
      authorizeIngestRequest({ authorization: 'Bearer secret-token' }, 'secret-token'),
    ).toEqual({ ok: true });
  });
});

describe('resolveDeletionStrategy', () => {
  it('blocks mark_unavailable without a dealerId', () => {
    expect(resolveDeletionStrategy('mark_unavailable', undefined, 'mark_unavailable')).toBe(
      'none',
    );
    expect(resolveDeletionStrategy('mark_unavailable', '', 'mark_unavailable')).toBe('none');
  });

  it('keeps mark_unavailable when dealerId is present', () => {
    expect(resolveDeletionStrategy('mark_unavailable', '1038994')).toBe('mark_unavailable');
  });
});
