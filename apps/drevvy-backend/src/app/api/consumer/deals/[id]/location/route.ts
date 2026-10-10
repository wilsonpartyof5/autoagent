import { NextRequest, NextResponse } from 'next/server';

import { readRequestJson, setLocationAccess, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readLocationBody } from '@/lib/shopper/lifecycle';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * POST /api/consumer/deals/[id]/location
 *
 * Body: { granted: boolean }
 * The app reports whether background location was granted. The day-after
 * pickup prompt still sends when it was not.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const granted = readLocationBody(await readRequestJson(request));
    const deps = await shopperDeps(auth.userId);
    await setLocationAccess(auth.userId, id, granted, deps);
    return NextResponse.json({ success: true, data: { granted } });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
