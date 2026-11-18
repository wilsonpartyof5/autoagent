import assert from 'node:assert/strict';
import test from 'node:test';

import {
  demoSessionSecret,
  readDemoAcceptance,
  sealDemoDealerSession,
} from './demo-session';
import {
  listOnboardingFixtures,
  recordOnboardingFixture,
  resetOnboardingFixtures,
} from './onboarding-acceptance';

const NOW = '2026-11-05T22:00:00.000Z';
const SECRET = 'test-demo-session-secret';

test('fixture onboarding records rooftops and the two commitments without a live acceptance', () => {
  resetOnboardingFixtures();
  const missing = recordOnboardingFixture({
    rooftopIds: ['lakeside'],
    commitments: ['first-name'],
    now: NOW,
  });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.equal(missing.error, 'commitments');
  assert.equal(listOnboardingFixtures().length, 0);

  const noRoof = recordOnboardingFixture({
    rooftopIds: [],
    commitments: ['message-only', 'itemized-otd'],
    now: NOW,
  });
  assert.equal(noRoof.ok, false);

  const recorded = recordOnboardingFixture({
    rooftopIds: ['lakeside', 'midtown', 'not-a-rooftop'],
    commitments: ['message-only', 'itemized-otd', 'close-fee'],
    now: NOW,
  });
  assert.equal(recorded.ok, true);
  if (!recorded.ok) return;
  assert.equal(recorded.record.legalAcceptance, false);
  assert.equal(recorded.record.liveWrite, false);
  assert.equal(recorded.record.chargedCents, 0);
  assert.equal(recorded.record.persistence, 'isolated-demo');
  assert.match(recorded.record.label, /TEST FIXTURE/);
  assert.deepEqual(recorded.record.rooftopIds, ['lakeside', 'midtown']);
  assert.equal(recorded.record.commitments.includes('message-only'), true);
  assert.equal(recorded.record.commitments.includes('itemized-otd'), true);
  assert.equal(JSON.stringify(recorded.record).includes('@'), false);

  assert.equal(demoSessionSecret({ SUPABASE_JWT_SECRET: SECRET }), SECRET);
  const token = sealDemoDealerSession(SECRET, Date.parse(NOW), undefined, recorded.record);
  const read = readDemoAcceptance(token, SECRET, Date.parse(NOW) + 1000);
  assert.equal(read?.rooftopIds.includes('lakeside'), true);
  assert.equal(read?.legalAcceptance, false);
});
