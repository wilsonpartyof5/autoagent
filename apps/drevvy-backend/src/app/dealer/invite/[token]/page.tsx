import type { Metadata } from 'next';

import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';
import { DEMO_GROUP } from '@/lib/dealer/demo-org';

export const metadata: Metadata = { title: 'Accept invite' };

export default async function DealerInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <OnboardingFrame step="invite">
      <div className="g card" style={{ padding: 28 }}>
        <div className="crumb">URL target: /dealer/invite/{token}</div>
        <div className="h1">You’re invited to Drevvy</div>
        <p className="mut" style={{ margin: '8px 0 16px' }}>
          Maya R. invited you to <b>{DEMO_GROUP.name}</b> as <b>Owner/GM</b>.
        </p>
        <div className="note">
          Drevvy shoppers message you directly. Chat is for transparency and
          answering questions — itemized out-the-door, availability, vehicle
          details. Day-to-day is free; $300 only when you mark sold.
        </div>
        <OnboardingNav
          backHref="/dealer/login"
          nextHref="/dealer/verify"
          nextLabel="Accept invite"
        />
      </div>
    </OnboardingFrame>
  );
}
