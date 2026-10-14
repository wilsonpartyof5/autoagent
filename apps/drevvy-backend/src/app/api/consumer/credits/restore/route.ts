import { NextRequest, NextResponse } from 'next/server';

import { consumerAuthErrorResponse, requireConsumerAuth } from '@/lib/consumer/auth';
import {
  creditBalanceData,
  fetchRevenueCatSubscriber,
  findVerifiedPurchase,
  purchasesConfigured,
} from '@/lib/shopper/credit-purchases';
import { getShopperCredits, purchaseCredits } from '@/lib/shopper/credits';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
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

    const admin = createAdminClient();
    if (transactionIds.length === 0) {
      const credits = await getShopperCredits(admin, auth.userId);
      return NextResponse.json({ data: creditBalanceData(credits) });
    }

    const lookup = await fetchRevenueCatSubscriber(auth.userId, apiKey);
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
      const granted = await purchaseCredits(admin, auth.userId, verified.size, verified.priceUsd, transactionId.trim());
      if (!granted.success) {
        return NextResponse.json(
          { success: false, error: { code: 'purchase_failed', message: 'Drevvy could not restore these credits.' } },
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
