import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateDealerActivation,
  shopperDeskIdentity,
  type MembershipClaim,
  type RecordedCommitment,
} from './activation';
import {
  COMMITMENT_COLUMNS,
  COMMITMENT_TABLE,
  createFixtureCommitmentStore,
  membershipsForUser,
  readSupabaseCommitment,
} from './activation-store';
import { readDemoAcceptance, sealDemoDealerSession } from './demo-session';
import { recordOnboardingFixture, resetOnboardingFixtures } from './onboarding-acceptance';

const HERE = dirname(fileURLToPath(import.meta.url));
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ROOF = '33333333-3333-4333-8333-333333333333';
const OTHER_ROOF = '44444444-4444-4444-8444-444444444444';
const SECRET = 'test-demo-session-secret';
const NOW = Date.parse('2026-11-05T22:00:00.000Z');

const membership: MembershipClaim = {
  userId: USER,
  rooftopId: ROOF,
  role: 'salesperson',
  rooftopName: 'Lakeside Honda',
};

function recorded(): RecordedCommitment {
  return {
    proof: 'recorded',
    userId: USER,
    rooftopId: ROOF,
    termsVersion: 'v2026.10',
    commitments: ['message-only', 'itemized-otd'],
    recordedAt: '2026-11-05T22:00:00.000Z',
  };
}

function decide(overrides: Partial<Parameters<typeof evaluateDealerActivation>[0]> = {}) {
  return evaluateDealerActivation({
    user: { id: USER, email: 'Maya@LakesideHonda.com' },
    requestedRooftopId: ROOF,
    memberships: [membership],
    onboardedRooftopIds: [ROOF],
    commitment: { status: 'recorded', row: recorded() },
    demoCookieProof: false,
    ...overrides,
  });
}

test('activation requires the signed-in member, the onboarded rooftop, and a recorded commitment', async () => {
  const allowed = decide();
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  assert.equal(allowed.persistence, 'recorded');
  assert.equal(allowed.email, 'maya@lakesidehonda.com');
  assert.equal(allowed.role, 'salesperson');
  assert.deepEqual(allowed.commitments, ['message-only', 'itemized-otd']);
  assert.equal(allowed.demoCookieIgnored, false);

  const signedOut = decide({ user: null });
  assert.equal(signedOut.ok, false);
  if (!signedOut.ok) assert.equal(signedOut.code, 'unauthenticated');
  const noEmail = decide({ user: { id: USER, email: 'not-an-email' } });
  assert.equal(noEmail.ok, false);
  if (!noEmail.ok) assert.equal(noEmail.code, 'unauthenticated');
  const wrongEmail = decide({ claimedEmail: 'other@example.com' });
  assert.equal(wrongEmail.ok, false);
  if (!wrongEmail.ok) assert.equal(wrongEmail.code, 'email_mismatch');

  const otherRoof = decide({ requestedRooftopId: OTHER_ROOF });
  assert.equal(otherRoof.ok, false);
  if (!otherRoof.ok) assert.equal(otherRoof.code, 'unknown_membership');

  const foreign = decide({
    memberships: [{ ...membership, userId: OTHER }],
  });
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.code, 'membership_mismatch');

  const missingDealership = decide({ onboardedRooftopIds: [] });
  assert.equal(missingDealership.ok, false);
  if (!missingDealership.ok) assert.equal(missingDealership.code, 'rooftop_not_onboarded');

  const missingCommitment = decide({ commitment: { status: 'missing' } });
  assert.equal(missingCommitment.ok, false);
  if (!missingCommitment.ok) assert.equal(missingCommitment.code, 'commitments_missing');

  const unread = decide({ commitment: { status: 'unavailable' } });
  assert.equal(unread.ok, false);
  if (!unread.ok) assert.equal(unread.code, 'commitments_unavailable');

  const partial = decide({
    commitment: { status: 'recorded', row: { ...recorded(), commitments: ['message-only'] } },
  });
  assert.equal(partial.ok, false);
  if (!partial.ok) assert.equal(partial.code, 'commitments_missing');
});

test('a demo cookie never activates, and a recorded row ignores it', () => {
  resetOnboardingFixtures();
  const fixture = recordOnboardingFixture({
    rooftopIds: ['lakeside'],
    commitments: ['message-only', 'itemized-otd'],
    now: '2026-11-05T22:00:00.000Z',
  });
  assert.equal(fixture.ok, true);
  if (!fixture.ok) return;
  const token = sealDemoDealerSession(SECRET, NOW, undefined, fixture.record);
  const cookie = readDemoAcceptance(token, SECRET, NOW + 1000);
  assert.equal(cookie?.legalAcceptance, false);

  const cookieOnly = decide({
    commitment: { status: 'missing' },
    demoCookieProof: cookie != null,
  });
  assert.equal(cookieOnly.ok, false);
  if (!cookieOnly.ok) assert.equal(cookieOnly.code, 'demo_cookie_rejected');

  const unreadAndCookie = decide({
    commitment: { status: 'unavailable' },
    demoCookieProof: true,
  });
  assert.equal(unreadAndCookie.ok, false);
  if (!unreadAndCookie.ok) assert.equal(unreadAndCookie.code, 'commitments_unavailable');

  const both = decide({ demoCookieProof: true });
  assert.equal(both.ok, true);
  if (!both.ok) return;
  assert.equal(both.persistence, 'recorded');
  assert.equal(both.demoCookieIgnored, true);
  assert.equal(both.rooftopId, ROOF);
  assert.equal(JSON.stringify(both).includes('isolated-demo'), false);
  assert.equal(JSON.stringify(both).includes('demo-derek'), false);
});

