import { NextRequest, NextResponse } from 'next/server';

import { applyRevenueCatEvent, webhookAuthorized, type RevenueCatWebhookEvent } from '@/lib/shopper/credit-purchases';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookAuthorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { event?: RevenueCatWebhookEvent } | null;
  const event = body?.event;
  if (!event || typeof event !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  await applyRevenueCatEvent(createAdminClient(), event);
  return NextResponse.json({ received: true });
}
