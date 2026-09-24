import { NextRequest, NextResponse } from 'next/server';

import { requireConsumerAuth } from '@/lib/consumer/auth';
import { approveShopperMandate } from '@/lib/negotiation/cases';
import { negotiationErrorResponse } from '@/lib/negotiation/http';

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireConsumerAuth(request);
    const { caseId } = await context.params;
    const body = await request.json().catch(() => null);
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const data = await approveShopperMandate({
      consumerUserId: auth.userId,
      caseId,
      idempotencyKey: typeof record.idempotencyKey === 'string' ? record.idempotencyKey : null,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return negotiationErrorResponse(error);
  }
}
