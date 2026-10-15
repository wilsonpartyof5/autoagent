import { NextRequest, NextResponse } from 'next/server';

import {
  anonAuthClient,
  consumerAuthErrorResponse,
  ConsumerAuthError,
  ensureConsumerProfile,
  publicConsumerSession,
  recordConsumerAuthEvent,
} from '@/lib/consumer/auth';
import { readGoogleClientIds, verifyGoogleIdToken } from '@/lib/consumer/google';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/consumer/auth/google
 *
 * Body matches Sign in with Apple: { "identityToken": "...", "nonce": "..." }.
 * The Google ID token is checked against Google's JWKS, then the shopper is
 * signed in with the same Supabase session and consumer profile as Apple.
 * When GOOGLE_OAUTH_CLIENT_IDS is unset, the route responds 503.
 */

export async function POST(request: NextRequest) {
  try {
    const clientIds = readGoogleClientIds(process.env.GOOGLE_OAUTH_CLIENT_IDS);

    let body: { identityToken?: unknown; nonce?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ConsumerAuthError('Sign in with Google did not include a token.', 400, 'invalid_request');
    }

    const identityToken = typeof body.identityToken === 'string' ? body.identityToken.trim() : '';
    const nonce = typeof body.nonce === 'string' && body.nonce.trim() ? body.nonce.trim() : undefined;
    if (!identityToken || identityToken.split('.').length !== 3 || identityToken.length > 20000) {
      throw new ConsumerAuthError('Sign in with Google did not include a token.', 400, 'invalid_request');
    }

    await verifyGoogleIdToken({ identityToken, nonce, clientIds });

    const supabase = anonAuthClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: identityToken,
      nonce,
    });
    if (error || !data.session || !data.user) {
      throw new ConsumerAuthError('Google sign-in was rejected.', 401, 'google_rejected');
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
