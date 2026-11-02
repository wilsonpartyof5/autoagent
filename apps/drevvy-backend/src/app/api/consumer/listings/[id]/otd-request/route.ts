import { NextRequest } from 'next/server';

import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { postConsumerOtdRequest } from '@/lib/shopper/otd-http';

/**
 * POST /api/consumer/listings/:id/otd-request
 *
 * Alias for POST /api/consumer/otd-requests so the current iOS client
 * (`HttpKeySpendEndpoint.requestOtdNumber`) records the same app-table row,
 * analytics twin, and journey events. Canonical path remains /otd-requests.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await postConsumerOtdRequest(request, id);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
