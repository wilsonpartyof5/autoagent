import { NextResponse } from 'next/server';
import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { loadAnalytics } from '@/lib/admin/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;
  return NextResponse.json({ success: true, source: 'mock', data: await loadAnalytics() });
}
