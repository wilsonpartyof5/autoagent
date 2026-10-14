import { NextRequest, NextResponse } from 'next/server';

import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { shopperOwnsDeal, supabaseSavedCarRepository } from '@/lib/shopper/saved-car-store';
import { deleteSavedCar } from '@/lib/shopper/saved-cars';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * DELETE /api/consumer/saved-cars/[listingId]
 *
 * Removes the shopper's saved row. Listing details are not stored, so nothing
 * else is deleted.
 */

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { listingId } = await params;
    const data = await deleteSavedCar(auth.userId, listingId, {
      repo: supabaseSavedCarRepository(),
      ownsDeal: shopperOwnsDeal,
      lookup: async () => null,
      now: new Date(),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
