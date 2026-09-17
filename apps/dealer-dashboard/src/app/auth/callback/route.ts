import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  'email',
  'email_change',
  'invite',
  'magiclink',
  'recovery',
  'signup',
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = getSafeNextPath(url.searchParams.get('next'));
  const supabase = await createClient();

  let error: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && isEmailOtpType(type)) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    error = result.error;
  } else {
    error = new Error('The confirmation link is incomplete or invalid.');
  }

  if (!error) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  console.error('[auth/callback] Unable to establish session:', error.message);
  const authUrl = new URL('/auth', url.origin);
  authUrl.searchParams.set('error', 'confirmation_failed');
  return NextResponse.redirect(authUrl);
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_OTP_TYPES.includes(value as EmailOtpType);
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/onboarding';
  }

  return value;
}
