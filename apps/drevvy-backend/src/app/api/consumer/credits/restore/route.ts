import { NextRequest } from 'next/server';

import { handleCreditRestore } from '@/lib/shopper/credit-restore';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCreditRestore(request);
}
