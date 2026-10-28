import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { liveBilling } from '@/lib/dealer/live-store';
import { billingHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withDealerApi(
    request,
    async (session) => {
      const snapshot = await liveBilling(session);
      if (!snapshot) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
      return NextResponse.json(snapshot);
    },
    () => {
      const result = billingHttp();
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
