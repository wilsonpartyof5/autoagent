import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  dealerDisplayName,
  dealerInitials,
  dealerPreviewEnabled,
  highestDealerRole,
  mapDealerRole,
  sessionFromUser,
  sessionRooftopIds,
} from './session';

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
