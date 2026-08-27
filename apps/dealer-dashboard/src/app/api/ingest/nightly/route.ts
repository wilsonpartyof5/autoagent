import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAndIngestMarketCheckInventory } from '@/app/app/setup/actions';

/**
 * POST /api/ingest/nightly
 * 
 * Nightly refresh endpoint that syncs inventory for all active dealers.
 * 
 * Authentication:
 * - Requires Authorization: Bearer <INGESTION_API_TOKEN> header, OR
 * - Requires X-Cron-Secret header matching INGESTION_API_TOKEN (for Vercel cron)
 * 
 * Usage:
 * - Vercel Cron: Add to vercel.json cron jobs to hit this endpoint
 * - Railway Cron: Schedule a job to POST to this endpoint
 * - Manual: curl -X POST https://your-domain.com/api/ingest/nightly -H "Authorization: Bearer <token>"
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedToken = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;

    if (!expectedToken) {
      return NextResponse.json(
        { error: 'INGESTION_API_TOKEN or MCP_SERVER_TOKEN must be configured' },
        { status: 500 },
      );
    }

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cronSecret;

    if (!token || token !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active dealerships with MarketCheck dealer IDs
    const supabase = await createClient();
    const { data: dealerships, error: dealershipsError } = await supabase
      .from('dealerships')
      .select('id, name, marketcheck_dealer_id, marketcheck_website_url')
      .not('marketcheck_dealer_id', 'is', null)
      .eq('is_active', true);

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
        message: 'No active dealerships with MarketCheck dealer IDs found',
        processed: 0,
        results: [],
      });
    }

    console.log(`[nightly-ingest] Starting nightly refresh for ${dealerships.length} dealerships`);

    const results = [];
    const errors = [];

    // Process each dealership
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

        // Note: Dealership sync status tracking would require additional fields in the dealerships table
        // Sync completion is tracked via ingestion results and logs

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

        console.log(`[nightly-ingest] ✅ Successfully synced ${dealership.name}: ${result.imported} vehicles imported`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          dealershipId: dealership.id,
          dealershipName: dealership.name,
          dealerId,
          error: errorMessage,
        });

        console.error(`[nightly-ingest] ❌ Failed to sync ${dealership.name}:`, errorMessage);
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

