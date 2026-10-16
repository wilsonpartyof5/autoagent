import { NextRequest, NextResponse } from 'next/server';

import { webhookAuthorized } from '@/lib/shopper/credit-purchases';
import { handleRevenueCatWebhook } from '@/lib/shopper/revenuecat-webhook-handler';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookAuthorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handleRevenueCatWebhook(request, {
    secret,
    supabase: createAdminClient(),
  });
}
