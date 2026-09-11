import { NextRequest, NextResponse } from 'next/server';
import { fetchAndIngestMarketCheckInventory } from '@/lib/ingest/marketcheck';

/**
 * Trusted service sync. Not a user action — cron/automation must present
 * DASHBOARD_INGEST_TOKEN. MarketCheck IDs come from the caller, not a browser.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.DASHBOARD_INGEST_TOKEN;

    if (!expectedToken) {
      return NextResponse.json(
        { error: 'Inventory sync token is not configured on the server' },
        { status: 500 },
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { dealerId, source, dealershipId } = body ?? {};

    if (!dealerId || typeof dealerId !== 'string') {
      return NextResponse.json({ error: 'dealerId is required' }, { status: 400 });
    }

    if (dealershipId != null && typeof dealershipId !== 'string') {
      return NextResponse.json({ error: 'dealershipId must be a string' }, { status: 400 });
    }

    const result = await fetchAndIngestMarketCheckInventory({
      dealerId,
      source: typeof source === 'string' ? source : undefined,
      dealershipId: typeof dealershipId === 'string' ? dealershipId : undefined,
    });

    return NextResponse.json({
      ok: true,
      imported: result.imported,
    });
  } catch (error) {
    console.error('[inventory-sync] failed to sync inventory', error);
    return NextResponse.json(
      {
        error: 'Inventory sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
