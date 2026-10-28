import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { liveBilling, markLiveSold } from '@/lib/dealer/live-store';
import { errorStatus, markSoldHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  return withDealerApi(
    request,
    async (session) => {
      const result = await markLiveSold(session, leadId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
      }
      const billing = await liveBilling(session);
      return NextResponse.json({
        source: 'live',
        conversation: result.data,
        billing,
      });
    },
    () => {
      const result = markSoldHttp(leadId);
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
