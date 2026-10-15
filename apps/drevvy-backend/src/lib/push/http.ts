import { NextResponse } from 'next/server';

import { ShopperAuthError, shopperAuthErrorResponse } from '@/lib/shopper/session';

import { PushError } from './events';

export function pushErrorResponse(error: unknown): NextResponse {
  if (error instanceof ShopperAuthError) return shopperAuthErrorResponse(error);
  if (error instanceof PushError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(JSON.stringify({
    event: 'shopper_push_failed',
    message: error instanceof Error ? error.message : 'unknown',
  }));
  return NextResponse.json(
    { success: false, error: { code: 'internal_error', message: 'Drevvy could not send this notification.' } },
    { status: 500 },
  );
}
