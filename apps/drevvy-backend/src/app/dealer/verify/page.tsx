'use client';

import { useState } from 'react';

import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';

export default function DealerVerifyPage() {
  const [code, setCode] = useState('730154');
  const [name, setName] = useState('Derek Patel');
  const [title, setTitle] = useState('General Manager');

  return (
    <OnboardingFrame step="verify">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">Verify work email</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          Demo code. Nothing is sent to derek@lakesidehonda.com
        </p>
        <label className="lab" htmlFor="verify-code">
          One-time code
        </label>
        <input
          id="verify-code"
          className="inp"
          value={code}
          onChange={event => setCode(event.target.value)}
        />
        <label className="lab" htmlFor="verify-name">
          Full name
        </label>
        <input
          id="verify-name"
          className="inp"
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <label className="lab" htmlFor="verify-title">
          Title
        </label>
        <input
          id="verify-title"
          className="inp"
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <OnboardingNav
          backHref="/dealer/invite/demo"
          nextHref="/dealer/onboarding/org"
          nextLabel="Continue"
        />
      </div>
    </OnboardingFrame>
  );
}
