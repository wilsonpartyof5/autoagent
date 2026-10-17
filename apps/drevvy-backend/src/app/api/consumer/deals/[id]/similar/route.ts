import { NextRequest, NextResponse } from 'next/server';

import { withMarketCheckContext } from '@/lib/marketcheck/context';
import { payloadContainsSecret } from '@/lib/marketcheck/secrets';
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
    const data = await withMarketCheckContext(
      { origin: request.nextUrl.origin, subject: auth.userId },
      () => similarForDeal(auth.userId, id, deps),
    );
    const payload = { success: true, data };
    if (payloadContainsSecret(payload)) {
      console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'similar' }));
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not load similar cars.' } },
        { status: 500 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
