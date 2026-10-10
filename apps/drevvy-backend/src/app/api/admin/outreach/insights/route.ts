import { NextResponse } from 'next/server';

import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { getOutreachInsight } from '@/lib/admin/outreach/insights';
import { outreachDataSource, parseOutreachRange } from '@/lib/admin/outreach/repository';

export const dynamic = 'force-dynamic';

async function respond(request: Request, regenerate: boolean) {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;
  const url = new URL(request.url);
  const range = parseOutreachRange(url.searchParams.get('from') ?? undefined, url.searchParams.get('to') ?? undefined);
  const data = await getOutreachInsight(range, { regenerate });
  return NextResponse.json({ success: true, source: outreachDataSource(), data });
}

export function GET(request: Request) {
  return respond(request, false);
}

export function POST(request: Request) {
  return respond(request, true);
}
