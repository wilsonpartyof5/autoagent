import { NextResponse } from 'next/server';

import { isAdminAuthFailure, requireAdminApi } from '@/lib/admin/guard';
import { listBuyOutcomes } from '@/lib/shopper/deal-actions';
import { getLifecycleRepository } from '@/lib/shopper/lifecycle-store';

/**
 * GET /api/admin/outcomes
 *
 * Buy answers (yes/no and final price) for the operator console.
 * Admin session required. Preview mode follows the rest of /api/admin.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (isAdminAuthFailure(auth)) return auth;
  const lifecycle = getLifecycleRepository();
  const data = await listBuyOutcomes(lifecycle);
  return NextResponse.json({ success: true, source: lifecycle.source, data });
}
