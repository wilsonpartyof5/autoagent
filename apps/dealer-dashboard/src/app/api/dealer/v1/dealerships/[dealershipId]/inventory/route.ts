import { NextResponse } from 'next/server';
import {
  dealerMobileErrorResponse,
  requireDealerMobileAuth,
} from '@/lib/dealer-mobile/auth';
import { requireDealershipAccess } from '@/lib/dealer-mobile/dealerships';
import { listMobileInventory } from '@/lib/dealer-mobile/inventory';
import { clampPageSize } from '@/lib/dealer-mobile/leads';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ dealershipId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const { dealershipId } = await context.params;
    const dealership = await requireDealershipAccess(auth, dealershipId);
    const searchParams = new URL(request.url).searchParams;
    const limit = clampPageSize(searchParams.get('limit'));
    const offset = Math.max(Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
    const items = await listMobileInventory(auth, dealership, { limit, offset });

    return NextResponse.json({
      items,
      pagination: {
        limit,
        offset,
        hasMore: items.length === limit,
      },
    });
  } catch (error) {
    return dealerMobileErrorResponse(error);
  }
}
