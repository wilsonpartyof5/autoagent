'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  DEMO_DEALER_COOKIE,
  DEMO_ROOFTOPS_COOKIE,
  DEMO_SESSION_TTL_MS,
  demoCookieOptions,
  demoSessionSecret,
  sealDemoDealerSession,
} from '@/lib/dealer/demo-session';
import { knownDemoRooftopIds, recordOnboardingFixture } from '@/lib/dealer/onboarding-acceptance';
import { createClient } from '@/lib/supabase/server';

export async function saveDemoRooftops(formData: FormData) {
  const rooftopIds = knownDemoRooftopIds(formData.getAll('rooftop').map((value) => String(value)));
  if (!rooftopIds.includes('lakeside')) redirect('/dealer/onboarding/rooftops?error=rooftops');
  const jar = await cookies();
  jar.set(
    DEMO_ROOFTOPS_COOKIE,
    rooftopIds.join(','),
    demoCookieOptions(Math.floor(DEMO_SESSION_TTL_MS / 1000), process.env.NODE_ENV === 'production'),
  );
  redirect('/dealer/onboarding/team');
}

export async function acceptDemoOnboarding(formData: FormData) {
  const secret = demoSessionSecret();
  if (!secret) redirect('/dealer/onboarding/terms?error=session');
  const jar = await cookies();
  const rooftopIds = (jar.get(DEMO_ROOFTOPS_COOKIE)?.value ?? '').split(',').filter(Boolean);
  const commitments = formData.getAll('commitment').map((value) => String(value));
  const recorded = recordOnboardingFixture({
    rooftopIds,
    commitments,
    now: new Date().toISOString(),
  });
  if (!recorded.ok) redirect(`/dealer/onboarding/terms?error=${recorded.error}`);
  jar.set(
    DEMO_DEALER_COOKIE,
    sealDemoDealerSession(secret, Date.now(), DEMO_SESSION_TTL_MS, recorded.record),
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