test('the fixture commitment store is memory and the supabase reader does not write', async () => {
  assert.deepEqual(
    membershipsForUser(USER, [membership, { ...membership, userId: OTHER, rooftopId: OTHER_ROOF }]).map((row) => row.rooftopId),
    [ROOF],
  );
  const store = createFixtureCommitmentStore();
  assert.equal(store.persistence, 'test-owned');
  assert.equal(store.liveWrite, false);
  assert.deepEqual(await store.read(USER, ROOF), { status: 'missing' });
  store.seed(recorded());
  const found = await store.read(USER, ROOF);
  assert.equal(found.status, 'recorded');
  store.reset();
  assert.equal((await store.read(USER, ROOF)).status, 'missing');

  let selected = '';
  let inserts = 0;
  const missingTable = await readSupabaseCommitment({
    from(table) {
      assert.equal(table, COMMITMENT_TABLE);
      return {
        select(columns) {
          selected = columns;
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: null, error: { message: 'relation does not exist' } };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  }, USER, ROOF);
  assert.equal(missingTable.status, 'unavailable');
  assert.equal(selected, COMMITMENT_COLUMNS);
  assert.equal(selected.includes('email'), false);
  assert.equal(inserts, 0);

  const liveRow = await readSupabaseCommitment({
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          user_id: USER,
                          dealership_id: ROOF,
                          terms_version: 'v2026.10',
                          commitments: ['itemized-otd', 'message-only'],
                          recorded_at: '2026-11-05T22:00:00.000Z',
                          email: 'maya@lakesidehonda.com',
                          phone: '555-010-1212',
                        },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  }, USER, ROOF);
  assert.equal(liveRow.status, 'recorded');
  if (liveRow.status !== 'recorded') return;
  assert.equal(JSON.stringify(liveRow.row).includes('maya@'), false);
  assert.equal(JSON.stringify(liveRow.row).includes('555'), false);
});

test('shopper activation identity keeps first name and optional ZIP only', () => {
  const plain = shopperDeskIdentity({
    firstName: 'Dana Blake',
    lastName: 'Blake',
    email: 'dana@example.com',
    phone: '555-010-1212',
    address: '1 Main Street',
    zip: '29730',
    financing: false,
  });
  assert.deepEqual(plain, { firstName: 'Dana', zip: null });
  assert.equal(JSON.stringify(plain).includes('Blake'), false);
  assert.equal(JSON.stringify(plain).includes('@'), false);

  const financed = shopperDeskIdentity({
    firstName: 'Dana',
    zip: '29730',
    financing: true,
    email: 'dana@example.com',
  });
  assert.deepEqual(financed, { firstName: 'Dana', zip: '29730' });
  assert.equal(JSON.stringify(financed).includes('@'), false);
});

test('the commitment draft stays out of migrations and off the live routes', () => {
  const root = join(HERE, '../../../../..');
  const draft = readFileSync(join(root, 'supabase/drafts/dealer_onboarding_commitments.sql'), 'utf8');
  assert.match(draft, /NOT APPLIED/);
  assert.match(draft, /message-only/);
  assert.match(draft, /itemized-otd/);
  assert.equal(/grant [^;]*insert[^;]*to authenticated/i.test(draft), false);
  assert.match(draft, /revoke all on public.dealer_onboarding_commitments from public, anon, authenticated/);

  const routes = [
    '../../app/api/dealer/v1/session/route.ts',
    '../../app/api/dealer/v1/inbox/route.ts',
    '../../app/api/dealer/v1/leads/[leadId]/messages/route.ts',
    '../../app/api/dealer/v1/leads/[leadId]/numbers/route.ts',
  ];
  for (const file of routes) {
    const source = readFileSync(join(HERE, file), 'utf8');
    assert.equal(source.includes('evaluateDealerActivation'), false, file);
    assert.equal(source.includes('dealer_onboarding_commitments'), false, file);
  }

  const adapter = readFileSync(join(HERE, 'activation.ts'), 'utf8');
  assert.equal(adapter.includes('drevvy-isolated-preview'), false);
  assert.equal(adapter.includes('fixconv_'), false);
});
