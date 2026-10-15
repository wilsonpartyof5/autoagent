import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { consumerAuthErrorResponse, requireConsumerAuth } from '@/lib/consumer/auth';
import {
  creditBalanceData,
  fetchRevenueCatSubscriber,
  findVerifiedPurchase,
  grantVerifiedPurchase,
  packForProductId,
  purchasesConfigured,
} from '@/lib/shopper/credit-purchases';
import { getShopperCredits } from '@/lib/shopper/credits';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const NOT_CONFIGURED = 'purchases not configured';

function balanceResponse(credits: Awaited<ReturnType<typeof getShopperCredits>>) {
  return NextResponse.json({ data: creditBalanceData(credits) });
}

function notConfigured() {
  return NextResponse.json(
    { success: false, error: { code: 'purchases_not_configured', message: NOT_CONFIGURED } },
    { status: 503 },
  );
}

export async function handleGetCreditBalance(
  request: Request,
  deps: {
    requireAuth: (request: Request) => Promise<{ userId: string }>;
    supabase: () => SupabaseClient;
  },
): Promise<NextResponse> {
  try {
    const auth = await deps.requireAuth(request);
    const credits = await getShopperCredits(deps.supabase(), auth.userId);
    return balanceResponse(credits);
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  return handleGetCreditBalance(request, {
    requireAuth: requireConsumerAuth,
    supabase: createAdminClient,
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
    if (!apiKey || !purchasesConfigured(apiKey)) return notConfigured();

    const body = await request.json().catch(() => null) as { productId?: unknown; transactionId?: unknown } | null;
    const productId = typeof body?.productId === 'string' ? body.productId : '';
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId.trim() : '';
    const pack = packForProductId(productId);
    if (!pack || !transactionId) {
      return NextResponse.json(
        { success: false, error: { code: 'invalid_purchase', message: 'A known productId and transactionId are required.' } },
        { status: 400 },
      );
    }

    const lookup = await fetchRevenueCatSubscriber(auth.userId, apiKey);
    if (!lookup.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'verification_failed', message: 'Purchase could not be verified.' } },
        { status: 502 },
      );
    }
    const verified = findVerifiedPurchase(lookup.subscriber, transactionId, productId);
    if (!verified) {
      return NextResponse.json(
        { success: false, error: { code: 'unverified_purchase', message: 'Purchase could not be verified.' } },
        { status: 402 },
      );
    }

    const granted = await grantVerifiedPurchase(createAdminClient(), auth.userId, verified);
    if (!granted.success) {
      return NextResponse.json(
        { success: false, error: { code: 'purchase_failed', message: 'Drevvy could not add these credits.' } },
        { status: 500 },
      );
    }
    return balanceResponse(granted.credits);
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}
