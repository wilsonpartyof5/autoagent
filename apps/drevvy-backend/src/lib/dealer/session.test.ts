import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  dealerDisplayName,
  dealerInitials,
  dealerPreviewEnabled,
  dealerRooftopsFromRows,
  highestDealerRole,
  isLiveDealerSession,
  mapDealerRole,
  pageSessionDecision,
  sessionFromUser,
  sessionRooftopIds,
} from './session';
import { demoDealerSession } from './demo-session';

const HERE = dirname(fileURLToPath(import.meta.url));

test('dealer preview is off in production even with ADMIN_PREVIEW', () => {
  assert.equal(dealerPreviewEnabled({ NODE_ENV: 'production', ADMIN_PREVIEW: '1' }), false);
  assert.equal(dealerPreviewEnabled({ NODE_ENV: 'development', ADMIN_PREVIEW: '1' }), true);
  assert.equal(dealerPreviewEnabled({ NODE_ENV: 'development', DEALER_PREVIEW: '1' }), true);
  assert.equal(dealerPreviewEnabled({ NODE_ENV: 'development' }), false);
});

test('membership roles map onto the desk Owner/GM switcher', () => {
  assert.equal(mapDealerRole('owner'), 'owner_gm');
  assert.equal(mapDealerRole('GM'), 'owner_gm');
  assert.equal(mapDealerRole('owner/gm'), 'owner_gm');
  assert.equal(mapDealerRole('sales_manager'), 'sales_manager');
  assert.equal(mapDealerRole('bdc'), 'bdc');
  assert.equal(mapDealerRole('salesperson'), 'salesperson');
  assert.equal(highestDealerRole(['salesperson', 'owner_gm', 'bdc']), 'owner_gm');
});

test('session rooftop filter stays inside memberships', () => {
  const session = sessionFromUser(
    { id: 'user-1', email: 'maya@lakesidehonda.com' },
    [
      { id: 'roof-a', name: 'Lakeside Honda', role: 'owner_gm' },
      { id: 'roof-b', name: 'Midtown Toyota', role: 'owner_gm' },
    ],
  );
  assert.equal(session.role, 'owner_gm');
  assert.equal(session.source, 'live');
  assert.equal(session.canSwitchAllRooftops, true);
  assert.equal(session.displayName, 'Maya');
  assert.equal(session.initials, 'MA');
  assert.deepEqual(sessionRooftopIds(session, 'all'), ['roof-a', 'roof-b']);
  assert.deepEqual(sessionRooftopIds(session, 'roof-a'), ['roof-a']);
  assert.deepEqual(sessionRooftopIds(session, 'missing'), []);
});

test('display names do not leak an email domain', () => {
  assert.equal(dealerDisplayName('derek.patel@store.com'), 'Derek');
  assert.equal(dealerInitials('Maya R.', 'maya@lakesidehonda.com'), 'MR');
  assert.equal(dealerInitials('Maya', 'maya@lakesidehonda.com'), 'MA');
});

test('demo desk session opens the pages and live membership still wins', () => {
  const live = sessionFromUser(
    { id: 'user-1', email: 'dustin@drevvy.com' },
    [{ id: 'roof-live', name: 'Live Rooftop', role: 'salesperson' }],
  );
  const demo = demoDealerSession();
  assert.equal(demo.source, 'demo');
  assert.equal(demo.displayName, 'Derek Patel');
  assert.deepEqual(demo.rooftops.map((rooftop) => rooftop.id), ['lakeside', 'midtown', 'airport']);
  assert.equal(isLiveDealerSession(demo), false);
  assert.equal(isLiveDealerSession(live), true);

  const withLive = pageSessionDecision(live, demo, false);
  assert.equal(withLive.redirectToLogin, false);
  assert.equal(withLive.session?.source, 'live');
  assert.equal(withLive.session?.userId, 'user-1');

  const demoOnly = pageSessionDecision(null, demo, false);
  assert.equal(demoOnly.redirectToLogin, false);
  assert.equal(demoOnly.session?.source, 'demo');

  const signedOut = pageSessionDecision(null, null, false);
  assert.equal(signedOut.redirectToLogin, true);
  assert.equal(signedOut.session, null);

  const preview = pageSessionDecision(null, null, true);
  assert.equal(preview.redirectToLogin, false);
  assert.equal(preview.session, null);
});

test('the live desk ignores a membership that is not verified or whose rooftop is not onboarded', () => {
  const source = readFileSync(join(HERE, 'session.ts'), 'utf8');
  assert.match(source, /\.not\('onboarded_at', 'is', null\)/);
  assert.match(source, /\.not\('access_verified_at', 'is', null\)/);
  const stamp = '2026-11-09T00:00:00.000Z';
  const rooftops = dealerRooftopsFromRows(
    [
      { dealership_id: 'roof-on', role: 'owner', access_verified_at: stamp },
      { dealership_id: 'roof-peer', role: 'salesperson', access_verified_at: null },
      { dealership_id: 'roof-off', role: 'salesperson', access_verified_at: stamp },
      { dealership_id: 'roof-blank', role: 'gm', access_verified_at: stamp },
    ],
    [
      { id: 'roof-on', name: 'Honda Cars', onboarded_at: stamp },
      { id: 'roof-peer', name: 'Honda Cars', onboarded_at: stamp },
      { id: 'roof-off', name: 'Squatted', onboarded_at: null },
      { id: 'roof-blank', name: 'Blank', onboarded_at: '   ' },
    ],
  );
  assert.deepEqual(rooftops, [{
    id: 'roof-on',
    name: 'Honda Cars',
    role: 'owner_gm',
  }]);
});

test('dealer API routes use requireDealerApi and never requireAdmin', () => {
  const routeFiles = [
    '../../app/api/dealer/v1/session/route.ts',
    '../../app/api/dealer/v1/inbox/route.ts',
    '../../app/api/dealer/v1/analytics/route.ts',
    '../../app/api/dealer/v1/billing/route.ts',
    '../../app/api/dealer/v1/leads/[leadId]/route.ts',
    '../../app/api/dealer/v1/leads/[leadId]/messages/route.ts',
    '../../app/api/dealer/v1/leads/[leadId]/numbers/route.ts',
    '../../app/api/dealer/v1/leads/[leadId]/sold/route.ts',
  ];
  for (const file of routeFiles) {
    const source = readFileSync(join(HERE, file), 'utf8');
    assert.match(source, /withDealerApi|requireDealerApi/, file);
    assert.equal(source.includes('requireAdmin'), false, file);
    assert.equal(source.includes('telnyx'), false, file);
  }
});
