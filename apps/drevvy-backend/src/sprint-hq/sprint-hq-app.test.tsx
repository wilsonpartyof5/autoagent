import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SprintHqApp } from './components/sprint-hq-app';
import { SNAPSHOT_CARDS } from './fixtures/snapshot';
import { initialUiState } from './state/ui-state';
import type { LiveBoard } from './types';

function render(state: typeof initialUiState, live?: LiveBoard | null): string {
  return renderToStaticMarkup(createElement(SprintHqApp, { initialState: state, live }));
}

test('snapshot board renders seven lanes, the snapshot banner, and no live claim', () => {
  const html = render(initialUiState);
  assert.match(html, /PROPOSAL SNAPSHOT — Nov 9, 2026/);
  assert.doesNotMatch(html, /SIMULATION — NOT LIVE/);
  assert.equal(html.includes('data-claims-live="true"'), false);
  for (const lane of ['Backlog', 'Ready', 'Building', 'Review', 'Validation', 'Release-ready', 'Live']) {
    assert.match(html, new RegExp(`>${lane}<`));
  }
  assert.match(html, /G-128 \+ G-136/);
  assert.match(html, /S1-b/);
  assert.match(html, /Nothing in this lane/);
  assert.match(html, /The Nov 9 proposal has no cards here/);
  assert.match(html, /No committed sprint baseline/);
  assert.equal(/<button[^>]*>[^<]*Approve/.test(html), false);
  assert.equal(/<button[^>]*>[^<]*Deploy/.test(html), false);
  assert.equal(/<button[^>]*>[^<]*Publish/.test(html), false);
});

test('selecting a snapshot card opens the drawer with required fields', () => {
  const html = render({ ...initialUiState, selectedCardId: 'MOB-cand' });
  assert.match(html, /data-testid="card-drawer"/);
  for (const label of [
    'id',
    'outcome',
    'sourceMode',
    'proposalOrExisting',
    'owner',
    'lane',
    'executionState',
    'holdFlag',
    'holdOwner',
    'nextStep',
    'dependencies',
    'acceptanceCriteria',
    'testEnvironment',
    'headSHA',
    'baseSHA',
    'PR',
    'CI',
    'QAResult',
    'securityResult',
    'evidenceURLs',
    'evidenceTimestamp',
    'releaseAuthorization',
    'postDeployEvidence',
    'lastUpdated',
  ]) {
    assert.match(html, new RegExp(`<dt>${label}</dt>`));
  }
  assert.match(html, /Not available/);
  assert.match(html, /No event history is stored/);
  assert.match(html, /Copy approval brief/);
});

test('mode switch render shows the simulation banner and a replayable event', () => {
  const html = render({
    ...initialUiState,
    mode: 'demo',
    elapsedMs: 82_000,
    pulseStepId: 'qa-fail',
    playing: false,
  });
  assert.match(html, /SIMULATION — NOT LIVE/);
  assert.equal(html.includes('PROPOSAL SNAPSHOT — Nov 9, 2026'), false);
  assert.equal(html.includes('data-claims-live="true"'), false);
  assert.match(html, /DEMO-002/);
  assert.match(html, /data-step-id="qa-fail"/);
  assert.match(html, /Synthetic QA fail/);
  assert.doesNotMatch(html, /G-128 \+ G-136/);
});

test('reduced motion flag is visible and an unknown live sync does not claim LIVE', () => {
  const reduced = render({ ...initialUiState, reduceMotion: true });
  assert.match(reduced, /data-reduce="true"/);
  assert.match(reduced, /class="shq shq-reduce"/);
  const live = render({ ...initialUiState, mode: 'live', view: 'runs' });
  assert.match(live, /Unknown —/);
  assert.match(live, /Cursor run telemetry: Not connected/);
  assert.match(live, /No GitHub Actions runs in this sync/);
  assert.equal(live.includes('data-claims-live="true"'), false);
  assert.equal(live.includes('DEMO-'), false);
});

test('a fresh live board shows GitHub cards, empty backlog, and a building lamp only while checks run', () => {
  const running = {
    ...SNAPSHOT_CARDS[0],
    id: 'PR-11',
    title: 'Checks are running',
    lane: 'building' as const,
    ownerRole: 'octocat',
    blocked: false,
    sourceMode: 'live' as const,
    sourceSystem: 'github' as const,
    executionState: 'Checks in progress',
    ciInProgress: true,
    reconciliation: null,
  };
  const held = {
    ...running,
    id: 'PR-12',
    title: 'Checks failed',
    blocked: true,
    blocker: 'Failed checks: unit',
    executionState: 'Checks failed',
    ciInProgress: false,
  };
  const live: LiveBoard = {
    health: 'fresh',
    source: 'github.com/wilsonpartyof5/autoagent',
    syncedAt: '2026-11-10T15:04:00.000Z',
    detail: 'health fresh',
    cards: [running, held],
    workflowRuns: [
      {
        id: 'actions-9',
        name: 'CI',
        status: 'completed',
        conclusion: 'success',
        htmlUrl: 'https://github.com/wilsonpartyof5/autoagent/actions/runs/9',
        headSha: 'abc1234',
        updatedAt: '2026-11-10T15:03:00Z',
      },
    ],
    closedUnmerged: [],
  };
  const board = render({ ...initialUiState, mode: 'live' }, live);
  assert.match(board, /LIVE — github.com\/wilsonpartyof5\/autoagent — Last sync 2026-11-10T15:04:00.000Z — health fresh/);
  assert.match(board, /data-claims-live="true"/);
  assert.match(board, /No backlog source connected \(master sheet not wired\)/);
  assert.match(board, /Checks are running/);
  assert.match(board, /Checks running/);
  assert.match(board, /data-anim="building"/);
  assert.match(board, /PR-12/);
  assert.equal(board.includes('DEMO-'), false);
  const runs = render({ ...initialUiState, mode: 'live', view: 'runs' }, live);
  assert.match(runs, /GitHub Actions/);
  assert.match(runs, /Cursor run telemetry: Not connected/);
  assert.match(runs, /actions\/runs\/9/);
  const idle = render({ ...initialUiState, mode: 'live' }, { ...live, cards: [held] });
  assert.match(idle, /data-anim="idle"/);
  assert.equal(idle.includes('data-anim="building"'), false);
});

test('approvals offer evidence and a brief, and reports keep the phase 1 pilot', () => {
  const approvals = render({ ...initialUiState, view: 'approvals' });
  assert.match(approvals, /View evidence/);
  assert.match(approvals, /Copy approval brief/);
  assert.match(approvals, /OPS-1/);
  assert.match(approvals, /G-128 \+ G-136/);
  assert.equal(/<button[^>]*>[^<]*Approve/.test(approvals), false);
  const reports = render({ ...initialUiState, view: 'reports' });
  assert.match(reports, /No committed sprint baseline/);
  assert.match(reports, /Phase 1 pilot — one manual cycle/);
  assert.match(reports, /One builder, dispatched by Main PM/);
  assert.match(reports, /Merged is not Live/);
  assert.match(reports, /QA does not test work it authored/);
});
