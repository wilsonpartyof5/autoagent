'use client';

import { useState } from 'react';

import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';

export default function OnboardingRoutingPage() {
  const [routing, setRouting] = useState('round-robin');

  return (
    <OnboardingFrame step="routing">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">Conversation routing</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          How new shopper conversations get assigned.
        </p>
        {[
          ['round-robin', 'Round-robin', 'Across Salespeople at the rooftop'],
          ['bdc', 'BDC first', 'BDC picks up, then hands off'],
          ['queue', 'Unassigned queue', 'First to claim'],
        ].map(([id, title, body]) => (
          <label key={id} className="chk">
            <input
              type="radio"
              name="routing"
              checked={routing === id}
              onChange={() => setRouting(id)}
            />
            <div>
              <b>{title}</b>
              <div className="mut">{body}</div>
            </div>
          </label>
        ))}
        <div className="lab" style={{ margin: '12px 0 6px' }}>
          Reply alerts
        </div>
        <label className="chk">
          <input type="checkbox" defaultChecked />
          <div>
            Escalate to Sales Manager if no reply in <b>15 min</b>
          </div>
        </label>
        <label className="chk">
          <input type="checkbox" defaultChecked />
          <div>Push + email when shopper replies</div>
        </label>
        <OnboardingNav
          backHref="/dealer/onboarding/team"
          nextHref="/dealer/onboarding/terms"
          nextLabel="Continue"
        />
      </div>
    </OnboardingFrame>
  );
}
