import { NextRequest, NextResponse } from 'next/server';

import { supabaseRooftopDirectory } from '@/lib/dealer/rooftop-store';
import { withListingCarLimits } from '@/lib/marketcheck/listing-car-limit';
import { discoverClientIp } from '@/lib/public-discover/client-ip';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import { supabaseOtdAnalytics } from '@/lib/shopper/otd-analytics';
import {
  otdRequestBodyFromHttp,
  requestOffNetworkOtd,
  supabaseOtdRequestRepository,
} from '@/lib/shopper/otd-request';
import { requireShopperAuth } from '@/lib/shopper/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function postConsumerOtdRequest(
  request: NextRequest,
  listingIdFromPath?: string,
): Promise<NextResponse> {
  const auth = await requireShopperAuth(request);
  const body = otdRequestBodyFromHttp(await readRequestJson(request), listingIdFromPath);
  const supabase = createAdminClient();
  const result = await withListingCarLimits(
    { ip: discoverClientIp(request.headers) },
    () => requestOffNetworkOtd(auth.userId, body, {
      now: new Date(),
      repo: supabaseOtdRequestRepository(supabase),
      rooftops: supabaseRooftopDirectory(supabase),
      analytics: supabaseOtdAnalytics(supabase),
    }),
  );
  return NextResponse.json({
    success: true,
    data: result.request,
    created: result.created,
  });
}
