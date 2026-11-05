import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { tryIsolatedDealerRead } from '@/lib/dealer/isolated-thread';
import { presentLiveConversation } from '@/lib/dealer/live-store';
import { conversationHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const fixture = tryIsolatedDealerRead(leadId);
  if (fixture) return NextResponse.json(fixture.body, { status: fixture.status });
  return withDealerApi(
    request,
    async (session) => {
      const conversation = await presentLiveConversation(session, leadId);
      if (!conversation) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ source: 'live', conversation });
    },
    () => {
      const result = conversationHttp(leadId);
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
