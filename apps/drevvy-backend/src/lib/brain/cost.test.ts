import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateCost, rateForModel } from './cost';

test('estimateCost uses the per-1M rate table, including cached input', () => {
  assert.equal(estimateCost(1_000_000, 1_000_000, 'gpt-6-astra', 0), 60);
  assert.equal(estimateCost(1_000_000, 0, 'gpt-6-astra', 1_000_000), 1);
  assert.equal(estimateCost(1_000_000, 1_000_000, 'gpt-6.1-sol', 0), 12);
  assert.equal(estimateCost(1_000_000, 0, 'gpt-6.1-sol', 500_000), 1.05);
  assert.equal(estimateCost(1_000_000, 1_000_000, 'gpt-6-luna'), 0.6);
  assert.equal(estimateCost(1_000_000, 1_000_000, 'grok-4.7', 0), 8);
  assert.equal(estimateCost(1_000_000, 0, 'grok-4.7', 1_000_000), 0.5);
  assert.equal(estimateCost(1000, 1000, 'gpt-4o'), 0.02);
  assert.equal(estimateCost(1000, 1000, 'gpt-4o-mini'), 0.00075);
  assert.equal(rateForModel('gpt-6-astra-2026-10-01').id, 'gpt-6-astra');
  assert.equal(rateForModel('gpt-4o-mini-2024').id, 'gpt-4o-mini');
  assert.equal(rateForModel('unknown-model').id, 'gpt-4o');
});
