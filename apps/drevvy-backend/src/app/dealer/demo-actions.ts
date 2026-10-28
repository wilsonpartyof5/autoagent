'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  DEMO_DEALER_COOKIE,
  DEMO_SESSION_TTL_MS,
  demoCookieOptions,
  demoSessionSecret,
  sealDemoDealerSession,
} from '@/lib/dealer/demo-session';
import { createClient } from '@/lib/supabase/server';

export async function acceptDemoOnboarding() {
  const secret = demoSessionSecret();
  if (!secret) redirect('/dealer/onboarding/terms?error=session');
  const jar = await cookies();
  jar.set(
    DEMO_DEALER_COOKIE,
    sealDemoDealerSession(secret, Date.now()),
    demoCookieOptions(Math.floor(DEMO_SESSION_TTL_MS / 1000), process.env.NODE_ENV === 'production'),
  );
  redirect('/dealer/onboarding/done');
}

export async function signOutDealer() {
  const jar = await cookies();
  jar.set(
    DEMO_DEALER_COOKIE,
    '',
    demoCookieOptions(0, process.env.NODE_ENV === 'production'),
  );
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // The demo cookie is already cleared. The browser client signs out too.
  }
}
