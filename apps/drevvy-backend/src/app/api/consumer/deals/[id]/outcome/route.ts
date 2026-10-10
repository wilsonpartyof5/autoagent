import { NextRequest, NextResponse } from 'next/server';

import { answerOutcome, readRequestJson, shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { readOutcomeBody } from '@/lib/shopper/lifecycle';
import { requireShopperAuth } from '@/lib/shopper/session';

/**
 * POST /api/consumer/deals/[id]/outcome
 *
 * Body: { bought: boolean, finalPrice?: number }
 * finalPrice is required when bought is true. One answer is stored per deal.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireShopperAuth(request);
    const { id } = await params;
    const input = readOutcomeBody(await readRequestJson(request));
    const deps = await shopperDeps(auth.userId);
    const result = await answerOutcome(auth.userId, id, input, deps);
    return NextResponse.json({ success: true, data: result.outcome, deal: result.deal });
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
