import { NextRequest, NextResponse } from 'next/server';

import { addShopperCar, listShopperCars, readRequestJson, shopperDeps } from '@/lib/shopper/deal-actions';
import { readCreateDealInput, shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * GET /api/consumer/deals
 * POST /api/consumer/deals
 *
 * Shopper session required. The shared inventory key is rejected.
 *
 * Create body:
 * {
 *   "listingId": "mc-listing-1",
 *   "vehicle": { "year": 2024, "make": "Chevrolet", "model": "Tahoe", "price": 52900 }
 * }
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
    return NextResponse.json({ success: true, data: result.deals, quota: result.quota });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readRequestJson(request);
    const input = readCreateDealInput(body);
    const deps = await shopperDeps(auth.userId);
    const result = await addShopperCar(auth.userId, input, deps);
    return NextResponse.json({ success: true, data: result.deal, quota: result.quota });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
