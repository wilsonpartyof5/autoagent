import { NextRequest } from 'next/server';

import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { postConsumerOtdRequest } from '@/lib/shopper/otd-http';

/**
 * POST /api/consumer/otd-requests
 *
 * Off-network CTA. Records that the shopper asked for this dealership's
 * out-the-door number. Not a chat thread and not Telnyx outreach. No key is spent.
 *
 * On created=true also writes analytics twin `drevvy_otd_requests` (hashed user)
 * and journey events `otd_request.submitted` + `cta.tapped` (outcome submitted_free).
 * Analytics failures are logged and do not fail this response.
 *
 * Body: { "listingId": "mc-listing-1", "listingUrl"? }
 * In-network listings receive 409 in_network.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    return await postConsumerOtdRequest(request);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
