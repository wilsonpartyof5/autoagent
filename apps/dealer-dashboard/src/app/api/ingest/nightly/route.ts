import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAndIngestMarketCheckInventory } from '@/lib/ingest/marketcheck';
import { tokensEqual } from '@/lib/auth/tokens';

/**
 * POST /api/ingest/nightly
 *
 * Nightly refresh for enrolled dealers via Cars Dealer Inventory Syndication.
 * Uses the service-role client (no browser session on cron).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedToken = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;

    if (!expectedToken) {
      return NextResponse.json(
        { error: 'INGESTION_API_TOKEN must be configured' },
        { status: 503 },
      );
    }

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cronSecret;

    if (!tokensEqual(token, expectedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: dealerships, error: dealershipsError } = await supabase
      .from('dealerships')
      .select('id, name, marketcheck_dealer_id, marketcheck_website_url')
      .not('marketcheck_dealer_id', 'is', null);

    if (dealershipsError) {
      console.error('[nightly-ingest] Error fetching dealerships:', dealershipsError);
      return NextResponse.json(
        { error: 'Failed to fetch dealerships', details: dealershipsError.message },
        { status: 500 },
      );
    }

    if (!dealerships || dealerships.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No dealerships with MarketCheck dealer IDs found',
        processed: 0,
        results: [],
      });
    }

    console.log(`[nightly-ingest] Starting nightly refresh for ${dealerships.length} dealerships`);

    const results = [];
    const errors = [];

    for (const dealership of dealerships) {
      const dealerId = dealership.marketcheck_dealer_id;
      if (!dealerId) {
        continue;
      }

      try {
        console.log(`[nightly-ingest] Processing dealership ${dealership.id} (${dealership.name}) - dealer ID: ${dealerId}`);

        const result = await fetchAndIngestMarketCheckInventory({
          dealerId,
          source: dealership.marketcheck_website_url || undefined,
        });

        results.push({
          dealershipId: dealership.id,
          dealershipName: dealership.name,
          dealerId,
          success: true,
          fetched: result.fetched,
          imported: result.imported,
          valid: result.valid,
          invalid: result.invalid,
        });

        console.log(`[nightly-ingest] Successfully synced ${dealership.name}: ${result.imported} vehicles imported`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          dealershipId: dealership.id,
          dealershipName: dealership.name,
          dealerId,
          error: errorMessage,
        });

        console.error(`[nightly-ingest] Failed to sync ${dealership.name}:`, errorMessage);
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);

    console.log(`[nightly-ingest] Nightly refresh complete: ${successCount} succeeded, ${errorCount} failed, ${totalImported} total vehicles imported`);

    return NextResponse.json({
      ok: true,
      message: `Nightly refresh complete: ${successCount} succeeded, ${errorCount} failed`,
      processed: dealerships.length,
      succeeded: successCount,
      failed: errorCount,
      totalImported,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[nightly-ingest] Nightly refresh failed:', error);
    return NextResponse.json(
      {
        error: 'Nightly refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
