import { NextRequest, NextResponse } from 'next/server';

import { applyAgentEvent, parseAgentEvent, readRequestJson, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readCronAuth } from '@/lib/shopper/lifecycle';

/**
 * POST /api/cron/deal-events
 *
 * Agent events that affect the car slot: outreach (email, text, or call),
 * a dealer reply, an end state of sold / ended_no_response / dealer_declined,
 * a listing price drop, or an offer that is ready.
 * Price-drop pushes stay on unless the body sets priceDrops to false.
 * Dealer identity in a price drop or offer is not copied into the push.
 * Requires Authorization: Bearer $DREVVY_CRON_SECRET. 404 when unset.
 * FCM is a no-op when Firebase credentials are unset.
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
    const event = parseAgentEvent(await readRequestJson(request), new Date());
    const deps = await shopperDeps(event.consumerUserId);
    const data = await applyAgentEvent(event, deps);
    return NextResponse.json({
      success: true,
      data: {
        dealId: data.dealId,
        endState: data.endState,
        outreachSentAt: data.outreachSentAt,
        repliedAt: data.repliedAt,
      },
    });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
