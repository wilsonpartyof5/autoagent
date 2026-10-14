import { NextRequest, NextResponse } from 'next/server';

import { readRequestJson } from '@/lib/shopper/deal-actions';
import { readCronAuth } from '@/lib/shopper/lifecycle';
import { deliverShopperPushLive } from '@/lib/push/dispatch';
import { readCronPush } from '@/lib/push/events';
import { pushErrorResponse } from '@/lib/push/http';

/**
 * POST /api/cron/push-events
 *
 * Event trigger for price_drop, offer_ready, car_sold, official_offer, and
 * did_you_buy. Requires Authorization: Bearer $DREVVY_CRON_SECRET.
 * Responds 404 when that secret is unset. FCM is a no-op when unset.
 * did_you_buy is also sent by the daily lifecycle schedule, the day after
 * the expected pickup.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = readCronAuth(request.headers.get('authorization'), process.env.DREVVY_CRON_SECRET);
  if (auth === 'unconfigured') return new NextResponse(null, { status: 404 });
  if (auth === 'rejected') {
    return NextResponse.json(
      { success: false, error: { code: 'unauthorized', message: 'Unauthorized.' } },
      { status: 401 },
    );
  }
  try {
    const push = readCronPush(await readRequestJson(request));
    const data = await deliverShopperPushLive(push);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return pushErrorResponse(error);
  }
}
