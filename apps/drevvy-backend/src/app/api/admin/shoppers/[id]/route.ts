import { NextResponse } from 'next/server';
import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { loadShopper } from '@/lib/admin/repository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;
  const { id } = await params;
  const loaded = await loadShopper(id);
  if (!loaded) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    success: true,
    source: 'mock',
    data: {
      shopper: {
        id: loaded.shopper.id,
        name: loaded.shopper.name,
        email: loaded.shopper.email,
        subscription: loaded.shopper.subscription,
        signedUpAt: loaded.shopper.signedUpAt,
      },
      cards: loaded.cards,
    },
  });
}
