import { NextResponse } from 'next/server';

import { dealerMobileErrorResponse, requireDealerMobileAuth } from '@/lib/dealer-mobile/auth';
import { requireDealershipAccess } from '@/lib/dealer-mobile/dealerships';
import { listDealerNegotiations, NegotiationError } from '@/lib/negotiation/cases';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ dealershipId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const { dealershipId } = await context.params;
    const dealership = await requireDealershipAccess(auth, dealershipId);
    const items = await listDealerNegotiations(dealership.id);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof NegotiationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return dealerMobileErrorResponse(error);
  }
}
