import { NextRequest, NextResponse } from 'next/server';

import { forwardOffer, readRequestJson, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readOfferBody } from '@/lib/shopper/lifecycle';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * POST /api/consumer/deals/[id]/offer-forwarded
 *
 * Called when the official offer is forwarded and the dealer is revealed.
 * Body: { latitude, longitude, radiusMeters?, expectedPickupDate?, locationGranted? }
 * Street address is not stored. Later deal reads include `visit` for the geofence.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const input = readOfferBody(await readRequestJson(request));
    const deps = await shopperDeps(auth.userId);
    const data = await forwardOffer(auth.userId, id, input, deps);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
