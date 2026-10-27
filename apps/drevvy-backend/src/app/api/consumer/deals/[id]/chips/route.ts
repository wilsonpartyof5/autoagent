import { NextRequest, NextResponse } from 'next/server';

import { shopperDeps } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { suggestDealChips } from '@/lib/shopper/chips';
import { requireShopperAuth } from '@/lib/shopper/session';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET/POST /api/consumer/deals/[id]/chips
 *
 * In-network chip suggestions for one deal thread. Nothing is sent.
 * POST body may include `{ stage, messages, intel }`. Missing intel hides
 * a chip, except T3–T5, which use the spec fallback and never invent a price.
 */

export const dynamic = 'force-dynamic';

async function suggestions(request: NextRequest, dealId: string, body: unknown) {
  const auth = await requireShopperAuth(request);
  const deps = await shopperDeps(auth.userId);
  const supabase = deps.supabase ?? createAdminClient();
  const data = await suggestDealChips(auth.userId, dealId, body, {
    deals: deps.deals,
    supabase,
  });
  return NextResponse.json({ success: true, data });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await suggestions(request, id, {});
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return await suggestions(request, id, body);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
