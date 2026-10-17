import { NextRequest, NextResponse } from 'next/server';
import { marketCheckSubject, withMarketCheckContext } from '@/lib/marketcheck/context';
import {
  getVehicleDetailMcp,
  parseDetailSections,
  MarketCheckQuotaError,
  MarketCheckRateLimitError,
} from '@/lib/marketcheck/mcp-adapter';
import { payloadContainsSecret, redactSecrets } from '@/lib/marketcheck/secrets';
import { redactShopperDealerIdentity } from '@/lib/shopper/redact-dealer';

/**
 * GET /api/inventory/detail/[id]
 *
 * Vehicle Detail + Enrichment Endpoint — MCP-first.
 *
 * The default response is the listing shell (search_active_cars) only.
 * Query param `sections` loads extra MarketCheck calls when that VDP section
 * is opened: `vin` (decode_vin_neovin) and `history` (get_car_history).
 * Example: /api/inventory/detail/:id?vin=...&sections=vin
 *
 * Path param:  [id] — MarketCheck listing ID (from /api/inventory/search)
 * Query param: vin  — optional VIN hint. Pass it with sections=vin so the
 *                     decode does not need a second listing search.
 *
 * Shopper JSON passes through redactShopperDealerIdentity. Price, specs,
 * photos, city/state, coordinates, and days on market stay. dealerName is
 * an empty string. Phone, website, street address, and sales staff are omitted.
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
  const sections = parseDetailSections(request.nextUrl.searchParams.get('sections'));
  if (!sections) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_SECTION', message: 'sections must be listing, vin, or history' } },
      { status: 400 },
    );
  }

  console.log(JSON.stringify({ event: 'mc_mcp_detail_start', listingId, hasVin: !!vinHint, sections }));

  try {
    const detail = await withMarketCheckContext(
      {
        origin: request.nextUrl.origin,
        subject: marketCheckSubject(undefined, request.headers.get('x-drevvy-subject')),
      },
      () => getVehicleDetailMcp(listingId, vinHint, sections),
    );

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

    const payload = redactShopperDealerIdentity({ success: true, data: detail });
    if (payloadContainsSecret(payload)) {
      console.error(JSON.stringify({ event: 'marketcheck_secret_blocked', surface: 'detail' }));
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred fetching vehicle details.' } },
        { status: 500 },
      );
    }
    return NextResponse.json(payload);
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
      error: redactSecrets(error instanceof Error ? error.message : String(error)),
    }));

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred fetching vehicle details.' } },
      { status: 500 },
    );
  }
}
