/**
 * Key credits system. Shoppers buy one-time key packs
 * (1/$4.99, 5/$19.99, 10/$34.99 recommended, 25/$74.99)
 * that never expire and never reset monthly.
 *
 * Product (2026-10-26): two spends from the same balance — market intelligence
 * + save (do not assume refundable), then a separate key to open dealer
 * conversation. Chat-key refunds (stubbed in key-spend.ts): no reply by Day 7
 * (cadence Day 0–7, same clock); sold. No chat-key refund on 30-minute cancel
 * before outreach.
 *
 * shouldRefundCredit still returns a credit only for dealer_declined. Do not
 * flip sold / ended_no_response / removed — that would refund the
 * undifferentiated credit. NO_RESPONSE_MS remains the existing 5-day deal-end
 * timer; the product cadence/refund clock is 7 days and is not wired yet.
 */

import {
  DEALER_CONVERSATION_NO_REPLY_REFUND_MS,
  stubDealerConversationNoReplyRefund,
} from './key-spend';

export const NO_RESPONSE_MS = 5 * 24 * 60 * 60 * 1000;

/** Product refund window for the dealer-conversation key. Not wired to lifecycle. */
export const DEALER_CHAT_NO_REPLY_REFUND_MS = DEALER_CONVERSATION_NO_REPLY_REFUND_MS;

export type QuotaEndState = 'open' | 'sold' | 'ended_no_response' | 'removed' | 'dealer_declined';

export type QuotaDeal = {
  id: string;
  addedAt: string;
  removedAt: string | null;
  outreachSentAt: string | null;
  endState: QuotaEndState;
  endedAt: string | null;
};

export function shouldRefundCredit(endState: QuotaEndState): endState is 'dealer_declined' {
  return endState === 'dealer_declined';
}

/**
 * STUB entry point for the 7-day dealer-conversation refund.
 * Does not refund. Callers must not treat this as a grant.
 */
export function stubRefundDealerConversationKeyOnNoReply(dealId: string) {
  return stubDealerConversationNoReplyRefund(dealId);
}
