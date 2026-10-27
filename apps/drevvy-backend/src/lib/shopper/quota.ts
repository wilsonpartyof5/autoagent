/**
 * Dealer-conversation key refunds. Day 7 with no reply, a sold listing, and a
 * dealer decline or opt-out each return that one key. Removing a deal does not,
 * including a cancel inside 30 minutes before outreach. The market+save key
 * is never refunded from an end state.
 */

export const NO_RESPONSE_MS = 7 * 24 * 60 * 60 * 1000;

export type QuotaEndState = 'open' | 'sold' | 'ended_no_response' | 'removed' | 'dealer_declined';

export type QuotaDeal = {
  id: string;
  addedAt: string;
  removedAt: string | null;
  outreachSentAt: string | null;
  endState: QuotaEndState;
  endedAt: string | null;
};

export function shouldRefundCredit(
  endState: QuotaEndState,
): endState is 'sold' | 'ended_no_response' | 'dealer_declined' {
  return endState === 'sold' || endState === 'ended_no_response' || endState === 'dealer_declined';
}
