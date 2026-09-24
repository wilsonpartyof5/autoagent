import { NextRequest, NextResponse } from 'next/server';

import {
  anonAuthClient,
  consumerAuthErrorResponse,
  ConsumerAuthError,
  ensureConsumerProfile,
  publicConsumerSession,
  recordConsumerAuthEvent,
} from '@/lib/consumer/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    let body: { identityToken?: unknown; nonce?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ConsumerAuthError('Sign in with Apple did not include a token.', 400, 'invalid_request');
    }

    const identityToken = typeof body.identityToken === 'string' ? body.identityToken.trim() : '';
    const nonce = typeof body.nonce === 'string' && body.nonce.trim() ? body.nonce.trim() : undefined;
    if (!identityToken || identityToken.split('.').length !== 3 || identityToken.length > 20000) {
      throw new ConsumerAuthError('Sign in with Apple did not include a token.', 400, 'invalid_request');
    }

    const supabase = anonAuthClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce,
    });
    if (error || !data.session || !data.user) {
      throw new ConsumerAuthError('Apple sign-in was rejected.', 401, 'apple_rejected');
    }

    const status = await ensureConsumerProfile(data.user);
    if (status === 'disabled') {
      await createAdminClient().auth.admin.signOut(data.session.access_token);
      throw new ConsumerAuthError('This Drevvy account is disabled.', 403, 'account_disabled');
    }

    await recordConsumerAuthEvent({
      eventName: 'consumer_signed_in',
      consumerUserId: data.user.id,
    });

    return NextResponse.json({
      success: true,
      data: publicConsumerSession({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        userId: data.user.id,
      }),
    });
  } catch (error) {
    return consumerAuthErrorResponse(error);
  }
}
