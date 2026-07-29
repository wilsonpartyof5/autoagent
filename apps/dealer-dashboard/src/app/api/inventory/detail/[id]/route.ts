import { NextRequest, NextResponse } from 'next/server';
import {
  getVehicleDetailMcp,
  MarketCheckQuotaError,
  MarketCheckRateLimitError,
} from '@/lib/marketcheck/mcp-adapter';

/**
 * GET /api/inventory/detail/[id]
 *
 * Vehicle Detail + Enrichment Endpoint — MCP-first.
 *
 * Assembles a rich vehicle detail payload by orchestrating three parallel
 * MarketCheck MCP tool calls:
 *   1. search_active_cars  — current listing (price, photos, dealer, condition)
 *   2. decode_vin_neovin   — build specs, MSRP, features, options
 *   3. get_car_history     — days on market, price change history
 *
 * Path param:  [id] — MarketCheck listing ID (from /api/inventory/search)
 * Query param: vin  — optional VIN hint to improve MCP enrichment accuracy
 *
 * Response shape is identical to the previous REST-backed route so mobile
 * clients require no changes.
 */

// -------------------------------------------------------------------------
// Auth
// -------------------------------------------------------------------------

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  if (!apiKey) return false;
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.substring(7) === apiKey) return true;
  return false;
}

// -------------------------------------------------------------------------
// Route handler
// -------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const reqStart = Date.now();
  const { id: listingId } = await params;

  if (!listingId || !/^[a-zA-Z0-9_-]{4,64}$/.test(listingId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid listing ID' } },
      { status: 400 },
    );
  }

  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
      { status: 401 },
    );
  }

  const vinHint = request.nextUrl.searchParams.get('vin') ?? undefined;

  console.log(JSON.stringify({ event: 'mc_mcp_detail_start', listingId, hasVin: !!vinHint }));

  try {
    const detail = await getVehicleDetailMcp(listingId, vinHint);

    if (!detail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LISTING_NOT_FOUND',
            message: 'Vehicle details are no longer available. The listing may have been sold or removed.',
          },
        },
        { status: 404 },
      );
    }

    const latencyMs = Date.now() - reqStart;
    console.log(JSON.stringify({ event: 'mc_mcp_detail_served', listingId, partial: detail.partial, latencyMs }));

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    const latencyMs = Date.now() - reqStart;

    if (error instanceof MarketCheckQuotaError) {
      console.error(JSON.stringify({ event: 'mc_mcp_detail_quota', listingId, latencyMs }));
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 503 },
      );
    }

    if (error instanceof MarketCheckRateLimitError) {
      console.error(JSON.stringify({ event: 'mc_mcp_detail_rate_limited', listingId, latencyMs }));
      const res = NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 429 },
      );
      if (error.retryAfter) res.headers.set('Retry-After', String(error.retryAfter));
      return res;
    }

    console.error(JSON.stringify({
      event: 'mc_mcp_detail_error',
      listingId,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    }));

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred fetching vehicle details.' } },
      { status: 500 },
    );
  }
}
