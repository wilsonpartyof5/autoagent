import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { shareLiveNumbers } from '@/lib/dealer/live-store';
import { errorStatus, shareNumbersHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const payload = await request.json().catch(() => null);
  return withDealerApi(
    request,
    async (session) => {
      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
      }
      const record = payload as Record<string, unknown>;
      if (typeof record.statedPriceCents !== 'number') {
        return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
      }
      const result = await shareLiveNumbers(session, leadId, {
        statedPriceCents: record.statedPriceCents,
        writtenOtdCents: typeof record.writtenOtdCents === 'number' ? record.writtenOtdCents : null,
        note: typeof record.note === 'string' ? record.note : '',
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
      }
      return NextResponse.json({ source: 'live', conversation: result.data });
    },
    () => {
      const result = shareNumbersHttp(leadId, payload);
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
