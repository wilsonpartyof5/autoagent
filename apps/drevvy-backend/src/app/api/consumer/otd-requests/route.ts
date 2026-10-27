import { NextRequest, NextResponse } from 'next/server';

import { supabaseRooftopDirectory } from '@/lib/dealer/rooftop-store';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requestOffNetworkOtd, supabaseOtdRequestRepository } from '@/lib/shopper/otd-request';
import { requireShopperAuth } from '@/lib/shopper/session';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/consumer/otd-requests
 *
 * Off-network CTA. Records that the shopper asked for this dealership's
 * out-the-door number. Not a chat thread and not Telnyx outreach. No key is spent.
 *
 * Body: { "listingId": "mc-listing-1", "listingUrl"? }
 * In-network listings receive 409 in_network.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readRequestJson(request);
    const supabase = createAdminClient();
    const result = await requestOffNetworkOtd(auth.userId, body, {
      now: new Date(),
      repo: supabaseOtdRequestRepository(supabase),
      rooftops: supabaseRooftopDirectory(supabase),
    });
    return NextResponse.json({
      success: true,
      data: result.request,
      created: result.created,
    });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
