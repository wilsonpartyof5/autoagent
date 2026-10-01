import { NextRequest, NextResponse } from 'next/server';

import { getShopperDeal, shopperDealErrorResponse } from '@/lib/shopper/deals';
import { supabaseShopperDealRepository } from '@/lib/shopper/deal-store';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * GET /api/consumer/deals/[id]
 *
 * Returns one deal owned by the signed-in shopper. Another shopper's deal
 * is not found. Dealer identity is not included.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const data = await getShopperDeal(supabaseShopperDealRepository(), auth.userId, id);
    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: 'not_found', message: 'Deal not found.' } },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
