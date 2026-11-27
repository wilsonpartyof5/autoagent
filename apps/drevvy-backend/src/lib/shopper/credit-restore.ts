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
  subscriberLookupFailure,
  type VerifiedCreditPurchase,
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

export type CreditRestoreSkipReason =
  | 'already_granted_elsewhere'
  | 'refused'
  | 'sandbox_not_allowed'
  | 'sandbox_cap'
  | 'test_store'
  | 'promotional'
  | 'already_granted';

export type CreditRestoreSkip = {
  transactionId: string;
  reason: CreditRestoreSkipReason;
};

function blockedSkipReason(verified: VerifiedCreditPurchase): 'test_store' | 'promotional' | null {
  const values = [verified.store, verified.periodType]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase());
  if (values.includes('promotional')) return 'promotional';
  if (values.includes('test_store')) return 'test_store';
  return null;
}

function decisionSkipReason(code: string, verified: VerifiedCreditPurchase): CreditRestoreSkipReason {
  if (code === 'sandbox_not_allowed') return 'sandbox_not_allowed';
  if (code === 'sandbox_daily_cap') return 'sandbox_cap';
  return blockedSkipReason(verified) ?? 'refused';
}

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
      return NextResponse.json({ data: creditBalanceData(credits), skipped: [] });
    }

    const lookup = await fetchRevenueCatSubscriber(auth.userId, apiKey, deps.fetchImpl ?? fetch);
    if (!lookup.ok) {
      const failure = subscriberLookupFailure(lookup.status);
      return NextResponse.json(
        { success: false, error: { code: failure.code, message: failure.message } },
        { status: failure.httpStatus },
      );
    }

    const env = deps.env ?? process.env;
    const cap = deps.sandboxCap ?? sandboxGrantCap();
    const now = deps.now ? deps.now() : new Date();
    let credits = await getShopperCredits(admin, auth.userId);
    const skipped: CreditRestoreSkip[] = [];
    for (const transactionId of transactionIds) {
      const verified = findVerifiedPurchase(lookup.subscriber, transactionId.trim());
      if (!verified) continue;
      const decision = decideClaimGrant(auth.userId, verified, env, cap, now);
      if (!decision.ok) {
        skipped.push({
          transactionId: verified.transactionId,
          reason: decisionSkipReason(decision.code, verified),
        });
        continue;
      }
      const granted = await grantVerifiedPurchase(admin, auth.userId, verified, {
        allowLegacyRpc: decision.sandbox,
      });
      if (granted.unavailable) {
        return NextResponse.json(
          { success: false, error: { code: 'purchases_unavailable', message: 'purchases temporarily unavailable' } },
          { status: 503 },
        );
      }
      if (!granted.success) {
        return NextResponse.json(
          { success: false, error: { code: 'purchase_failed', message: 'Drevvy could not restore these keys.' } },
          { status: 500 },
        );
      }
      if (granted.alreadyGrantedElsewhere) {
        skipped.push({ transactionId: verified.transactionId, reason: 'already_granted_elsewhere' });
        continue;
      }
      if (granted.alreadyGranted || !granted.granted) {
        skipped.push({
          transactionId: verified.transactionId,
          reason: granted.alreadyGranted ? 'already_granted' : 'refused',
        });
        credits = granted.credits;
        continue;
      }
      if (decision.sandbox) {
        cap.note(auth.userId, verified.transactionId, now);
      }
      credits = granted.credits;
    }

    return NextResponse.json({ data: creditBalanceData(credits), skipped });
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}
