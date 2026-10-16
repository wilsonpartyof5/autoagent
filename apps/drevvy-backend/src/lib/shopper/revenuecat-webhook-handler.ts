import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { applyRevenueCatEvent, webhookAuthorized, type RevenueCatWebhookEvent } from '@/lib/shopper/credit-purchases';

export async function handleRevenueCatWebhook(
  request: Request,
  deps: {
    secret: string | undefined;
    supabase: SupabaseClient;
  },
): Promise<NextResponse> {
  if (!webhookAuthorized(request.headers.get('authorization'), deps.secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { event?: RevenueCatWebhookEvent } | null;
  const event = body?.event;
  if (!event || typeof event !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = await applyRevenueCatEvent(deps.supabase, event);
  if (result.retryable) {
    return NextResponse.json({ error: 'Credit update failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
