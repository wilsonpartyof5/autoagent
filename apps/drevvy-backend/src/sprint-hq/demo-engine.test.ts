import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectDemo, stepsForCard } from './engine/demo-engine';
import { DEMO_LOOP_MS, DEMO_SCRIPT } from './fixtures/demo-script';
import { DEMO_CARDS } from './fixtures/demo-cards';
import { SNAPSHOT_CARDS } from './fixtures/snapshot';
import { visualPose } from './roles';

const engineSource = readFileSync(fileURLToPath(new URL('./engine/demo-engine.ts', import.meta.url)), 'utf8');

test('demo script is a deterministic 2 to 4 minute loop of fictional ids', () => {
  assert.ok(DEMO_LOOP_MS >= 120_000 && DEMO_LOOP_MS <= 240_000);
  assert.equal(DEMO_SCRIPT[0].atMs, 0);
  assert.ok(DEMO_SCRIPT[DEMO_SCRIPT.length - 1].atMs < DEMO_LOOP_MS);
  for (const card of DEMO_CARDS) {
    assert.match(card.id, /^DEMO-\d{3}$/);
  }
  const first = projectDemo(58_000);
  const second = projectDemo(58_000);
  assert.equal(first.step.id, 'pr-open');
  assert.deepEqual(
    first.cards.map((card) => [card.id, card.lane]),
    second.cards.map((card) => [card.id, card.lane]),
  );
  assert.equal(projectDemo(DEMO_LOOP_MS).step.id, 'start');
  assert.equal(projectDemo(16_000).cards.find((card) => card.id === 'DEMO-002')?.lane, 'ready');
  assert.equal(projectDemo(30_000).cards.find((card) => card.id === 'DEMO-002')?.lane, 'building');
  assert.equal(projectDemo(82_000).cards.find((card) => card.id === 'DEMO-002')?.lane, 'building');
  assert.match(projectDemo(82_000).cards.find((card) => card.id === 'DEMO-002')?.blocker ?? '', /Synthetic QA fail/);
  assert.equal(projectDemo(124_000).cards.find((card) => card.id === 'DEMO-002')?.lane, 'validation');
  assert.equal(projectDemo(170_000).cards.find((card) => card.id === 'DEMO-002')?.lane, 'release_ready');
  assert.equal(projectDemo(180_000).cards.find((card) => card.id === 'DEMO-002')?.lane, 'live');
  assert.equal(projectDemo(180_000).cards.find((card) => card.id === 'DEMO-001')?.lane, 'backlog');
  assert.equal(projectDemo(180_000).simulatedApproval, true);
  assert.match(projectDemo(136_000).cards.find((card) => card.id === 'DEMO-002')?.headSha ?? '', /DEMO-SHA-02/);
  assert.equal(stepsForCard('DEMO-003').some((step) => step.id === 'waiting-not-stalled'), true);
});

test('demo engine cannot mutate or accept snapshot cards', () => {
  assert.equal(engineSource.includes('fixtures/snapshot'), false);
  assert.equal(engineSource.includes('SNAPSHOT_CARDS'), false);
  const before = JSON.stringify(SNAPSHOT_CARDS);
  const demoBefore = JSON.stringify(DEMO_CARDS);
  const projected = projectDemo(180_000);
  projected.cards[0].lane = 'live';
  projected.cards[0].title = 'mutated';
  assert.equal(JSON.stringify(DEMO_CARDS), demoBefore);
  assert.throws(() => projectDemo(0, DEMO_SCRIPT, SNAPSHOT_CARDS), /refused a non-demo card/);
  assert.equal(JSON.stringify(SNAPSHOT_CARDS), before);
  assert.equal(SNAPSHOT_CARDS[0].lane, 'validation');
});

test('snapshot mode never uses a work or celebrate pose', () => {
  for (const state of ['building', 'reviewing', 'released', 'blocked', 'idle'] as const) {
    assert.equal(visualPose(state, 'snapshot'), 'idle');
    assert.equal(visualPose(state, 'live'), 'idle');
  }
  assert.equal(visualPose('building', 'demo'), 'work');
  assert.equal(visualPose('reviewing', 'demo'), 'review');
  assert.equal(visualPose('blocked', 'demo'), 'blocked');
  assert.equal(visualPose('released', 'demo'), 'celebrate');
  assert.equal(visualPose('waiting_approval', 'demo'), 'idle');
});
