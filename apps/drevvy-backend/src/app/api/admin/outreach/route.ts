import { NextResponse } from 'next/server';

import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { loadOutreachReport, outreachDataSource, parseOutreachRange } from '@/lib/admin/outreach/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;
  const url = new URL(request.url);
  const range = parseOutreachRange(url.searchParams.get('from') ?? undefined, url.searchParams.get('to') ?? undefined);
  return NextResponse.json({ success: true, source: outreachDataSource(), data: await loadOutreachReport(range) });
}
