import { NextRequest, NextResponse } from 'next/server';

import { readRevealedDealerName } from '@/lib/push/triggers';
import { forwardOffer, readRequestJson, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readOfferBody } from '@/lib/shopper/lifecycle';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * POST /api/consumer/deals/[id]/offer-forwarded
 *
 * Called when the official offer is forwarded and the dealer is revealed.
 * The first forward sends the official_offer push. A dealer name in the body
 * is used only in that push. It is not stored, and deal reads stay free of it.
 * FCM is a no-op when Firebase credentials are unset.
 * Body: { latitude, longitude, radiusMeters?, expectedPickupDate?, locationGranted?, dealerName? }
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
    const body = await readRequestJson(request);
    const input = readOfferBody(body);
    const deps = await shopperDeps(auth.userId);
    const data = await forwardOffer(auth.userId, id, input, deps, readRevealedDealerName(body));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
