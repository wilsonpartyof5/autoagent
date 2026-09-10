import { NextRequest, NextResponse } from 'next/server';
import { tokensEqual } from '@/lib/auth/tokens';
import { kickLeadDeliveryOutbox } from '@/lib/lead-delivery';

/**
 * POST /api/cron/lead-delivery
 *
 * Retries CRM outbox jobs after a Railway restart or a missed in-process kick.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  const acceptedTokens = [
    process.env.CRON_SECRET,
    process.env.INGESTION_API_TOKEN,
    process.env.MCP_SERVER_TOKEN,
  ].filter((value): value is string => Boolean(value));

  if (acceptedTokens.length === 0) {
    return NextResponse.json({ error: 'Lead delivery cron is not configured' }, { status: 503 });
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cronSecret;
  if (!acceptedTokens.some((expected) => tokensEqual(token, expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await kickLeadDeliveryOutbox();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[lead-delivery-cron] Kick failed', error);
    return NextResponse.json(
      {
        error: 'Lead delivery kick failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
