import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_RESPONSE_MS, shouldRefundCredit, type QuotaEndState } from './quota';

test('NO_RESPONSE_MS is 7 days in milliseconds', () => {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  assert.equal(NO_RESPONSE_MS, sevenDaysMs);
});

test('shouldRefundCredit returns the dealer-conversation key for sold, no reply, and decline', () => {
  assert.equal(shouldRefundCredit('dealer_declined'), true, 'dealer decline should refund the dealer key');
  assert.equal(shouldRefundCredit('sold'), true, 'a sold car should refund the dealer key');
  assert.equal(shouldRefundCredit('ended_no_response'), true, 'day 7 with no reply should refund the dealer key');
  assert.equal(shouldRefundCredit('open'), false, 'open should not refund');
  assert.equal(shouldRefundCredit('removed'), false, 'removing a deal should not refund');
});

test('all QuotaEndState values are handled', () => {
  const allStates: QuotaEndState[] = ['open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'];
  for (const state of allStates) {
    const result = shouldRefundCredit(state);
    assert.equal(typeof result, 'boolean', `shouldRefundCredit should return boolean for ${state}`);
  }
});
