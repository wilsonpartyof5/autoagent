'use client';

import { useState } from 'react';

import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';
import { DEMO_GROUP } from '@/lib/dealer/demo-org';

export default function OnboardingOrgPage() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState<string>(DEMO_GROUP.name);

  return (
    <OnboardingFrame step="org">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">Dealer group</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          Your group owns rooftops, team and billing.
        </p>
        <label className="chk">
          <input
            type="radio"
            name="group-mode"
            checked={mode === 'create'}
            onChange={() => setMode('create')}
          />
          <div>
            <b>Create new group</b>
          </div>
        </label>
        <label className="chk">
          <input
            type="radio"
            name="group-mode"
            checked={mode === 'join'}
            onChange={() => setMode('join')}
          />
          <div>
            <b>Join existing group</b>
            <div className="mut">Requires approval from that group’s Owner/GM</div>
          </div>
        </label>
        <label className="lab" htmlFor="group-name">
          Group name
        </label>
        <input
          id="group-name"
          className="inp"
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <OnboardingNav
          backHref="/dealer/verify"
          nextHref="/dealer/onboarding/rooftops"
          nextLabel="Continue"
        />
      </div>
    </OnboardingFrame>
  );
}
