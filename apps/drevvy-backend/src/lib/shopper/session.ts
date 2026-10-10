import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Shopper session gate for deal routes.
 * Matches the Sign in with Apple check: a Supabase user JWT, never the shared
 * inventory key. Sign-in routes themselves live in the SIWA slice.
 */
export class ShopperAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ShopperAuthError';
  }
}

export type ShopperSession = {
  userId: string;
};

const SHARED_KEY_MESSAGE = 'The inventory search key is not a shopper sign-in.';

export function rejectSharedInventoryCredential(
  authorization: string | null,
  apiKeyHeader: string | null,
  inventoryApiKey: string | undefined,
): ShopperAuthError | null {
  if (!inventoryApiKey) return null;
  if (apiKeyHeader && apiKeyHeader === inventoryApiKey) {
    return new ShopperAuthError(SHARED_KEY_MESSAGE, 401, 'shared_key_rejected');
  }
  const bearer = parseBearerToken(authorization);
  if (bearer && bearer === inventoryApiKey) {
    return new ShopperAuthError(SHARED_KEY_MESSAGE, 401, 'shared_key_rejected');
  }
  return null;
}

export async function requireShopperAuth(request: Request): Promise<ShopperSession> {
  const sharedKeyError = rejectSharedInventoryCredential(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
    process.env.INVENTORY_SEARCH_API_KEY,
  );
  if (sharedKeyError) throw sharedKeyError;

  const token = parseBearerToken(request.headers.get('authorization'));
  if (!token) {
    throw new ShopperAuthError('Sign in is required.', 401, 'unauthorized');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new ShopperAuthError('Shopper sign-in is not configured.', 503, 'service_unavailable');
  }

  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new ShopperAuthError('Your sign-in has expired. Please sign in again.', 401, 'unauthorized');
  }
  return { userId: user.id };
}

export function shopperAuthErrorResponse(error: ShopperAuthError): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: error.code, message: error.message } },
    { status: error.status },
  );
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
