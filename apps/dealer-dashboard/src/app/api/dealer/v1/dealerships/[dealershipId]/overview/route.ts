import { NextResponse } from 'next/server';
import {
  dealerMobileErrorResponse,
  requireDealerMobileAuth,
} from '@/lib/dealer-mobile/auth';
import { requireDealershipAccess } from '@/lib/dealer-mobile/dealerships';
import { mobileDashboardSnapshot } from '@/lib/dealer-mobile/overview';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ dealershipId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const { dealershipId } = await context.params;
    const dealership = await requireDealershipAccess(auth, dealershipId);
    const snapshot = await mobileDashboardSnapshot(auth, dealership);
    return NextResponse.json(snapshot);
  } catch (error) {
    return dealerMobileErrorResponse(error);
  }
}
