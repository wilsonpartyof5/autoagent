import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDueForRefresh, REFRESH_AFTER_DAYS } from '../src/directory/refresh';

describe('directory refresh', () => {
  const now = new Date('2026-10-16T00:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  it('treats a missing check as due', () => {
    assert.equal(REFRESH_AFTER_DAYS, 30);
    assert.equal(isDueForRefresh(null, now), true);
  });

  it('is not due at exactly 30 days', () => {
    const checked = new Date(now.getTime() - 30 * day).toISOString();
    assert.equal(isDueForRefresh(checked, now), false);
  });

  it('is due once the row is older than 30 days', () => {
    const checked = new Date(now.getTime() - 30 * day - 1).toISOString();
    assert.equal(isDueForRefresh(checked, now), true);
  });
});
