import { NextResponse } from 'next/server';
import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { loadDeal } from '@/lib/admin/repository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;
  const { dealId } = await params;
  const loaded = await loadDeal(dealId);
  if (!loaded) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ success: true, source: 'mock', data: loaded.deal });
}
