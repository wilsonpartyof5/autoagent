import { NextRequest, NextResponse } from 'next/server';

import { PHOTO_CACHE_CONTROL, proxyMarketCheckPhoto } from '@/lib/marketcheck/photos';

/**
 * GET /api/inventory/photo?u=&e=&s=
 *
 * Serves a MarketCheck-hosted photo. The signed query identifies an
 * allowlisted MarketCheck host; the API key is added on the server. Dealer
 * CDNs and any other host are rejected. This is not an open proxy.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = await proxyMarketCheckPhoto({
    payload: request.nextUrl.searchParams.get('u'),
    exp: request.nextUrl.searchParams.get('e'),
    sig: request.nextUrl.searchParams.get('s'),
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: result.code, message: result.message } },
      { status: result.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return new NextResponse(Buffer.from(result.body), {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': result.cacheControl || PHOTO_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
