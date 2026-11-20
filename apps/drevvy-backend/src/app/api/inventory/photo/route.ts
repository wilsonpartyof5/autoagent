import { NextRequest } from 'next/server';

import { handleInventoryPhoto } from '@/lib/marketcheck/photos';

/**
 * GET /api/inventory/photo?u=&e=&s=
 *
 * Serves a MarketCheck-hosted photo. The signed query identifies an
 * allowlisted MarketCheck host; the API key is added on the server. Extra
 * query keys are rejected. Per-IP limits fail closed when the durable counter
 * is missing. Dealer CDNs and any other host are rejected.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleInventoryPhoto(request);
}
