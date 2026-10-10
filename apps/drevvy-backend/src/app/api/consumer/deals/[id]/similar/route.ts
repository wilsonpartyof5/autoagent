import { NextRequest, NextResponse } from 'next/server';

import { shopperDeps, similarForDeal } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * GET /api/consumer/deals/[id]/similar
 *
 * Sold and no-response deals only. Listings match year, make, model, trim,
 * a price band, and a radius around the original car. Dealer identity is omitted.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const deps = await shopperDeps(auth.userId);
    const data = await similarForDeal(auth.userId, id, deps);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
