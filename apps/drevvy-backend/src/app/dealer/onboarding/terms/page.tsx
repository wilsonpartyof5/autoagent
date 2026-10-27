'use client';

import { useMemo, useState } from 'react';

import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';
import { TERMS_BOXES, TERMS_VERSION } from '@/lib/dealer/demo-org';

export default function OnboardingTermsPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = useMemo(
    () => TERMS_BOXES.every(box => checked[box.id]),
    [checked]
  );

  return (
    <OnboardingFrame step="terms">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">In-network messaging terms</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          Terms version <b>{TERMS_VERSION}</b> · applies to Lakeside Honda,
          Midtown Toyota, Airport Kia. Check all to continue.
        </p>
        {TERMS_BOXES.map(box => (
          <label key={box.id} className="chk">
            <input
              type="checkbox"
              checked={Boolean(checked[box.id])}
              onChange={event =>
                setChecked(current => ({
                  ...current,
                  [box.id]: event.target.checked,
                }))
              }
            />
            <div>
              <b>{box.title}</b>
              <div className="mut">{box.body}</div>
            </div>
          </label>
        ))}
        <p className="mut" style={{ marginTop: 6 }}>
          Accepting as Derek Patel · Owner/GM · will record Oct 27, 2026 12:41 PM
          ET
        </p>
        <OnboardingNav
          backHref="/dealer/onboarding/routing"
          nextHref="/dealer/onboarding/done"
          nextLabel={`Accept terms ${TERMS_VERSION}`}
          nextDisabled={!allChecked}
        />
      </div>
    </OnboardingFrame>
  );
}
