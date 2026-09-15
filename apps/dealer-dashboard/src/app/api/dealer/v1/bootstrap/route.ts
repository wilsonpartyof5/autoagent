import { NextResponse } from 'next/server';
import {
  dealerMobileErrorResponse,
  requireDealerMobileAuth,
} from '@/lib/dealer-mobile/auth';
import {
  activeDealershipID,
  listAuthorizedDealerships,
  mobileDealerships,
} from '@/lib/dealer-mobile/dealerships';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireDealerMobileAuth(request);
    const authorized = await listAuthorizedDealerships(auth);
    const [dealerships, activeID] = await Promise.all([
      mobileDealerships(auth, authorized),
      activeDealershipID(auth),
    ]);

    return NextResponse.json({
      dealerships,
      activeDealershipID:
        activeID && dealerships.some((dealership) => dealership.id === activeID)
          ? activeID
          : dealerships[0]?.id ?? null,
    });
  } catch (error) {
    return dealerMobileErrorResponse(error);
  }
}
