import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEALER_CHAT_NO_REPLY_REFUND_MS,
  NO_RESPONSE_MS,
  stubRefundDealerConversationKeyOnNoReply,
  shouldRefundCredit,
  type QuotaEndState,
} from './quota';
import { stubDealerConversationSoldRefund } from './key-spend';

test('NO_RESPONSE_MS is 5 days in milliseconds', () => {
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  assert.equal(NO_RESPONSE_MS, fiveDaysMs);
});

test('shouldRefundCredit returns a credit only for a dealer decline', () => {
  assert.equal(shouldRefundCredit('dealer_declined'), true, 'dealer decline should refund');
  assert.equal(shouldRefundCredit('sold'), false, 'buying the car should not refund');
  assert.equal(shouldRefundCredit('ended_no_response'), false, 'no response should not refund');
  assert.equal(shouldRefundCredit('open'), false, 'open should not refund');
  assert.equal(shouldRefundCredit('removed'), false, 'removed is refunded only inside the early window');
});

test('7-day dealer-chat refund is stubbed and does not refund ended_no_response or sold', () => {
  assert.equal(DEALER_CHAT_NO_REPLY_REFUND_MS, 7 * 24 * 60 * 60 * 1000);
  const stub = stubRefundDealerConversationKeyOnNoReply('deal-quiet');
  assert.equal(stub.wired, false);
  assert.equal(stub.amount, 1);
  assert.equal(shouldRefundCredit('ended_no_response'), false);
  assert.equal(shouldRefundCredit('sold'), false);
  const sold = stubDealerConversationSoldRefund('deal-sold');
  assert.equal(sold.wired, false);
  assert.equal(sold.refundReason, 'sold');
});

test('all QuotaEndState values are handled', () => {
  const allStates: QuotaEndState[] = ['open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'];
  for (const state of allStates) {
    const result = shouldRefundCredit(state);
    assert.equal(typeof result, 'boolean', `shouldRefundCredit should return boolean for ${state}`);
  }
});
