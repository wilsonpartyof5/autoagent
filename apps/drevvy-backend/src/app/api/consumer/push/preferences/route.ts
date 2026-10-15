import { NextRequest, NextResponse } from 'next/server';

import { readRequestJson } from '@/lib/shopper/deal-actions';
import { requireShopperAuth } from '@/lib/shopper/session';
import { pushErrorResponse } from '@/lib/push/http';
import { getPushLedger } from '@/lib/push/ledger';
import { priceDropsEnabled, readPriceDropPreference } from '@/lib/push/triggers';

/**
 * GET /api/consumer/push/preferences
 * PATCH /api/consumer/push/preferences
 *
 * Price-drop pushes are on by default. PATCH body: { "priceDrops": false }
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const priceDrops = priceDropsEnabled(await getPushLedger().getPreference(auth.userId));
    return NextResponse.json({ success: true, data: { priceDrops } });
  } catch (error) {
    return pushErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const priceDrops = readPriceDropPreference(await readRequestJson(request));
    await getPushLedger().setPreference(auth.userId, priceDrops);
    return NextResponse.json({ success: true, data: { priceDrops } });
  } catch (error) {
    return pushErrorResponse(error);
  }
}
