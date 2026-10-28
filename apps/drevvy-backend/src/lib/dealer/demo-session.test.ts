import assert from 'node:assert/strict';
import test from 'node:test';

import {
  demoSessionSecret,
  openDemoDealerSession,
  sealDemoDealerSession,
} from './demo-session';

const SECRET = 'test-demo-session-secret';
const NOW = Date.parse('2026-10-28T16:00:00.000Z');

test('demo session cookie round-trips and rejects tampering', () => {
  assert.equal(demoSessionSecret({}), null);
  assert.equal(demoSessionSecret({ CRON_SECRET: 'short' }), null);
  assert.equal(demoSessionSecret({ SUPABASE_JWT_SECRET: SECRET }), SECRET);

  const token = sealDemoDealerSession(SECRET, NOW);
  const session = openDemoDealerSession(token, SECRET, NOW + 1000);
  assert.equal(session?.source, 'demo');
  assert.equal(session?.email, 'derek@lakesidehonda.com');
  assert.equal(session?.role, 'owner_gm');

  assert.equal(openDemoDealerSession(token, SECRET, NOW + 13 * 60 * 60 * 1000), null);
  assert.equal(openDemoDealerSession(token, 'another-secret-value', NOW), null);
  assert.equal(openDemoDealerSession(`${token}x`, SECRET, NOW), null);
  assert.equal(openDemoDealerSession('not-a-token', SECRET, NOW), null);
  assert.equal(openDemoDealerSession(undefined, SECRET, NOW), null);
});
