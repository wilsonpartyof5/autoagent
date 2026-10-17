import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assembleOverviewDeals,
  classifyDealStatus,
  demoOverviewDeals,
  OVERVIEW_STATUSES,
  priceDropRounds,
  responseHours,
  summarizeDeals,
} from './deals-overview';

const HERE = dirname(fileURLToPath(import.meta.url));

test('live rows map onto active, sold, no-response, and accepted', () => {
  assert.equal(classifyDealStatus('interested', 'open', null), 'active');
  assert.equal(classifyDealStatus('negotiating', null, null), 'active');
  assert.equal(classifyDealStatus('accepted', 'open', false), 'accepted');
  assert.equal(classifyDealStatus('negotiating', 'sold', null), 'sold');
  assert.equal(classifyDealStatus('interested', 'ended_no_response', null), 'no-response');
  assert.equal(classifyDealStatus('closed', 'removed', null), null);
  assert.equal(classifyDealStatus('accepted', 'sold', true), 'sold');

  const deals = assembleOverviewDeals({
    deals: [
      { id: 'open', status: 'interested', createdAt: '2026-09-02T15:00:00.000Z' },
      { id: 'bought', status: 'accepted', createdAt: '2026-09-03T15:00:00.000Z' },
      { id: 'quiet', status: 'interested', createdAt: '2026-08-01T15:00:00.000Z' },
      { id: 'yes', status: 'accepted', createdAt: '2026-09-04T15:00:00.000Z' },
    ],
    lifecycle: [
      { dealId: 'open', endState: 'open', addedAt: '2026-09-02T15:00:00.000Z', firstOutreachAt: '2026-09-02T16:00:00.000Z', repliedAt: '2026-09-03T16:00:00.000Z', bought: null },
      { dealId: 'bought', endState: 'sold', addedAt: '2026-09-03T15:00:00.000Z', firstOutreachAt: '2026-09-03T16:00:00.000Z', repliedAt: '2026-09-03T20:00:00.000Z', bought: true },
      { dealId: 'quiet', endState: 'ended_no_response', addedAt: null, firstOutreachAt: '2026-08-01T16:00:00.000Z', repliedAt: null, bought: false },
      { dealId: 'yes', endState: 'open', addedAt: '2026-09-04T15:00:00.000Z', firstOutreachAt: null, repliedAt: null, bought: false },
    ],
    offers: [
      { dealId: 'yes', price: 30000, at: '2026-09-05T12:00:00.000Z' },
      { dealId: 'yes', price: 29000, at: '2026-09-06T12:00:00.000Z' },
      { dealId: 'yes', price: 28500, at: '2026-09-07T12:00:00.000Z' },
    ],
    messages: [
      { dealId: 'yes', direction: 'outbound', at: '2026-09-04T16:00:00.000Z' },
      { dealId: 'yes', direction: 'inbound', at: '2026-09-04T18:00:00.000Z' },
    ],
  });
  const summary = summarizeDeals(deals, 'live');
  assert.deepEqual(summary.counts, { active: 1, sold: 1, 'no-response': 1, accepted: 1 });
  assert.equal(summary.replies, 3);
  assert.equal(summary.averageResponseHours, (24 + 4 + 2) / 3);
  assert.equal(deals.find((deal) => deal.id === 'yes')?.priceDropRounds, 2);
  assert.equal(priceDropRounds([{ price: 10, at: 'a' }, { price: 12, at: 'b' }]), 0);
  assert.equal(responseHours('2026-09-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'), null);
  assert.equal(summary.carsByMonth.find((row) => row.month === '2026-09')?.cars, 3);
});

test('test messages do not count as dealer replies', () => {
  const deals = assembleOverviewDeals({
    deals: [{ id: 'd', status: 'interested', createdAt: '2026-09-02T15:00:00.000Z' }],
    lifecycle: [{ dealId: 'd', endState: 'open', addedAt: '2026-09-02T15:00:00.000Z', firstOutreachAt: null, repliedAt: null, bought: null }],
    offers: [],
    messages: [
      { dealId: 'd', direction: 'outbound', at: '2026-09-02T16:00:00.000Z', isTest: true },
      { dealId: 'd', direction: 'inbound', at: '2026-09-02T17:00:00.000Z', isTest: true },
      { dealId: 'd', direction: 'outbound', at: '2026-09-02T18:00:00.000Z' },
      { dealId: 'd', direction: 'inbound', at: '2026-09-02T20:00:00.000Z' },
    ],
  });
  assert.equal(deals[0]?.responseHours, 2);
});

test('an empty deal table falls back to demo counts for every status', () => {
  const summary = summarizeDeals(demoOverviewDeals(), 'demo');
  assert.equal(summary.source, 'demo');
  assert.equal(OVERVIEW_STATUSES.reduce((sum, status) => sum + summary.counts[status], 0), 19);
  for (const status of OVERVIEW_STATUSES) {
    assert.equal(summary.counts[status] > 0, true, status);
  }
  assert.equal(summary.averageResponseHours != null && summary.averageResponseHours > 0, true);
  assert.equal(summary.averagePriceDropRounds != null && summary.averagePriceDropRounds >= 0, true);
  assert.equal(summary.roundBuckets.reduce((sum, bucket) => sum + bucket.count, 0), 19);
});

test('deals page copy does not use the banned word', () => {
  const page = readFileSync(join(HERE, '../../app/admin/deals/page.tsx'), 'utf8');
  const shell = readFileSync(join(HERE, '../../components/admin/admin-shell.tsx'), 'utf8');
  assert.equal(/negotiat/i.test(page), false);
  assert.equal(/negotiat/i.test(shell), false);
  assert.match(page, /Average dealer response time/);
  assert.match(page, /Price-drop rounds/);
});
