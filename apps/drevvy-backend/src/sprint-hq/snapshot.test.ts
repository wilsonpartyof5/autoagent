import assert from 'node:assert/strict';
import test from 'node:test';

import { drawerRows, metricsFor, modeBanner, NOT_AVAILABLE } from './display';
import { LANE_ORDER } from './lanes';
import { SNAPSHOT_CARDS } from './fixtures/snapshot';

const EXPECTED: Array<{ id: string; title: string; lane: string; owner: string | null; proposed: boolean }> = [
  {
    id: 'G-128 + G-136',
    title: 'Canonical Market Intelligence delivery/replay + backend/API journey harness',
    lane: 'validation',
    owner: 'Pivot Ship',
    proposed: false,
  },
  {
    id: 'G-126 · parser',
    title: 'Market-save outcome parser (unwired)',
    lane: 'review',
    owner: 'Flutter Build',
    proposed: false,
  },
  {
    id: 'G-126 · S126-2',
    title: 'Sign-out spinner fix (vehicle detail page)',
    lane: 'validation',
    owner: 'Flutter Build',
    proposed: false,
  },
  {
    id: 'G-135',
    title: 'Reproducible build environment',
    lane: 'backlog',
    owner: 'Pivot Ship',
    proposed: false,
  },
  {
    id: 'OPS-1',
    title: 'Build-log credential follow-up',
    lane: 'ready',
    owner: 'Drevvy Security',
    proposed: false,
  },
  {
    id: 'MOB-cand',
    title: 'Account sheet error can keep spinner',
    lane: 'backlog',
    owner: null,
    proposed: false,
  },
  {
    id: 'S1-a',
    title: 'Wire parser into a local build, MI flag off',
    lane: 'backlog',
    owner: 'Flutter Build',
    proposed: true,
  },
  {
    id: 'S1-b',
    title: 'Prove one shopper journey end-to-end (local)',
    lane: 'backlog',
    owner: 'QA & Integration',
    proposed: true,
  },
];

test('Nov 9 snapshot matches the proposal table exactly', () => {
  assert.equal(SNAPSHOT_CARDS.length, 8);
  assert.deepEqual(
    SNAPSHOT_CARDS.map((card) => ({
      id: card.id,
      title: card.title,
      lane: card.lane,
      owner: card.ownerRole,
      proposed: card.proposed,
    })),
    EXPECTED,
  );
  for (const lane of ['building', 'release_ready', 'live'] as const) {
    assert.equal(SNAPSHOT_CARDS.filter((card) => card.lane === lane).length, 0, lane);
  }
  assert.deepEqual(LANE_ORDER, ['backlog', 'ready', 'building', 'review', 'validation', 'release_ready', 'live']);
  assert.equal(SNAPSHOT_CARDS.some((card) => card.id.startsWith('DEMO-')), false);
  assert.equal(SNAPSHOT_CARDS.every((card) => card.sourceMode === 'snapshot'), true);
});

test('snapshot does not treat lane placement as verification or a release', () => {
  const validation = SNAPSHOT_CARDS.filter((card) => card.lane === 'validation');
  assert.equal(validation.length, 2);
  assert.equal(validation.every((card) => card.evidenceState === 'prepared'), true);
  assert.equal(validation.every((card) => card.releaseAuthorized === false), true);
  assert.equal(SNAPSHOT_CARDS.some((card) => card.evidenceState === 'released'), false);
  assert.equal(SNAPSHOT_CARDS.some((card) => card.evidenceState === 'independently_verified'), false);
  const harness = SNAPSHOT_CARDS[0];
  assert.match(harness.executionState ?? '', /not CI/);
  assert.match(harness.executionState ?? '', /488 unique/);
  assert.equal(harness.postDeployEvidence, null);
});

test('unknown snapshot fields render as Not available and SHAs are only the named proposal strings', () => {
  const mobile = SNAPSHOT_CARDS.find((card) => card.id === 'MOB-cand');
  assert.ok(mobile);
  const rows = Object.fromEntries(drawerRows(mobile).map((row) => [row.label, row.value]));
  assert.equal(rows.headSHA, NOT_AVAILABLE);
  assert.equal(rows.baseSHA, NOT_AVAILABLE);
  assert.equal(rows.PR, NOT_AVAILABLE);
  assert.equal(rows.CI, NOT_AVAILABLE);
  assert.equal(rows.evidenceURLs, NOT_AVAILABLE);
  assert.equal(rows.postDeployEvidence, NOT_AVAILABLE);
  assert.equal(rows.lastUpdated, NOT_AVAILABLE);
  assert.equal(rows.releaseAuthorization, NOT_AVAILABLE);
  assert.equal(rows.owner, 'Unassigned');
  const withSha = SNAPSHOT_CARDS.filter((card) => card.headSha);
  assert.deepEqual(withSha.map((card) => card.id), ['G-128 + G-136', 'G-126 · parser', 'G-126 · S126-2']);
  for (const card of withSha) {
    assert.match(card.headSha ?? '', /not a live lookup/);
  }
});

test('snapshot metrics do not repeat the concept-image statistics', () => {
  const metrics = metricsFor('snapshot', SNAPSHOT_CARDS);
  const blob = JSON.stringify(metrics);
  assert.equal(blob.includes('64%'), false);
  assert.equal(blob.includes('3d 14h'), false);
  assert.equal(blob.includes('2 builders'), false);
  assert.equal(metrics.find((item) => item.id === 'progress')?.value, '—');
  assert.equal(metrics.find((item) => item.id === 'builders')?.value, 'Not configured');
  assert.equal(metrics.find((item) => item.id === 'time')?.value, 'Not configured');
  assert.equal(modeBanner('snapshot').text, 'PROPOSAL SNAPSHOT — Nov 9, 2026');
  assert.equal(modeBanner('snapshot').claimsLive, false);
});
