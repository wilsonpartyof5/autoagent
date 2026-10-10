import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { queryShoppers, type ShopperSort } from '@/lib/admin/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;
  const sort = request.nextUrl.searchParams.get('sort') as ShopperSort | null;
  const dir = request.nextUrl.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const data = await queryShoppers({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
    sort: sort ?? undefined,
    dir,
  });
  return NextResponse.json({ success: true, data, source: 'mock' });
}
