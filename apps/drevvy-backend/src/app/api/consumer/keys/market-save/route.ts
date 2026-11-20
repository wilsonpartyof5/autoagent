import { NextRequest, NextResponse } from 'next/server';

import { withMarketCheckContext } from '@/lib/marketcheck/context';
import { getVehicleDetailMcp } from '@/lib/marketcheck/mcp-adapter';
import { payloadContainsSecret } from '@/lib/marketcheck/secrets';
import { createAdminClient } from '@/lib/supabase/admin';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { unlockMarketAndSave } from '@/lib/shopper/market-save';
import { shopperOwnsDeal, supabaseSavedCarRepository } from '@/lib/shopper/saved-car-store';
import type { ListingLookup } from '@/lib/shopper/saved-cars';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * POST /api/consumer/keys/market-save
 *
 * Shopper JWT. Computes Marketplace Intelligence from MarketCheck, then spends
 * one market+save key and stores the snapshot. The same listing does not spend
 * a second key. No key is spent when MarketCheck has no real value or the
 * lookup fails. A heart save on POST /api/consumer/saved-cars does not spend
 * a key and does not unlock this.
 *
 * Body: { "listingId": "mc-listing-1", "vin": "1GNSKCKD5RR123456" }
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readRequestJson(request);
    const data = await withMarketCheckContext(
      { origin: request.nextUrl.origin, subject: auth.userId },
      () => unlockMarketAndSave(auth.userId, body, {
        repo: supabaseSavedCarRepository(),
        ownsDeal: shopperOwnsDeal,
        lookup: liveLookup,
        now: new Date(),
        supabase: createAdminClient(),
      }),
    );
    const payload = {
      success: true,
      spent: data.spent,
      available: data.available,
      unlocked: data.unlocked,
      reason: data.reason,
      message: data.message,
      credits: data.credits,
      data: data.car,
      market: data.market,
    };
    if (payloadContainsSecret(payload)) {
      console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'market_save' }));
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not save this car.' } },
        { status: 500 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

const liveLookup: ListingLookup = async (listingId, vin) => getVehicleDetailMcp(listingId, vin ?? undefined);
