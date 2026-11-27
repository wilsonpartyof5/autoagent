import { NextRequest } from 'next/server';

import { handleConsumerAsk } from '@/lib/shopper/ask';

/**
 * POST /api/consumer/ask
 *
 * Shopper JWT. No shared inventory key.
 * conversationId is a client-side thread id. It is echoed or generated and
 * is not written to the database.
 *
 * 200 { reply, conversationId, filters, listings, total }
 * Errors: { success: false, error: { code, message } }
 *   400 invalid_request, 401 unauthorized, 403 dealer_account,
 *   429 rate_limited, 503 ask_unavailable
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleConsumerAsk(request, { origin: request.nextUrl.origin });
}
