import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { readItemizedLines } from '@/lib/dealer/format';
import {
  isIsolatedThreadId,
  shareIsolatedItemized,
  threadFixtureEnabled,
  FIXTURE_LABEL,
} from '@/lib/dealer/isolated-thread';
import { shareLiveNumbers } from '@/lib/dealer/live-store';
import { errorStatus, shareNumbersHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const payload = await request.json().catch(() => null);
  if (isIsolatedThreadId(leadId)) {
    if (!threadFixtureEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
    }
    const lines = readItemizedLines(payload as Record<string, unknown>);
    if (!lines || lines === 'invalid') {
      return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
    }
    const note = typeof (payload as { note?: unknown }).note === 'string' ? (payload as { note: string }).note : '';
    const result = shareIsolatedItemized(leadId, lines, note);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
    return NextResponse.json({
      source: 'test-owned',
      persistence: 'isolated-preview-file',
      fixtureLabel: FIXTURE_LABEL,
      liveSystems: false,
      conversation: result.data,
    });
  }
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
      const lines = readItemizedLines(record);
      if (lines === 'invalid') return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
      const result = await shareLiveNumbers(session, leadId, {
        statedPriceCents: record.statedPriceCents,
        writtenOtdCents: typeof record.writtenOtdCents === 'number' ? record.writtenOtdCents : null,
        note: typeof record.note === 'string' ? record.note : '',
        lines,
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
