import { NextRequest, NextResponse } from 'next/server';

import { withMarketCheckContext } from '@/lib/marketcheck/context';
import { getVehicleDetailMcp } from '@/lib/marketcheck/mcp-adapter';
import { payloadContainsSecret } from '@/lib/marketcheck/secrets';
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
 * A heart save does not spend a key. Market details plus save is
 * POST /api/consumer/keys/market-save.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const data = await withMarketCheckContext(
      { origin: request.nextUrl.origin, subject: auth.userId },
      () => listSavedCars(auth.userId, deps()),
    );
    const payload = { success: true, data };
    if (payloadContainsSecret(payload)) {
      console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'saved_cars' }));
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not load saved cars.' } },
        { status: 500 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readRequestJson(request);
    const data = await withMarketCheckContext(
      { origin: request.nextUrl.origin, subject: auth.userId },
      () => saveSavedCar(auth.userId, body, deps()),
    );
    const payload = { success: true, data };
    if (payloadContainsSecret(payload)) {
      console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'saved_cars' }));
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

function deps() {
  return {
    repo: supabaseSavedCarRepository(),
    ownsDeal: shopperOwnsDeal,
    lookup: liveLookup,
    now: new Date(),
  };
}

const liveLookup: ListingLookup = async (listingId, vin) => getVehicleDetailMcp(listingId, vin ?? undefined);
