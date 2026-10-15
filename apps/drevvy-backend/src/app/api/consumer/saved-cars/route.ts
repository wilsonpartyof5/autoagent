import { NextRequest, NextResponse } from 'next/server';

import { getVehicleDetailMcp } from '@/lib/marketcheck/mcp-adapter';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import { shopperOwnsDeal, supabaseSavedCarRepository } from '@/lib/shopper/saved-car-store';
import { listSavedCars, saveSavedCar, type ListingLookup } from '@/lib/shopper/saved-cars';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * GET /api/consumer/saved-cars
 * POST /api/consumer/saved-cars
 *
 * Shopper session required. The row stores listing id, VIN, saved time, and
 * an optional deal id. Price, photos, dealer, and specs are fetched live and
 * returned on `listing`. They are not written to saved_cars.
 *
 * Create body: { "listingId": "mc-listing-1", "vin": "1GNSKCKD5RR123456", "movedToDealId": null }
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const data = await listSavedCars(auth.userId, deps());
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const data = await saveSavedCar(auth.userId, await readRequestJson(request), deps());
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

function deps() {
  return {
    repo: supabaseSavedCarRepository(),
    ownsDeal: shopperOwnsDeal,
    lookup: liveLookup,
    now: new Date(),
  };
}

const liveLookup: ListingLookup = async (listingId, vin) => getVehicleDetailMcp(listingId, vin ?? undefined);
