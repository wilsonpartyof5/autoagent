import { NextRequest, NextResponse } from 'next/server';
import { syncMarketCheckInventory } from '@/app/app/setup/actions';

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
    const { dealerId, zip, radiusMiles, condition } = body ?? {};

    if (!dealerId || typeof dealerId !== 'string') {
      return NextResponse.json({ error: 'dealerId is required' }, { status: 400 });
    }

    const normalizedCondition =
      condition === 'new' || condition === 'used' || condition === 'all' ? condition : undefined;

    let normalizedRadius: number | undefined;
    if (radiusMiles !== undefined && radiusMiles !== null) {
      const parsed =
        typeof radiusMiles === 'number' ? radiusMiles : Number.parseFloat(radiusMiles);
      if (Number.isNaN(parsed)) {
        return NextResponse.json({ error: 'radiusMiles must be numeric' }, { status: 400 });
      }
      normalizedRadius = parsed;
    }

    const result = await syncMarketCheckInventory({
      dealerId,
      zip,
      radiusMiles: normalizedRadius,
      condition: normalizedCondition,
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
