import assert from 'node:assert/strict';
import test from 'node:test';

import { modeBanner } from './display';
import { projectDemo } from './engine/demo-engine';
import { SNAPSHOT_CARDS } from './fixtures/snapshot';
import { initialUiState, uiReducer } from './state/ui-state';
import { filterCards, sprintView } from './state/view-model';
import type { LiveBoard, SprintCard } from './types';
import { sprintCss } from './components/sprint-hq-css';

test('mode banners claim LIVE only for a fresh GitHub sync', () => {
  for (const mode of ['demo', 'snapshot', 'live'] as const) {
    const banner = modeBanner(mode);
    assert.equal(banner.claimsLive, false);
    assert.equal(banner.text.startsWith('LIVE —'), false);
  }
  assert.equal(modeBanner('demo').text, 'SIMULATION — NOT LIVE');
  assert.equal(modeBanner('snapshot').text, 'PROPOSAL SNAPSHOT — Nov 9, 2026');
  assert.match(modeBanner('live').text, /^Unknown —/);
  const fresh = modeBanner('live', {
    health: 'fresh',
    source: 'github.com/wilsonpartyof5/autoagent',
    syncedAt: '2026-11-10T15:00:00.000Z',
    detail: 'health fresh',
    cards: [],
    workflowRuns: [],
    closedUnmerged: [],
  });
  assert.equal(fresh.claimsLive, true);
  assert.match(fresh.text, /^LIVE — github.com\/wilsonpartyof5\/autoagent — Last sync 2026-11-10T15:00:00.000Z — health fresh$/);
  const stale = modeBanner('live', {
    health: 'stale',
    source: 'github.com/wilsonpartyof5/autoagent',
    syncedAt: '2026-11-10T15:00:00.000Z',
    detail: 'Last good sync kept after a rate limit.',
    cards: [],
    workflowRuns: [],
    closedUnmerged: [],
  });
  assert.equal(stale.claimsLive, false);
  assert.match(stale.text, /^Stale —/);
  assert.equal(stale.text.includes('LIVE —'), false);
  assert.equal(modeBanner('demo', {
    health: 'fresh',
    source: 'github.com/wilsonpartyof5/autoagent',
    syncedAt: '2026-11-10T15:00:00.000Z',
    detail: 'health fresh',
    cards: [],
    workflowRuns: [],
    closedUnmerged: [],
  }).claimsLive, false);
});

test('default state is the snapshot and playback cannot move it', () => {
  assert.equal(initialUiState.mode, 'snapshot');
  const before = JSON.stringify(SNAPSHOT_CARDS);
  let state = initialUiState;
  state = uiReducer(state, { type: 'play' });
  state = uiReducer(state, { type: 'tick', dtMs: 5_000 });
  state = uiReducer(state, { type: 'seek', stepId: 'fictional-release' });
  state = uiReducer(state, { type: 'reset' });
  assert.equal(state.mode, 'snapshot');
  assert.equal(state.elapsedMs, 0);
  assert.equal(state.playing, false);
  const view = sprintView(state);
  assert.equal(view.banner.text, 'PROPOSAL SNAPSHOT — Nov 9, 2026');
  assert.equal(view.cards.length, 8);
  assert.equal(view.projection, null);
  assert.equal(JSON.stringify(SNAPSHOT_CARDS), before);
});

test('demo playback, speed, replay, and reduce motion stay inside the demo clock', () => {
  const before = JSON.stringify(SNAPSHOT_CARDS);
  let state = uiReducer(initialUiState, { type: 'setMode', mode: 'demo' });
  assert.equal(state.playing, false);
  assert.equal(state.elapsedMs, 0);
  state = uiReducer(state, { type: 'play' });
  state = uiReducer(state, { type: 'setSpeed', speed: 2 });
  state = uiReducer(state, { type: 'tick', dtMs: 8_000 });
  assert.equal(state.elapsedMs, 16_000);
  assert.equal(projectDemo(state.elapsedMs).cards.find((card) => card.id === 'DEMO-002')?.lane, 'ready');
  state = uiReducer(state, { type: 'pause' });
  state = uiReducer(state, { type: 'tick', dtMs: 10_000 });
  assert.equal(state.elapsedMs, 16_000);
  state = uiReducer(state, { type: 'seek', stepId: 'qa-fail' });
  assert.equal(state.elapsedMs, 82_000);
  assert.equal(state.playing, true);
  assert.equal(state.pulseStepId, 'qa-fail');
  state = uiReducer(state, { type: 'toggleReduce' });
  assert.equal(state.reduceMotion, true);
  assert.equal(projectDemo(state.elapsedMs).cards.find((card) => card.id === 'DEMO-002')?.lane, 'building');
  state = uiReducer(state, { type: 'selectCard', id: 'DEMO-002' });
  state = uiReducer(state, { type: 'watchSelected' });
  const watched = sprintView(state);
  assert.equal(watched.script.every((step) => step.cardId === 'DEMO-002'), true);
  assert.equal(JSON.stringify(SNAPSHOT_CARDS), before);
});

