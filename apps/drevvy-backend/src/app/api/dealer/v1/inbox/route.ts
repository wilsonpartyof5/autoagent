import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { listLiveInbox, parseInboxFilter, parseRooftopQuery } from '@/lib/dealer/live-store';
import { inboxHttp } from '@/lib/dealer/mock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withDealerApi(
    request,
    async (session) => {
      const filter = parseInboxFilter(request.url);
      if (!filter) return NextResponse.json({ error: 'invalid_filter' }, { status: 400 });
      const items = await listLiveInbox(session, filter, parseRooftopQuery(request.url));
      if (!items) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
      return NextResponse.json({ source: 'live', filter, items });
    },
    () => {
      const result = inboxHttp(request.url);
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
