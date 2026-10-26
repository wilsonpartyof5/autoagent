/**
 * Shopper key-spend product rules (DECIDED 2026-10-26).
 *
 * Two spends from the same key balance:
 *   1. market intelligence + save — a separate key. Do not assume it is refundable.
 *   2. dealer conversation — a separate key.
 *
 * Dealer-conversation key refunds (chat key only):
 *   - No reply by Day 7: refund 1:1. Outreach cadence is Day 0–7 and shares
 *     this clock. Existing playbook touches still end at D5; Day 7 is the
 *     window/refund end (last-touch stub below).
 *   - Sold / no longer listed: refund the dealer-conversation key 1:1.
 *   - 30-minute cancel before outreach: do NOT refund the dealer-conversation
 *     key (it was not spent). Do not assume the market key is refundable.
 *
 * consume_credit_atomic / refund_credit_atomic are still one undifferentiated
 * credit per deal. Dual-spend and these chat-key refunds are not wired — see
 * the stubs. Do not invent a second consume on the same dealId, and do not
 * flip shouldRefundCredit for sold / ended_no_response / removed.
 */

export const KEY_SPEND_MARKET_INTELLIGENCE_SAVE = 1;
export const KEY_SPEND_DEALER_CONVERSATION = 1;

export const DEALER_CONVERSATION_CADENCE_FIRST_DAY = 0;
export const DEALER_CONVERSATION_CADENCE_LAST_DAY = 7;
export const DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS = DEALER_CONVERSATION_CADENCE_LAST_DAY;
export const DEALER_CONVERSATION_NO_REPLY_REFUND_MS =
  DEALER_CONVERSATION_NO_REPLY_REFUND_DAYS * 24 * 60 * 60 * 1000;

export type KeySpendKind = 'market_intelligence_save' | 'dealer_conversation';

export type DealerConversationRefundReason =
  | 'no_reply_day_7'
  | 'sold'
  | 'early_removal_no_refund';

export type KeySpendStub = {
  kind: KeySpendKind;
  amount: number;
  wired: false;
  reason: string;
  refundReason?: DealerConversationRefundReason;
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
  return stubDealerConversationRefundJob('no_reply_day_7', dealId);
}

/** STUB: sold / no longer listed refunds the chat key only. Not wired. */
export function stubDealerConversationSoldRefund(dealId: string): KeySpendStub {
  return stubDealerConversationRefundJob('sold', dealId);
}

/**
 * STUB: 30-minute cancel before outreach must not refund the chat key.
 * Market intel + save is a different key — do not assume it is refundable.
 */
export function stubDealerConversationEarlyRemovalNoRefund(dealId: string): KeySpendStub {
  return stubDealerConversationRefundJob('early_removal_no_refund', dealId);
}

/**
 * STUB refund job. Does not grant or reverse credits.
 * Wire later with dual-spend idempotency (chat vs market).
 */
export function stubDealerConversationRefundJob(
  refundReason: DealerConversationRefundReason,
  dealId: string,
): KeySpendStub {
  const amount = refundReason === 'early_removal_no_refund' ? 0 : KEY_SPEND_DEALER_CONVERSATION;
  return {
    kind: 'dealer_conversation',
    amount,
    wired: false,
    refundReason,
    reason: refundJobReason(refundReason, dealId),
  };
}

function refundJobReason(refundReason: DealerConversationRefundReason, dealId: string): string {
  switch (refundReason) {
    case 'no_reply_day_7':
      return (
        `STUB deal=${dealId}: refund the dealer-conversation key 1:1 after ` +
        `Day ${DEALER_CONVERSATION_CADENCE_LAST_DAY} with no dealer reply. ` +
        'Cadence window is Day 0–7 (same clock). refund_credit_atomic cannot target chat vs market yet.'
      );
    case 'sold':
      return (
        `STUB deal=${dealId}: sold / no longer listed refunds the dealer-conversation ` +
        'key 1:1. Do not refund the market intel + save key. Not wired.'
      );
    case 'early_removal_no_refund':
      return (
        `STUB deal=${dealId}: 30-minute cancel before outreach does not refund ` +
        'the dealer-conversation key. Do not assume the market key is refundable.'
      );
  }
}
