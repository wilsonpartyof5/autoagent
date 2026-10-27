import { NextRequest, NextResponse } from 'next/server';

import { supabaseRooftopDirectory } from '@/lib/dealer/rooftop-store';
import { startDealerConversation } from '@/lib/shopper/conversation';
import { listShopperCars, readRequestJson, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/consumer/deals
 * POST /api/consumer/deals
 *
 * Shopper session required. The shared inventory key is rejected.
 *
 * Create body:
 * {
 *   "listingId": "mc-listing-1",
 *   "vehicle": { "year": 2024, "make": "Chevrolet", "model": "Tahoe", "price": 52900 },
 *   "zip": "29730"
 * }
 *
 * Creating a deal spends a dealer-conversation key only when the listing matches
 * an onboarded rooftop. Off-network listings return 409 off_network — use
 * POST /api/consumer/otd-requests. Market details and save are a separate key.
 * `zip` is used for MarketCheck Price and is not stored. Listing deals does not
 * load fair price.
 *
 * Deal JSON includes listing id, status, outreachLockedUntilPaid, and the
 * vehicle snapshot. It does not include dealer name, phone, email, website,
 * or street address. `quota` is the billing-period car count beside `data`.
 * `visit` is present only after the official offer is forwarded.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const deps = await shopperDeps(auth.userId);
    const result = await listShopperCars(auth.userId, deps);
    return NextResponse.json({ success: true, data: result.deals, credits: result.credits });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

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
      },
    });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
