import { NextRequest, NextResponse } from 'next/server';

import { readRequestJson } from '@/lib/shopper/deal-actions';
import { requireShopperAuth } from '@/lib/shopper/session';
import { deliverShopperPushLive } from '@/lib/push/dispatch';
import { readDemoPush } from '@/lib/push/events';
import { pushErrorResponse } from '@/lib/push/http';

/**
 * POST /api/consumer/push/demo
 *
 * Sends one test event to the signed-in shopper's devices.
 * Body: { "event": "price_drop" | "offer_ready" | "car_sold" | "official_offer" | "did_you_buy" }
 * Copy is fixed. When FCM env vars are unset, delivery is a no-op.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const input = readDemoPush(await readRequestJson(request));
    const data = await deliverShopperPushLive({
      event: input.event,
      userId: auth.userId,
      listingId: input.listingId,
      dealId: input.dealId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return pushErrorResponse(error);
  }
}
