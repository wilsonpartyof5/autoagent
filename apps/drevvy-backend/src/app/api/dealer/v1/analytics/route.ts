import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { liveAnalytics, parseAnalyticsRange, parseRooftopQuery } from '@/lib/dealer/live-store';
import { analyticsHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withDealerApi(
    request,
    async (session) => {
      const range = parseAnalyticsRange(request.url);
      if (!range) return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
      const summary = await liveAnalytics(session, range, parseRooftopQuery(request.url));
      if (!summary) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
      return NextResponse.json(summary);
    },
    () => {
      const result = analyticsHttp(request.url);
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
