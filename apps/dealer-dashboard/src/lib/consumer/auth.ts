import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { parseBearerToken } from '@/lib/dealer-mobile/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export class ConsumerAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ConsumerAuthError';
  }
}

export type ConsumerAuth = {
  token: string;
  userId: string;
  supabase: SupabaseClient;
};

export type PublicConsumerSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  consumerUserId: string;
};

const SHARED_KEY_MESSAGE = 'The inventory search key is not a consumer sign-in.';

export function rejectSharedInventoryCredential(
  authorization: string | null,
  apiKeyHeader: string | null,
  inventoryApiKey: string | undefined,
): ConsumerAuthError | null {
  if (!inventoryApiKey) return null;
  if (apiKeyHeader && apiKeyHeader === inventoryApiKey) {
    return new ConsumerAuthError(SHARED_KEY_MESSAGE, 401, 'shared_key_rejected');
  }
  const bearer = parseBearerToken(authorization);
  if (bearer && bearer === inventoryApiKey) {
    return new ConsumerAuthError(SHARED_KEY_MESSAGE, 401, 'shared_key_rejected');
  }
  return null;
}

export function publicConsumerSession(input: {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  userId?: string | null;
}): PublicConsumerSession {
  if (!input.accessToken || !input.refreshToken || !input.userId) {
    throw new ConsumerAuthError('Sign in did not return a session.', 502, 'session_missing');
  }
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: input.expiresAt ?? null,
    consumerUserId: input.userId,
  };
}

export async function requireConsumerAuth(request: Request): Promise<ConsumerAuth> {
  const sharedKeyError = rejectSharedInventoryCredential(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
    process.env.INVENTORY_SEARCH_API_KEY,
  );
  if (sharedKeyError) throw sharedKeyError;

  const token = parseBearerToken(request.headers.get('authorization'));
  if (!token) {
    throw new ConsumerAuthError('Sign in is required.', 401, 'unauthorized');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new ConsumerAuthError('Consumer sign-in is not configured.', 503, 'service_unavailable');
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
    throw new ConsumerAuthError('Your sign-in has expired. Please sign in again.', 401, 'unauthorized');
  }

  return { token, userId: user.id, supabase };
}

export function consumerAuthErrorResponse(error: unknown): NextResponse {
  if (error instanceof ConsumerAuthError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(JSON.stringify({
    event: 'consumer_auth_failed',
    message: error instanceof Error ? error.message : 'unknown',
  }));
  return NextResponse.json(
    { success: false, error: { code: 'internal_error', message: 'Drevvy could not finish sign-in.' } },
    { status: 500 },
  );
}

export async function ensureConsumerProfile(user: User): Promise<'active' | 'disabled'> {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from('consumer_profiles')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing?.status === 'active' || existing?.status === 'disabled') {
    return existing.status;
  }

  const { error: insertError } = await admin.from('consumer_profiles').insert({
    user_id: user.id,
    status: 'active',
  });
  if (insertError) throw new Error(insertError.message);

  const { error: eventError } = await admin.from('consumer_profile_status_events').insert({
    user_id: user.id,
    status: 'active',
  });
  if (eventError) throw new Error(eventError.message);
  return 'active';
}

export async function recordConsumerAuthEvent(input: {
  eventName: 'consumer_signed_in' | 'consumer_signed_out';
  consumerUserId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const sessionId = randomUUID();
    const occurredAt = new Date().toISOString();
    const { error: sessionError } = await admin.from('app_sessions').upsert(
      {
        id: sessionId,
        provider: 'consumer_auth',
        last_activity_at: occurredAt,
      },
      { onConflict: 'id' },
    );
    if (sessionError) throw sessionError;
    const { error } = await admin.from('app_events').insert({
      flow_id: sessionId,
      event_name: input.eventName,
      source: 'dashboard',
      provider: 'consumer_auth',
      payload: {
        event_source: 'consumer_ios',
        consumer_user_id: input.consumerUserId,
      },
      occurred_at: occurredAt,
    });
    if (error) throw error;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'consumer_auth_event_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
}

export function anonAuthClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new ConsumerAuthError('Consumer sign-in is not configured.', 503, 'service_unavailable');
  }
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
