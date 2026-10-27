import Link from 'next/link';

import { OnboardingFrame } from '@/components/dealer/onboarding-frame';
import { TERMS_VERSION } from '@/lib/dealer/demo-org';

export const metadata = { title: 'You’re live' };

export default function OnboardingDonePage() {
  return (
    <OnboardingFrame step="done">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">You’re live</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          Terms {TERMS_VERSION} accepted Oct 27, 2026 12:41 PM ET by Derek Patel
          · 3 rooftops · 3 invites sent.
        </p>
        <div className="otd">
          <b>Your first conversation</b>
          <div className="mut" style={{ marginTop: 6 }}>
            Jordan · #A7F2 asked about a 2024 Toyota RAV4 XLE Premium at
            Lakeside Honda. Tip: reply with an itemized out-the-door.
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
