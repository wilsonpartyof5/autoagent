import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_RESPONSE_MS, shouldRefundCredit, type QuotaEndState } from './quota';

test('NO_RESPONSE_MS is 5 days in milliseconds', () => {
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  assert.equal(NO_RESPONSE_MS, fiveDaysMs);
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

test('all QuotaEndState values are handled', () => {
  const allStates: QuotaEndState[] = ['open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'];
  for (const state of allStates) {
    const result = shouldRefundCredit(state);
    assert.equal(typeof result, 'boolean', `shouldRefundCredit should return boolean for ${state}`);
  }
});
