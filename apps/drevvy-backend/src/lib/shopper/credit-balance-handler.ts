import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { consumerAuthErrorResponse } from '@/lib/consumer/auth';
import { creditBalanceData } from '@/lib/shopper/credit-purchases';
import { getShopperCredits } from '@/lib/shopper/credits';

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
    return NextResponse.json({ data: creditBalanceData(credits) });
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}
