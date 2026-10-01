import { NextRequest, NextResponse } from 'next/server';

import {
  anonAuthClient,
  consumerAuthErrorResponse,
  ConsumerAuthError,
  ensureConsumerProfile,
  publicConsumerSession,
} from '@/lib/consumer/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    let body: { refreshToken?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ConsumerAuthError('A refresh token is required.', 400, 'invalid_request');
    }
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';
    if (!refreshToken || refreshToken.length > 10000) {
      throw new ConsumerAuthError('A refresh token is required.', 400, 'invalid_request');
    }

    const supabase = anonAuthClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      throw new ConsumerAuthError('Your sign-in has expired. Please sign in again.', 401, 'unauthorized');
    }

    const status = await ensureConsumerProfile(data.user);
    if (status === 'disabled') {
      await createAdminClient().auth.admin.signOut(data.session.access_token);
      throw new ConsumerAuthError('This Drevvy account is disabled.', 403, 'account_disabled');
    }

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
