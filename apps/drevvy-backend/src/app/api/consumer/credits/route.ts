import { NextRequest } from 'next/server';

import { requireConsumerAuth } from '@/lib/consumer/auth';
import { handleGetCreditBalance } from '@/lib/shopper/credit-balance-handler';
import { handleCreditPurchase } from '@/lib/shopper/credit-purchase';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleGetCreditBalance(request, {
    requireAuth: requireConsumerAuth,
    supabase: createAdminClient,
  });
}

export async function POST(request: NextRequest) {
  return handleCreditPurchase(request);
}
