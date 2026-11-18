import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { tryIsolatedDealerMessage } from '@/lib/dealer/isolated-thread';
import { errorStatus, postMessageHttp } from '@/lib/dealer/mock';
import { postLiveMessage } from '@/lib/dealer/live-store';

export const dynamic = 'force-dynamic';

function readBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const body = (payload as { body?: unknown }).body;
  return typeof body === 'string' ? body : '';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const payload = await request.json().catch(() => null);
  const fixture = tryIsolatedDealerMessage(leadId, payload);
  if (fixture) return NextResponse.json(fixture.body, { status: fixture.status });
  const idempotencyKey = payload && typeof payload === 'object' && typeof (payload as { idempotencyKey?: unknown }).idempotencyKey === 'string'
    ? (payload as { idempotencyKey: string }).idempotencyKey
    : null;
  return withDealerApi(
    request,
    async (session) => {
      const result = await postLiveMessage(session, leadId, readBody(payload), new Date(), idempotencyKey);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
      }
      return NextResponse.json({ source: 'live', conversation: result.data });
    },
    () => {
      const result = postMessageHttp(leadId, payload);
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
