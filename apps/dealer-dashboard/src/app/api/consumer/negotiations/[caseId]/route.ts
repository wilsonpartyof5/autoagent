import { NextRequest, NextResponse } from 'next/server';

import { requireConsumerAuth } from '@/lib/consumer/auth';
import { getNegotiationCase } from '@/lib/negotiation/cases';
import { negotiationErrorResponse } from '@/lib/negotiation/http';

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireConsumerAuth(request);
    const { caseId } = await context.params;
    const data = await getNegotiationCase(auth.userId, caseId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return negotiationErrorResponse(error);
  }
}