test('switching back to snapshot drops demo selection and live shows no cards', () => {
  let state = uiReducer(initialUiState, { type: 'setMode', mode: 'demo' });
  state = uiReducer(state, { type: 'seek', stepId: 'fictional-release' });
  state = uiReducer(state, { type: 'selectCard', id: 'DEMO-002' });
  state = uiReducer(state, { type: 'setMode', mode: 'snapshot' });
  assert.equal(state.selectedCardId, null);
  assert.equal(state.elapsedMs, 0);
  assert.equal(sprintView(state).cards.some((card) => card.id.startsWith('DEMO-')), false);
  state = uiReducer(state, { type: 'setMode', mode: 'live' });
  const live = sprintView(state);
  assert.equal(live.cards.length, 0);
  assert.equal(live.banner.claimsLive, false);
  assert.equal(live.metrics.every((metric) => metric.value === 'Not configured' || metric.value === '—'), true);
});

test('live mode renders the GitHub board and never substitutes demo cards', () => {
  const card = {
    ...SNAPSHOT_CARDS[0],
    id: 'PR-7',
    title: 'Real pull request',
    lane: 'release_ready' as const,
    sourceMode: 'live' as const,
    sourceSystem: 'github' as const,
    executionState: 'Merged, not released',
    ciInProgress: false,
  } satisfies SprintCard;
  const live: LiveBoard = {
    health: 'stale',
    source: 'github.com/wilsonpartyof5/autoagent',
    syncedAt: '2026-11-10T15:00:00.000Z',
    detail: 'Last good sync kept after a fetch failure.',
    cards: [card],
    workflowRuns: [],
    closedUnmerged: [],
  };
  let state = uiReducer(initialUiState, { type: 'setMode', mode: 'demo' });
  state = uiReducer(state, { type: 'seek', stepId: 'fictional-release' });
  state = uiReducer(state, { type: 'setMode', mode: 'live' });
  const view = sprintView(state, live);
  assert.deepEqual(view.cards.map((item) => item.id), ['PR-7']);
  assert.equal(view.cards.some((item) => item.id.startsWith('DEMO-')), false);
  assert.equal(view.banner.claimsLive, false);
  assert.match(view.banner.text, /^Stale —/);
  assert.equal(view.projection, null);
});

test('filters narrow the snapshot without moving lanes', () => {
  const held = filterCards(SNAPSHOT_CARDS, { query: '', owner: 'all', hold: 'holds', kind: 'all' });
  assert.equal(held.every((card) => card.blocked), true);
  assert.equal(held.some((card) => card.id === 'G-126 · parser'), false);
  const flutter = filterCards(SNAPSHOT_CARDS, { query: 'unwired', owner: 'Flutter Build', hold: 'all', kind: 'all' });
  assert.deepEqual(flutter.map((card) => card.id), ['G-126 · parser']);
  const parserMention = filterCards(SNAPSHOT_CARDS, { query: 'parser', owner: 'all', hold: 'all', kind: 'all' });
  assert.deepEqual(parserMention.map((card) => card.id), ['G-126 · parser', 'S1-a']);
  const proposed = filterCards(SNAPSHOT_CARDS, { query: '', owner: 'all', hold: 'all', kind: 'proposed' });
  assert.deepEqual(proposed.map((card) => card.id), ['S1-a', 'S1-b']);
});

test('mobile layout rules keep the board scroll inside the page and honor reduced motion', () => {
  assert.match(sprintCss, /\.shq \{[^}]*overflow-x:\s*hidden/);
  assert.match(sprintCss, /\.shq-board-scroll \{[^}]*overflow-x:\s*auto/);
  assert.match(sprintCss, /min-height:\s*44px/);
  assert.match(sprintCss, /@media \(max-width: 800px\)|@media \(min-width: 1100px\)/);
  assert.match(sprintCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(sprintCss, /\.shq-sheet \{[^}]*bottom:\s*0/);
  assert.equal(sprintCss.includes('@import'), false);
  assert.equal(sprintCss.includes('http'), false);
});
