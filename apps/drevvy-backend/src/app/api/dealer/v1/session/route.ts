import { NextResponse } from 'next/server';

import { withDealerApi } from '@/lib/dealer/desk-api';
import { publicDealerSession } from '@/lib/dealer/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withDealerApi(
    request,
    (session) => NextResponse.json(publicDealerSession(session)),
    () => NextResponse.json({ source: 'mock', preview: true }),
  );
}
