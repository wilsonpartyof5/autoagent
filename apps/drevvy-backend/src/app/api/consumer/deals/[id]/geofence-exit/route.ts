import { NextRequest, NextResponse } from 'next/server';

import { exitGeofence, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * POST /api/consumer/deals/[id]/geofence-exit
 *
 * The app calls this when the shopper leaves the dealer geofence.
 * Records one "Did you buy it?" prompt per deal.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const deps = await shopperDeps(auth.userId);
    const data = await exitGeofence(auth.userId, id, deps);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
