import { NextRequest, NextResponse } from 'next/server';

import { withMarketCheckContext } from '@/lib/marketcheck/context';
import { payloadContainsSecret } from '@/lib/marketcheck/secrets';
import { supabaseRooftopDirectory } from '@/lib/dealer/rooftop-store';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';
import { resolveVdpCtas } from '@/lib/shopper/vdp-ctas';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/consumer/listings/network
 *
 * Shopper session required. Resolves VDP CTAs from onboarded rooftops.
 * Body: { "listingId": "mc-listing-1", "listingUrl": "https://dealer.com/vdp/1" }
 *
 * In-network: market intel + dealer conversation.
 * Off-network: market intel + out-the-door number request. No conversation.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readRequestJson(request);
    const data = await withMarketCheckContext(
      { origin: request.nextUrl.origin, subject: auth.userId },
      () => resolveVdpCtas(body, supabaseRooftopDirectory(createAdminClient())),
    );
    const payload = {
      success: true,
      data: {
        network: data.network,
        match: data.match.matched
          ? {
            method: data.match.method,
            rooftopId: data.match.rooftop.id,
            channel: data.match.channel,
            shopperKnown: data.match.shopperKnown,
          }
          : null,
        ctas: data.ctas,
      },
    };
    if (payloadContainsSecret(payload)) {
      console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'listing_network' }));
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not resolve this listing.' } },
        { status: 500 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
