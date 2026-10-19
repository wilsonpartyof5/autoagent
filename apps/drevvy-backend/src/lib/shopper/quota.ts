/**
 * Car credits system. Shoppers buy one-time car packs (1/$35, 3/$55, 5/$75, 10/$95)
 * that never expire and never reset monthly. A credit returns only when the
 * shopper removes the deal within 30 minutes of adding it and before any
 * outreach, or when the dealer declines or opts out. Buying the car does not
 * return a credit, and neither does ending with no dealer response.
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

export function shouldRefundCredit(endState: QuotaEndState): endState is 'dealer_declined' {
  return endState === 'dealer_declined';
}
