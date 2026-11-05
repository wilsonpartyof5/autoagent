import { NextRequest, NextResponse } from 'next/server';

import { withMarketCheckContext } from '@/lib/marketcheck/context';
import { payloadContainsSecret } from '@/lib/marketcheck/secrets';
import { supabaseRooftopDirectory } from '@/lib/dealer/rooftop-store';
import { readRequestJson } from '@/lib/shopper/deal-actions';
import { shopperDealErrorResponse } from '@/lib/shopper/deals';
import { requireShopperAuth } from '@/lib/shopper/session';
import { publicShopperNetwork, resolveVdpCtas } from '@/lib/shopper/vdp-ctas';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/consumer/listings/network
 *
 * Shopper session required. Body: { "listingId": "mc-listing-1" }.
 * `listingUrl` is accepted and ignored. It is not dealer identity.
 *
 * `data.state` is exactly one of:
 * - `in_network`: MarketCheck returned dealer identity and it matches an onboarded rooftop.
 * - `off_network`: MarketCheck returned dealer identity and it matches none.
 * - `identity_unavailable`: MarketCheck errored, timed out, or did not find the listing.
 * - `unknown`: the listing was found without dealer identity, the request had no listing id,
 *   or the rooftop list could not be read.
 *
 * An identity failure is never `off_network`. `unknown` and `identity_unavailable`
 * have no CTAs and this route writes nothing. It does not submit an OTD request.
 * The body has no JWT, dealer URL, dealer id, or rooftop id.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireShopperAuth(request);
    const body = await readRequestJson(request);
    const directory = supabaseRooftopDirectory(createAdminClient());
    const lookupListingIdentity = directory.lookupListingIdentity;
    if (!lookupListingIdentity) {
      throw new Error('Network lookup is not configured.');
    }
    const data = await withMarketCheckContext(
      { origin: request.nextUrl.origin, subject: auth.userId },
      () => resolveVdpCtas(body, {
        listOnboardedRooftops: directory.listOnboardedRooftops,
        lookupListingIdentity,
      }),
    );
    const payload = { success: true, data: publicShopperNetwork(data) };
    if (payloadContainsSecret(payload)) {
      console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'listing_network' }));
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not resolve this listing.' } },
        { status: 500 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return shopperDealErrorResponse(error);
  }
}
