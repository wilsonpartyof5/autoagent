import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEALER_CONVERSATION_CADENCE_FIRST_DAY,
  DEALER_CONVERSATION_CADENCE_LAST_DAY,
  DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS,
  DEALER_CONVERSATION_NO_REPLY_REFUND_MS,
  KEY_SPEND_DEALER_CONVERSATION,
  KEY_SPEND_MARKET_INTELLIGENCE_SAVE,
  stubDealerConversationEarlyRemovalNoRefund,
  stubDealerConversationNoReplyRefund,
  stubDealerConversationRefundJob,
  stubDealerConversationSoldRefund,
  stubDealerConversationSpend,
} from './key-spend';

test('key spends are two separate keys from the same balance', () => {
  assert.equal(KEY_SPEND_MARKET_INTELLIGENCE_SAVE, 1);
  assert.equal(KEY_SPEND_DEALER_CONVERSATION, 1);
  assert.equal(DEALER_CONVERSATION_CADENCE_FIRST_DAY, 0);
  assert.equal(DEALER_CONVERSATION_CADENCE_LAST_DAY, 7);
  assert.equal(DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS, 7);
  assert.equal(DEALER_CONVERSATION_NO_REPLY_REFUND_MS, 7 * 24 * 60 * 60 * 1000);
});

test('dealer-conversation refund jobs stay stubbed', () => {
  const spend = stubDealerConversationSpend('deal-1');
  assert.equal(spend.wired, false);
  assert.equal(spend.kind, 'dealer_conversation');
  assert.equal(spend.amount, 1);

  const quiet = stubDealerConversationNoReplyRefund('deal-1');
  assert.equal(quiet.wired, false);
  assert.equal(quiet.refundReason, 'no_reply_day_7');
  assert.equal(quiet.amount, 1);
  assert.match(quiet.reason, /Day 0–7|Day 7/);

  const sold = stubDealerConversationSoldRefund('deal-1');
  assert.equal(sold.wired, false);
  assert.equal(sold.refundReason, 'sold');
  assert.equal(sold.amount, 1);
  assert.match(sold.reason, /Do not refund the market/);

  const early = stubDealerConversationEarlyRemovalNoRefund('deal-1');
  assert.equal(early.wired, false);
  assert.equal(early.refundReason, 'early_removal_no_refund');
  assert.equal(early.amount, 0);
  assert.match(early.reason, /does not refund/);

  const job = stubDealerConversationRefundJob('no_reply_day_7', 'deal-1');
  assert.equal(job.wired, false);
});
