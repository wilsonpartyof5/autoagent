import { NextRequest, NextResponse } from 'next/server';

import { applyAgentEvent, parseAgentEvent, readRequestJson } from '@/lib/shopper/deal-actions';
import { supabaseShopperDealRepository } from '@/lib/shopper/deal-store';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readCronAuth } from '@/lib/shopper/lifecycle';
import { getLifecycleRepository } from '@/lib/shopper/lifecycle-store';

/**
 * POST /api/cron/deal-events
 *
 * Agent events that affect the car slot: outreach (email, text, or call),
 * a dealer reply, or an end state of sold / ended_no_response.
 * Requires Authorization: Bearer $DREVVY_CRON_SECRET. 404 when unset.
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
    const data = await applyAgentEvent(event, {
      deals: supabaseShopperDealRepository(),
      lifecycle: getLifecycleRepository(),
    });
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
