import { NextResponse } from 'next/server';

import { acceptDealerCommitments, readDealerCommitment } from '@/lib/dealer/activation-gate';
import { dealerAuthErrorResponse, DealerAuthError, requireDealerApi } from '@/lib/dealer/session';

export const dynamic = 'force-dynamic';

function denied(status: number, code: string) {
  return NextResponse.json({ error: code }, { status });
}

/**
 * Records the signed-in member's message-only and itemized-otd commitment.
 * This route is the write. Desk routes call the gate and stay closed until
 * this row exists. A demo cookie is not accepted as the record.
 */
export async function POST(request: Request) {
  try {
    const session = await requireDealerApi(request);
    const payload = await request.json().catch(() => null);
    const result = await acceptDealerCommitments(session, payload, request);
    if (!result.ok) return denied(result.status, result.code);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof DealerAuthError) return dealerAuthErrorResponse(error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireDealerApi(request);
    const rooftopId = new URL(request.url).searchParams.get('rooftopId')?.trim() ?? '';
    const result = await readDealerCommitment(session, rooftopId, request);
    if (!result.ok) return denied(result.status, result.code);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof DealerAuthError) return dealerAuthErrorResponse(error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
