/**
 * Shopper key-spend product rules (DECIDED 2026-10-26).
 *
 * Two spends from the same key balance:
 *   1. market intelligence + save
 *   2. a separate key to open dealer conversation
 *
 * If the dealer does not reply within 7 days, refund the dealer-conversation
 * key 1:1. The market + save key is not refunded for silence.
 *
 * consume_credit_atomic / refund_credit_atomic are still one undifferentiated
 * credit per deal. Dual-spend and the 7-day chat refund are not wired — see
 * the stubs below. Do not invent a second consume on the same dealId (it would
 * no-op as already_consumed) and do not flip shouldRefundCredit('ended_no_response').
 */

export const KEY_SPEND_MARKET_INTELLIGENCE_SAVE = 1;
export const KEY_SPEND_DEALER_CONVERSATION = 1;
export const DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS = 7;
export const DEALER_CONVERSATION_NO_REPLY_REFUND_MS =
  DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS * 24 * 60 * 60 * 1000;

export type KeySpendKind = 'market_intelligence_save' | 'dealer_conversation';

export type KeySpendStub = {
  kind: KeySpendKind;
  amount: number;
  wired: false;
  reason: string;
};

/** STUB: second consume is not wired. Ledger can charge one credit per deal. */
export function stubDealerConversationSpend(dealId: string): KeySpendStub {
  return {
    kind: 'dealer_conversation',
    amount: KEY_SPEND_DEALER_CONVERSATION,
    wired: false,
    reason:
      `STUB deal=${dealId}: dealer-conversation key is a separate spend. ` +
      'consume_credit_atomic is 1 credit per deal; do not call it twice.',
  };
}

/** STUB: 7-day no-reply refund of the chat key only. Not wired. */
export function stubDealerConversationNoReplyRefund(dealId: string): KeySpendStub {
  return {
    kind: 'dealer_conversation',
    amount: KEY_SPEND_DEALER_CONVERSATION,
    wired: false,
    reason:
      `STUB deal=${dealId}: refund the dealer-conversation key 1:1 after ` +
      `${DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS} days with no dealer reply. ` +
      'refund_credit_atomic cannot target chat vs market yet.',
  };
}
