import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { shopperDealErrorResponse, ShopperDealError, isShopperListingId } from '@/lib/shopper/deals';
import { presentMarketIntel } from '@/lib/shopper/market-intel';
import { findMarketUnlock, isMissingMarketSchema, type StoredMarketUnlock } from '@/lib/shopper/market-unlock-store';
import { requireShopperAuth, type ShopperSession } from '@/lib/shopper/session';

/**
 * Owner-only read of a stored fair-price unlock.
 * A missing row is unlocked:false. This call does not spend a key.
 * v1 lines are on market.v1 when this unlock was computed by market-intel v1.
 */

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
