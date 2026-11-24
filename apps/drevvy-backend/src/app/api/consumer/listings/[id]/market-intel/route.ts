import { NextRequest } from 'next/server';

import { handleMarketIntelGet } from '@/lib/shopper/market-intel-read';

/**
 * GET /api/consumer/listings/:id/market-intel
 *
 * Shopper JWT. Owner-only read of a stored fair-price unlock.
 * A missing row is unlocked:false, including a listing another shopper unlocked.
 * v1 lines are on market.v1. This call does not spend a key.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleMarketIntelGet(request, id);
}
