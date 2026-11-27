import { NextRequest } from 'next/server';

import { handleConsumerAsk } from '@/lib/shopper/ask';

/**
 * POST /api/consumer/ask
 *
 * Shopper JWT, checked with Supabase auth.getUser. No shared inventory key.
 * conversationId is a server-signed `<uuid>.<hmac>` bound to that shopper.
 * It is echoed when the signature matches and is not written to the database.
 *
 * 200 { reply, conversationId, filters, listings, total }
 * Errors: { success: false, error: { code, message } }
 *   400 invalid_request, 401 unauthorized, 403 dealer_account,
 *   403 conversation_forbidden, 429 rate_limited, 503 ask_unavailable
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleConsumerAsk(request, { origin: request.nextUrl.origin });
}
