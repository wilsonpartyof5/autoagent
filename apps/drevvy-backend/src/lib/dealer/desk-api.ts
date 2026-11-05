import { NextResponse } from 'next/server';

import { gateLiveDealerSession } from './activation-gate';
import {
  DealerAuthError,
  dealerAuthErrorResponse,
  dealerPreviewEnabled,
  requireDealerApi,
  type DealerSession,
} from './session';

export async function withDealerApi(
  request: Request,
  live: (session: DealerSession) => Promise<NextResponse> | NextResponse,
  preview: () => NextResponse | Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const session = await requireDealerApi(request);
    const activation = await gateLiveDealerSession(session, request);
    if (!activation.ok) {
      throw new DealerAuthError(activation.message, 403, activation.code);
    }
    return await live(session);
  } catch (error) {
    if (error instanceof DealerAuthError) {
      if (error.code === 'unauthorized' && dealerPreviewEnabled()) {
        return await preview();
      }
      return dealerAuthErrorResponse(error);
    }
    console.error(JSON.stringify({
      event: 'dealer_api_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
