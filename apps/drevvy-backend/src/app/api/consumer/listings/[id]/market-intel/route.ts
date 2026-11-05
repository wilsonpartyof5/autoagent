import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { shopperDealErrorResponse, ShopperDealError, isShopperListingId } from '@/lib/shopper/deals';
import { presentMarketIntel } from '@/lib/shopper/market-intel';
import { findMarketUnlock } from '@/lib/shopper/market-unlock-store';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * GET /api/consumer/listings/:id/market-intel
 *
 * Shopper JWT. Owner-only read of a Marketplace Intelligence unlock.
 * A missing row is unlocked:false, including a listing another shopper unlocked.
 * This is not the heart-save list.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    if (!isShopperListingId(id)) {
      throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
    }
    const row = await findMarketUnlock(createAdminClient(), auth.userId, id);
    return NextResponse.json({
      success: true,
      data: {
        listingId: id,
        unlocked: Boolean(row),
        unlockedAt: row?.unlockedAt ?? null,
        market: row ? presentMarketIntel(row.market) : null,
      },
    });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
