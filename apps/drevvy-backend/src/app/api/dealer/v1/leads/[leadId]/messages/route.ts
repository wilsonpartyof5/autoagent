import { NextResponse } from 'next/server';

import { postMessageHttp } from '@/lib/dealer/mock';
import { persistLiveOtdReply } from '@/lib/dealer/otd-warnings';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const payload = await request.json().catch(() => null);
  const text = payload && typeof payload === 'object' && typeof (payload as { body?: unknown }).body === 'string'
    ? (payload as { body: string }).body
    : '';
  const result = postMessageHttp(leadId, payload);
  if (text.trim()) await persistLiveOtdReply(leadId, text);
  return NextResponse.json(result.body, { status: result.status });
}
