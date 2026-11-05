import { NextRequest } from 'next/server';

import { discoverOptionsResponse, handleDiscoverSearch } from '@/lib/public-discover';

/**
 * POST /api/public/discover/search
 *
 * Anonymous Discover listing search for the Flutter shopper app.
 * No API key. No shopper JWT. Rate-limited per IP and globally.
 * Contract: docs/discover-public-api.md
 */

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return discoverOptionsResponse();
}

export async function POST(request: NextRequest) {
  return handleDiscoverSearch(request, { origin: request.nextUrl.origin });
}
