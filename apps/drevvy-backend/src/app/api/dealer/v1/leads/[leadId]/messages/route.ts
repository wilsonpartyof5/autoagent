import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
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
  return withDealerApi(
    request,
    async (session) => {
      const result = await postLiveMessage(session, leadId, readBody(payload));
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
