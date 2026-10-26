import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS,
  DEALER_CONVERSATION_NO_REPLY_REFUND_MS,
  KEY_SPEND_DEALER_CONVERSATION,
  KEY_SPEND_MARKET_INTELLIGENCE_SAVE,
  stubDealerConversationNoReplyRefund,
  stubDealerConversationSpend,
} from './key-spend';

test('key spends are two separate keys from the same balance', () => {
  assert.equal(KEY_SPEND_MARKET_INTELLIGENCE_SAVE, 1);
  assert.equal(KEY_SPEND_DEALER_CONVERSATION, 1);
  assert.equal(DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS, 7);
  assert.equal(DEALER_CONVERSATION_NO_REPLY_REFUND_MS, 7 * 24 * 60 * 60 * 1000);
});

test('dealer-conversation spend and 7-day refund stay stubbed', () => {
  const spend = stubDealerConversationSpend('deal-1');
  assert.equal(spend.wired, false);
  assert.equal(spend.kind, 'dealer_conversation');
  assert.equal(spend.amount, 1);
  assert.match(spend.reason, /do not call it twice/i);

  const refund = stubDealerConversationNoReplyRefund('deal-1');
  assert.equal(refund.wired, false);
  assert.equal(refund.amount, 1);
  assert.match(refund.reason, /7 days/);
});
