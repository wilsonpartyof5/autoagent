import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { DEMO_ROOFTOPS } from './demo-org';
import {
  demoSessionSecret,
  openDemoDealerSession,
  readDemoAcceptance,
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

test('a signed cookie cannot grant a live membership or a real rooftop', () => {
  const body = Buffer.from(JSON.stringify({
    v: 1,
    exp: NOW + 60_000,
    userId: 'real-user',
    source: 'live',
    email: 'owner@real-dealer.com',
    role: 'owner_gm',
    rooftops: [{ id: '11111111-1111-4111-8111-111111111111', role: 'owner_gm' }],
    acceptance: {
      fixture: true,
      legalAcceptance: false,
      liveWrite: false,
      persistence: 'isolated-demo',
      termsVersion: 'v2026.10',
      acceptor: 'demo-derek-patel',
      chargedCents: 0,
      rooftopIds: ['lakeside', '11111111-1111-4111-8111-111111111111'],
      commitments: ['message-only', 'itemized-otd'],
      acceptedAt: '2026-11-05T22:00:00.000Z',
      email: 'owner@real-dealer.com',
    },
  }), 'utf8').toString('base64url');
  const token = `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
  const session = openDemoDealerSession(token, SECRET, NOW);
  assert.equal(session?.source, 'demo');
  assert.equal(session?.userId, 'demo-derek-patel');
  assert.equal(session?.email, 'derek@lakesidehonda.com');
  assert.deepEqual(session?.rooftops.map((rooftop) => rooftop.id), DEMO_ROOFTOPS.map((rooftop) => rooftop.id));
  const acceptance = readDemoAcceptance(token, SECRET, NOW);
  assert.deepEqual(acceptance?.rooftopIds, ['lakeside']);
  assert.equal(acceptance?.legalAcceptance, false);
  assert.equal(JSON.stringify(acceptance).includes('real-dealer'), false);
  assert.equal(JSON.stringify(acceptance).includes('11111111'), false);

  const legalBody = Buffer.from(JSON.stringify({
    v: 1,
    exp: NOW + 60_000,
    acceptance: {
      fixture: true,
      legalAcceptance: true,
      liveWrite: true,
      persistence: 'isolated-demo',
      termsVersion: 'v2026.10',
      acceptor: 'demo-derek-patel',
      chargedCents: 0,
      rooftopIds: ['lakeside'],
      commitments: ['message-only', 'itemized-otd'],
    },
  }), 'utf8').toString('base64url');
  const legal = `${legalBody}.${createHmac('sha256', SECRET).update(legalBody).digest('base64url')}`;
  assert.equal(readDemoAcceptance(legal, SECRET, NOW), null);
  assert.equal(openDemoDealerSession(legal, SECRET, NOW)?.source, 'demo');
  assert.equal(openDemoDealerSession(legal, SECRET, NOW)?.userId, 'demo-derek-patel');
});
