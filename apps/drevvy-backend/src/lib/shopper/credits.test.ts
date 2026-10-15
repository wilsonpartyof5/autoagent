import assert from 'node:assert/strict';
import test from 'node:test';

import { CAR_PACKS } from './credits';
import { shouldRefundCredit, type QuotaEndState } from './quota';

test('car packs have correct pricing', () => {
  const packs = CAR_PACKS;
  assert.equal(packs.length, 3);

  const pack3 = packs.find((p) => p.size === 3);
  assert.ok(pack3);
  assert.equal(pack3.priceUsd, 47);

  const pack5 = packs.find((p) => p.size === 5);
  assert.ok(pack5);
  assert.equal(pack5.priceUsd, 67);

  const pack10 = packs.find((p) => p.size === 10);
  assert.ok(pack10);
  assert.equal(pack10.priceUsd, 97);
});

test('shouldRefundCredit returns true for slot-returning states', () => {
  assert.equal(shouldRefundCredit('sold'), true, 'sold should refund');
  assert.equal(shouldRefundCredit('ended_no_response'), true, 'ended_no_response should refund');
  assert.equal(shouldRefundCredit('dealer_declined'), true, 'dealer_declined should refund');
});

test('shouldRefundCredit returns false for non-refunding states', () => {
  assert.equal(shouldRefundCredit('open'), false, 'open should not refund');
  assert.equal(shouldRefundCredit('removed'), false, 'removed should not refund');
});

test('all QuotaEndState values are handled by shouldRefundCredit', () => {
  const allStates: QuotaEndState[] = ['open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'];
  for (const state of allStates) {
    const result = shouldRefundCredit(state);
    assert.equal(typeof result, 'boolean', `shouldRefundCredit should return boolean for ${state}`);
  }
});
