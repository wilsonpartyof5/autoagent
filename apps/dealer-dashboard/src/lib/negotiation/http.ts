import { NextResponse } from 'next/server';

import { ConsumerAuthError } from '@/lib/consumer/auth';
import { NegotiationError } from '@/lib/negotiation/cases';

export function negotiationErrorResponse(error: unknown): NextResponse {
  if (error instanceof NegotiationError || error instanceof ConsumerAuthError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(JSON.stringify({
    event: 'negotiation_request_failed',
    message: error instanceof Error ? error.message : 'unknown',
  }));
  return NextResponse.json(
    { success: false, error: { code: 'internal_error', message: 'Drevvy could not finish this request.' } },
    { status: 500 },
  );
}
