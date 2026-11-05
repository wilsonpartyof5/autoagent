import { NextRequest } from 'next/server';

import { discoverOptionsResponse, handleDiscoverListing } from '@/lib/public-discover';

/**
 * GET /api/public/discover/listings/[id]
 *
 * Anonymous Discover listing detail for the Flutter shopper app.
 * Listing shell only. No VIN decode, history, MarketCheck Price, MI, or save.
 * Contract: docs/discover-public-api.md
 */

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return discoverOptionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleDiscoverListing(request, id, { origin: request.nextUrl.origin });
}
