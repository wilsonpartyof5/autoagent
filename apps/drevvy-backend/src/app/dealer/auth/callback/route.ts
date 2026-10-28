import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { dealerOtpType } from '@/lib/dealer/auth-redirect';
import { loadDealerMemberships } from '@/lib/dealer/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const login = new URL('/dealer/login', url.origin);
  const inbox = new URL('/dealer/inbox', url.origin);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = dealerOtpType(url.searchParams.get('type'));
  const supabase = await createClient();

  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) {
      login.searchParams.set('error', 'link');
      return NextResponse.redirect(login);
    }
    return finishDealerSignIn(supabase, login, inbox);
  }

  if (tokenHash && type) {
    const verified = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (verified.error) {
      login.searchParams.set('error', 'link');
      return NextResponse.redirect(login);
    }
    return finishDealerSignIn(supabase, login, inbox);
  }

  login.searchParams.set('error', 'link');
  return NextResponse.redirect(login);
}

async function finishDealerSignIn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  login: URL,
  inbox: URL,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    login.searchParams.set('error', 'link');
    return NextResponse.redirect(login);
  }
  try {
    const rooftops = await loadDealerMemberships(user.id);
    if (rooftops.length === 0) {
      await supabase.auth.signOut();
      login.searchParams.set('error', 'membership');
      return NextResponse.redirect(login);
    }
  } catch {
    // Membership lookup failed closed for a non-member and open for a blip.
    // A configured desk still checks the session on the next page.
  }
  return NextResponse.redirect(inbox);
}
