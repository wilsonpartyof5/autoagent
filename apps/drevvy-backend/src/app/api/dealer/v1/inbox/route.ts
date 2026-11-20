import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { mergeIsolatedInbox } from '@/lib/dealer/isolated-thread';
import { listLiveInbox, parseInboxFilter, parseRooftopQuery } from '@/lib/dealer/live-store';
import { inboxHttp } from '@/lib/dealer/mock';
import type { InboxItem } from '@/lib/dealer/types';

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
      if (result.status === 200 && result.body && typeof result.body === 'object') {
        const body = result.body as { filter?: string; items?: InboxItem[] };
        if (typeof body.filter === 'string' && Array.isArray(body.items)) {
          body.items = mergeIsolatedInbox(body.items, body.filter);
        }
      }
      return NextResponse.json(result.body, { status: result.status });
    },
  );
}
