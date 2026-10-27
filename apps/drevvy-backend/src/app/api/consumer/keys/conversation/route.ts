import { NextRequest, NextResponse } from 'next/server';

import { supabaseRooftopDirectory } from '@/lib/dealer/rooftop-store';
import { startDealerConversation } from '@/lib/shopper/conversation';
import { readRequestJson, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/consumer/keys/conversation
 *
 * Spends the dealer-conversation key and starts in-app chat with a salesperson
 * only when the listing matches an onboarded rooftop. Off-network listings
 * receive 409 off_network — use POST /api/consumer/otd-requests instead.
 *
 * Body: { "listingId": "mc-listing-1", "vehicle": { "year", "make", "model", "price" }, "listingUrl"?, "zip"? }
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readRequestJson(request);
    const deps = await shopperDeps(auth.userId);
    const supabase = deps.supabase ?? createAdminClient();
    const result = await startDealerConversation(auth.userId, body, {
      ...deps,
      supabase,
      rooftops: supabaseRooftopDirectory(supabase),
    });
    return NextResponse.json({
      success: true,
      data: result.deal,
      credits: result.credits,
      match: {
        network: result.match.network,
        method: result.match.method,
        rooftopId: result.match.rooftop.id,
        channel: result.match.channel,
        shopperFirstName: result.shopperFirstName,
        opener: result.match.opener,
      },
    });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
