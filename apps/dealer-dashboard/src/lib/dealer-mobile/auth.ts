import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export class DealerMobileApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'DealerMobileApiError';
  }
}

export type DealerMobileAuth = {
  token: string;
  user: User;
  supabase: SupabaseClient;
};

export function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export async function requireDealerMobileAuth(request: Request): Promise<DealerMobileAuth> {
  const token = parseBearerToken(request.headers.get('authorization'));
  if (!token) {
    throw new DealerMobileApiError('A valid sign-in token is required.', 401, 'unauthorized');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new DealerMobileApiError('The dealer service is not configured.', 503, 'service_unavailable');
  }

  const supabase = createClient(url, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new DealerMobileApiError('Your sign-in has expired. Please sign in again.', 401, 'unauthorized');
  }

  return { token, user, supabase };
}

export function dealerMobileErrorResponse(error: unknown): NextResponse {
  if (error instanceof DealerMobileApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error('[dealer-mobile] Unexpected error:', error);
  return NextResponse.json(
    { error: { code: 'internal_error', message: 'Drevvy could not finish this request.' } },
    { status: 500 },
  );
}
