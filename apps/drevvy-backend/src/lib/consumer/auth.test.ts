import assert from 'node:assert/strict';
import test from 'node:test';

import { ConsumerAuthError, publicConsumerSession, rejectSharedInventoryCredential } from './auth';

test('the shared inventory key is rejected as a consumer credential', () => {
  const fromBearer = rejectSharedInventoryCredential('Bearer search-key', null, 'search-key');
  assert.equal(fromBearer?.code, 'shared_key_rejected');

  const fromHeader = rejectSharedInventoryCredential(null, 'search-key', 'search-key');
  assert.equal(fromHeader?.code, 'shared_key_rejected');

  const session = rejectSharedInventoryCredential('Bearer user-jwt', null, 'search-key');
  assert.equal(session, null);
});

test('a public session never includes contact fields', () => {
  const session = publicConsumerSession({
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 100,
    userId: 'user-1',
  });
  assert.deepEqual(Object.keys(session).sort(), ['accessToken', 'consumerUserId', 'expiresAt', 'refreshToken']);
  assert.equal(JSON.stringify(session).includes('email'), false);
});

test('an incomplete provider session is refused', () => {
  assert.throws(
    () => publicConsumerSession({ accessToken: 'access', userId: 'user-1' }),
    (error: unknown) => error instanceof ConsumerAuthError && error.code === 'session_missing',
  );
});
