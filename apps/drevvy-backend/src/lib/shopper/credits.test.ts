import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dealerConversationIdempotencyKey,
  dealerConversationRefundKey,
  KEY_PACKS,
  marketSaveIdempotencyKey,
  usdToCents,
} from './credits';
import { shouldRefundCredit, type QuotaEndState } from './quota';

test('key packs are 1, 5, 10, and 25 at the published prices', () => {
  const packs = KEY_PACKS;
  assert.deepEqual(packs.map((pack) => [pack.size, pack.priceUsd, pack.recommended]), [
    [1, 4.99, false],
    [5, 19.99, false],
    [10, 34.99, true],
    [25, 74.99, false],
  ]);
  assert.deepEqual(packs.map((pack) => usdToCents(pack.priceUsd)), [499, 1999, 3499, 7499]);
  assert.equal(marketSaveIdempotencyKey('mc-listing-1'), 'use:market_save:mc-listing-1');
  assert.equal(dealerConversationIdempotencyKey('deal-1'), 'use:dealer_conversation:deal-1');
  assert.equal(dealerConversationRefundKey('deal-1'), 'refund:deal-1');
});

test('shouldRefundCredit returns only the dealer-conversation key', () => {
  assert.equal(shouldRefundCredit('dealer_declined'), true, 'dealer decline should refund the dealer key');
  assert.equal(shouldRefundCredit('sold'), true, 'a sold car should refund the dealer key');
  assert.equal(shouldRefundCredit('ended_no_response'), true, 'day 7 with no reply should refund the dealer key');
  assert.equal(shouldRefundCredit('open'), false, 'open should not refund');
  assert.equal(shouldRefundCredit('removed'), false, 'removing a deal should not refund, including the 30 minute window');
});

test('all QuotaEndState values are handled by shouldRefundCredit', () => {
  const allStates: QuotaEndState[] = ['open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'];
  for (const state of allStates) {
    const result = shouldRefundCredit(state);
    assert.equal(typeof result, 'boolean', `shouldRefundCredit should return boolean for ${state}`);
  }
});
