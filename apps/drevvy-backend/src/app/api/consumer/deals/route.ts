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
 *   "vehicle": { "year": 2024, "make": "Chevrolet", "model": "Tahoe", "price": 52900 },
 *   "zip": "29730"
 * }
 *
 * Creating a deal is Unlock with agent. That is one of the two moments
 * MarketCheck Price may load. `zip` is used for that call and is not stored.
 * Listing the shopper's deals does not load fair price.
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
    const input = readCreateDealInput(body);
    const zip = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { zip?: unknown }).zip
      : undefined;
    const deps = await shopperDeps(auth.userId);
    const result = await addShopperCar(auth.userId, { ...input, zip }, deps);
    return NextResponse.json({ success: true, data: result.deal, credits: result.credits });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
