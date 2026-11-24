import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { shopperDealErrorResponse, ShopperDealError, isShopperListingId } from '@/lib/shopper/deals';
import { presentMarketIntel } from '@/lib/shopper/market-intel';
import { findMarketUnlock, isMissingMarketSchema, type StoredMarketUnlock } from '@/lib/shopper/market-unlock-store';
import { requireShopperAuth, type ShopperSession } from '@/lib/shopper/session';

/**
 * GET /api/consumer/listings/:id/market-intel
 *
 * Shopper JWT. Owner-only read of a Marketplace Intelligence unlock.
 * A missing row is unlocked:false, including a listing another shopper unlocked.
 * The market object is the stored snapshot. v1 lines are on market.v1 when
 * this unlock was computed by market-intel v1.
 * This is not the heart-save list. It does not spend a key.
 */

export const dynamic = 'force-dynamic';

export type MarketIntelFinder = (userId: string, listingId: string) => Promise<StoredMarketUnlock | null>;

export function marketIntelReadBody(listingId: string, row: StoredMarketUnlock | null) {
  if (!isShopperListingId(listingId)) {
    throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
  }
  const market = row ? presentMarketIntel(row.market) : null;
  return {
    success: true as const,
    data: {
      listingId,
      unlocked: Boolean(row && market),
      unlockedAt: row && market ? row.unlockedAt : null,
      market,
    },
  };
}

export async function handleMarketIntelGet(
  request: Request,
  listingId: string,
  deps: {
    auth?: (request: Request) => Promise<ShopperSession>;
    find?: MarketIntelFinder;
  } = {},
): Promise<NextResponse> {
  try {
    if (!isShopperListingId(listingId)) {
      throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
    }
    const auth = await (deps.auth ?? requireShopperAuth)(request);
    const find = deps.find ?? ((userId, id) => findMarketUnlock(createAdminClient(), userId, id));
    let row: StoredMarketUnlock | null = null;
    try {
      row = await find(auth.userId, listingId);
    } catch (error) {
      if (!isMissingMarketSchema(error)) throw error;
    }
    return NextResponse.json(marketIntelReadBody(listingId, row));
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleMarketIntelGet(request, id);
}
