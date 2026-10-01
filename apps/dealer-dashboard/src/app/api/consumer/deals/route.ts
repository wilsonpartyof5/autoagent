import { NextRequest, NextResponse } from 'next/server';

import { createShopperDeal, listShopperDeals, readCreateDealInput, shopperDealErrorResponse } from '@/lib/shopper/deals';
import { supabaseShopperDealRepository } from '@/lib/shopper/deal-store';
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
 * or street address.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const data = await listShopperDeals(supabaseShopperDealRepository(), auth.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readJson(request);
    const input = readCreateDealInput(body);
    const data = await createShopperDeal(supabaseShopperDealRepository(), {
      consumerUserId: auth.userId,
      listingId: input.listingId,
      vehicle: input.vehicle,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
