import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { consumerAuthErrorResponse, requireConsumerAuth } from '@/lib/consumer/auth';
import {
  creditBalanceData,
  fetchRevenueCatSubscriber,
  findVerifiedPurchase,
  grantVerifiedPurchase,
  purchasesConfigured,
} from '@/lib/shopper/credit-purchases';
import { getShopperCredits } from '@/lib/shopper/credits';
import { createAdminClient } from '@/lib/supabase/admin';

export type CreditRestoreDeps = {
  requireAuth?: (request: Request) => Promise<{ userId: string }>;
  supabase?: SupabaseClient;
  fetchImpl?: typeof fetch;
  apiKey?: string;
};

export async function handleCreditRestore(request: Request, deps: CreditRestoreDeps = {}) {
  try {
    const requireAuth = deps.requireAuth ?? requireConsumerAuth;
    const auth = await requireAuth(request);
    const apiKey = deps.apiKey ?? process.env.REVENUECAT_SECRET_API_KEY;
    if (!apiKey || !purchasesConfigured(apiKey)) {
      return NextResponse.json(
        { success: false, error: { code: 'purchases_not_configured', message: 'purchases not configured' } },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => null) as { transactionIds?: unknown } | null;
    const transactionIds = Array.isArray(body?.transactionIds)
      ? body.transactionIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '').slice(0, 50)
      : [];

    const admin = deps.supabase ?? createAdminClient();
    if (transactionIds.length === 0) {
      const credits = await getShopperCredits(admin, auth.userId);
      return NextResponse.json({ data: creditBalanceData(credits) });
    }

    const lookup = await fetchRevenueCatSubscriber(auth.userId, apiKey, deps.fetchImpl ?? fetch);
    if (!lookup.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'verification_failed', message: 'Purchase could not be verified.' } },
        { status: 502 },
      );
    }

    let credits = await getShopperCredits(admin, auth.userId);
    for (const transactionId of transactionIds) {
      const verified = findVerifiedPurchase(lookup.subscriber, transactionId.trim());
      if (!verified) continue;
      const granted = await grantVerifiedPurchase(admin, auth.userId, verified);
      if (!granted.success) {
        return NextResponse.json(
          { success: false, error: { code: 'purchase_failed', message: 'Drevvy could not restore these keys.' } },
          { status: 500 },
        );
      }
      credits = granted.credits;
    }

    return NextResponse.json({ data: creditBalanceData(credits) });
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}
