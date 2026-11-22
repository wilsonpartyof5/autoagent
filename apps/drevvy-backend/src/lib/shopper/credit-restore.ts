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
  purchasesConfigured,
} from '@/lib/shopper/credit-purchases';
import { getShopperCredits } from '@/lib/shopper/credits';
import { sandboxGrantCap, type SandboxGrantCap, type SandboxGrantEnv } from '@/lib/shopper/sandbox-grant-policy';
import { createAdminClient } from '@/lib/supabase/admin';

export type CreditRestoreDeps = {
  requireAuth?: (request: Request) => Promise<{ userId: string }>;
  supabase?: SupabaseClient;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  env?: SandboxGrantEnv;
  claimLimiter?: CreditClaimLimiter;
  sandboxCap?: SandboxGrantCap;
  now?: () => Date;
};

export async function handleCreditRestore(request: Request, deps: CreditRestoreDeps = {}) {
  try {
    const requireAuth = deps.requireAuth ?? requireConsumerAuth;
    const auth = await requireAuth(request);
    const limiter = deps.claimLimiter ?? creditClaimLimiter();
    if (!(await limiter.allow(auth.userId))) {
      return NextResponse.json(
        { success: false, error: { code: 'rate_limited', message: 'Too many purchase attempts. Try again shortly.' } },
        { status: 429 },
      );
    }
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

    const env = deps.env ?? process.env;
    const cap = deps.sandboxCap ?? sandboxGrantCap();
    const now = deps.now ? deps.now() : new Date();
    let credits = await getShopperCredits(admin, auth.userId);
    for (const transactionId of transactionIds) {
      const verified = findVerifiedPurchase(lookup.subscriber, transactionId.trim());
      if (!verified) continue;
      const decision = decideClaimGrant(auth.userId, verified, env, cap, now);
      if (!decision.ok) {
        return NextResponse.json(
          { success: false, error: { code: decision.code, message: decision.message } },
          { status: decision.status },
        );
      }
      const granted = await grantVerifiedPurchase(admin, auth.userId, verified);
      if (!granted.success) {
        return NextResponse.json(
          { success: false, error: { code: 'purchase_failed', message: 'Drevvy could not restore these keys.' } },
          { status: 500 },
        );
      }
      if (granted.alreadyGrantedElsewhere) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'purchase_granted_elsewhere',
              message: 'This purchase is already on another Drevvy account.',
            },
          },
          { status: 409 },
        );
      }
      if (decision.sandbox && granted.granted && !granted.alreadyGranted) {
        cap.note(auth.userId, verified.transactionId, now);
      }
      credits = granted.credits;
    }

    return NextResponse.json({ data: creditBalanceData(credits) });
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}
