import assert from 'node:assert/strict';
import test from 'node:test';

import { CAR_PACKS } from './credits';
import { shouldRefundCredit, type QuotaEndState } from './quota';

test('car packs have correct pricing', () => {
  const packs = CAR_PACKS;
  assert.equal(packs.length, 4);

  const pack1 = packs.find((p) => p.size === 1);
  assert.ok(pack1);
  assert.equal(pack1.priceUsd, 35);

  const pack3 = packs.find((p) => p.size === 3);
  assert.ok(pack3);
  assert.equal(pack3.priceUsd, 55);

  const pack5 = packs.find((p) => p.size === 5);
  assert.ok(pack5);
  assert.equal(pack5.priceUsd, 75);

  const pack10 = packs.find((p) => p.size === 10);
  assert.ok(pack10);
  assert.equal(pack10.priceUsd, 95);
});

test('shouldRefundCredit returns a credit only for a dealer decline', () => {
  assert.equal(shouldRefundCredit('dealer_declined'), true, 'dealer decline should refund');
  assert.equal(shouldRefundCredit('sold'), false, 'buying the car should not refund');
  assert.equal(shouldRefundCredit('ended_no_response'), false, 'no response should not refund');
  assert.equal(shouldRefundCredit('open'), false, 'open should not refund');
  assert.equal(shouldRefundCredit('removed'), false, 'removed is refunded only inside the early window');
});

test('all QuotaEndState values are handled by shouldRefundCredit', () => {
  const allStates: QuotaEndState[] = ['open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'];
  for (const state of allStates) {
    const result = shouldRefundCredit(state);
    assert.equal(typeof result, 'boolean', `shouldRefundCredit should return boolean for ${state}`);
  }
});
