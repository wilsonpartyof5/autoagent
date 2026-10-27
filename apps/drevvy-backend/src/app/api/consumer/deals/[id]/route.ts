import { NextRequest, NextResponse } from 'next/server';

import { getShopperCar, removeShopperCar, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * GET /api/consumer/deals/[id]
 * DELETE /api/consumer/deals/[id]
 *
 * Returns one deal owned by the signed-in shopper. Another shopper's deal
 * is not found. Dealer identity is not included. `visit` is included only
 * after the official offer is forwarded. Opening this deal loads MarketCheck
 * Price when `zip` is present (used or CPO, cached 24 hours). DELETE removes
 * the car from the shopper's list. It does not return a key, including a
 * cancel inside 30 minutes before outreach.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const deps = await shopperDeps(auth.userId);
    const data = await getShopperCar(auth.userId, id, deps, {
      zip: request.nextUrl.searchParams.get('zip') ?? undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const deps = await shopperDeps(auth.userId);
    const result = await removeShopperCar(auth.userId, id, deps);
    return NextResponse.json({
      success: true,
      data: { id: result.id, removedAt: result.removedAt },
      credits: result.credits,
    });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
