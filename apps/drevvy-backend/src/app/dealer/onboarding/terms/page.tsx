import { cookies } from 'next/headers';

import { DEMO_ROOFTOPS_COOKIE } from '@/lib/dealer/demo-session';
import { knownDemoRooftopIds } from '@/lib/dealer/onboarding-acceptance';
import { TermsForm } from './terms-form';

export const metadata = { title: 'In-network messaging terms' };

export default async function OnboardingTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const rooftopIds = knownDemoRooftopIds(
    (jar.get(DEMO_ROOFTOPS_COOKIE)?.value ?? '').split(',').filter(Boolean),
  );
  return <TermsForm rooftopIds={rooftopIds} errorFlag={params.error ?? null} />;
}
