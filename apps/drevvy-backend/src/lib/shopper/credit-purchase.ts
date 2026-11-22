import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { consumerAuthErrorResponse, requireConsumerAuth } from '@/lib/consumer/auth';
import { creditClaimLimiter, type CreditClaimLimiter } from '@/lib/shopper/credit-claim-rate-limit';
import {
  creditBalanceData,
  decideClaimGrant,
  fetchRevenueCatSubscriber,
  findVerifiedPurchase,
  grantVerifiedPurchase,
  packForProductId,
  purchasesConfigured,
} from '@/lib/shopper/credit-purchases';
import { getShopperCredits } from '@/lib/shopper/credits';
import { sandboxGrantCap, type SandboxGrantCap, type SandboxGrantEnv } from '@/lib/shopper/sandbox-grant-policy';
import { createAdminClient } from '@/lib/supabase/admin';

export type CreditPurchaseDeps = {
  requireAuth?: (request: Request) => Promise<{ userId: string }>;
  supabase?: SupabaseClient;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  env?: SandboxGrantEnv;
  claimLimiter?: CreditClaimLimiter;
  sandboxCap?: SandboxGrantCap;
  now?: () => Date;
};

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

function claimError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function handleCreditPurchase(request: Request, deps: CreditPurchaseDeps = {}) {
  try {
    const requireAuth = deps.requireAuth ?? requireConsumerAuth;
    const auth = await requireAuth(request);
    const limiter = deps.claimLimiter ?? creditClaimLimiter();
    if (!(await limiter.allow(auth.userId))) {
      return claimError(429, 'rate_limited', 'Too many purchase attempts. Try again shortly.');
    }
    const apiKey = deps.apiKey ?? process.env.REVENUECAT_SECRET_API_KEY;
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

    const lookup = await fetchRevenueCatSubscriber(auth.userId, apiKey, deps.fetchImpl ?? fetch);
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
    const env = deps.env ?? process.env;
    const cap = deps.sandboxCap ?? sandboxGrantCap();
    const now = deps.now ? deps.now() : new Date();
    const decision = decideClaimGrant(auth.userId, verified, env, cap, now);
    if (!decision.ok) return claimError(decision.status, decision.code, decision.message);

    const granted = await grantVerifiedPurchase(deps.supabase ?? createAdminClient(), auth.userId, verified);
    if (!granted.success) {
      return NextResponse.json(
        { success: false, error: { code: 'purchase_failed', message: 'Drevvy could not add these keys.' } },
        { status: 500 },
      );
    }
    if (granted.alreadyGrantedElsewhere) {
      return claimError(409, 'purchase_granted_elsewhere', 'This purchase is already on another Drevvy account.');
    }
    if (decision.sandbox && granted.granted && !granted.alreadyGranted) {
      cap.note(auth.userId, verified.transactionId, now);
    }
    return balanceResponse(granted.credits);
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}
