import Link from 'next/link';
import { cookies } from 'next/headers';

import { OnboardingFrame } from '@/components/dealer/onboarding-frame';
import {
  DEMO_DEALER_COOKIE,
  demoSessionSecret,
  readDemoAcceptance,
} from '@/lib/dealer/demo-session';
import { rooftopName } from '@/lib/dealer/demo-org';

export const metadata = { title: 'You’re live' };

export default async function OnboardingDonePage() {
  const jar = await cookies();
  const secret = demoSessionSecret();
  const acceptance = secret
    ? readDemoAcceptance(jar.get(DEMO_DEALER_COOKIE)?.value, secret, Date.now())
    : null;
  const rooftops = acceptance?.rooftopIds.map(rooftopName).join(', ') ?? '';

  return (
    <OnboardingFrame step="done">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">Demo desk ready</div>
        {acceptance ? (
          <p className="mut" style={{ margin: '6px 0 14px' }}>
            {acceptance.label}. Terms {acceptance.termsVersion} recorded for{' '}
            {rooftops}. Commitments: {acceptance.commitments.join(', ')}. Nothing
            was charged. This is not a live legal acceptance.
          </p>
        ) : (
          <p className="mut" style={{ margin: '6px 0 14px' }}>
            Demo preview. No rooftop linkage or terms acceptance is recorded.
            Go back through rooftops and terms. This page does not accept terms
            for a live dealer.
          </p>
        )}
        <div className="otd">
          <b>Your first conversation</b>
          <div className="mut" style={{ marginTop: 6 }}>
            Jordan · #A7F2 is a labeled demo row, not a live shopper. Reply
            with an itemized out-the-door when the opener asks for one.
          </div>
        </div>
        <Link
          className="btn"
          href="/dealer/inbox"
          style={{ width: '100%', textAlign: 'center', marginTop: 16 }}
        >
          Open Inbox
        </Link>
      </div>
    </OnboardingFrame>
  );
}
