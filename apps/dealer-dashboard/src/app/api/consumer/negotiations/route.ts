import { NextRequest, NextResponse } from 'next/server';

import { requireConsumerAuth } from '@/lib/consumer/auth';
import { createNegotiationCase, listNegotiationCases } from '@/lib/negotiation/cases';
import { negotiationErrorResponse } from '@/lib/negotiation/http';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const data = await listNegotiationCases(auth.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return negotiationErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireConsumerAuth(request);
    const body = await readJson(request);
    const data = await createNegotiationCase({
      consumerUserId: auth.userId,
      listingId: typeof body.listingId === 'string' ? body.listingId : '',
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return negotiationErrorResponse(error);
  }
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}
