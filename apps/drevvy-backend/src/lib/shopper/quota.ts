/**
 * Car credits system. Shoppers buy one-time car packs (3/$47, 5/$67, 10/$97)
 * that never expire and never reset monthly. Every 'return the slot' path
 * (dealer_declined, ended_no_response, sold) refunds +1 car credit to the
 * shopper's balance, idempotently (exactly once per deal).
 */

export const NO_RESPONSE_MS = 5 * 24 * 60 * 60 * 1000;

export type QuotaEndState = 'open' | 'sold' | 'ended_no_response' | 'removed' | 'dealer_declined';

export type QuotaDeal = {
  id: string;
  addedAt: string;
  removedAt: string | null;
  outreachSentAt: string | null;
  endState: QuotaEndState;
  endedAt: string | null;
};

export function shouldRefundCredit(endState: QuotaEndState): boolean {
  return endState === 'sold' || endState === 'ended_no_response' || endState === 'dealer_declined';
}
