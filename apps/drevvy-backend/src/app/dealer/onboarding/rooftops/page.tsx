'use client';

import { useState } from 'react';

import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';
import { DEMO_ROOFTOPS } from '@/lib/dealer/demo-org';

export default function OnboardingRooftopsPage() {
  const [selected, setSelected] = useState<string[]>(DEMO_ROOFTOPS.map(item => item.id));

  return (
    <OnboardingFrame step="rooftops">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">Add rooftops</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          Search by name — we prefill address and inventory from MarketCheck.
        </p>
        <input className="inp" defaultValue="Lakeside Honda, Atlanta" />
        <div className="otd" style={{ marginTop: 12 }}>
          <b>Lakeside Honda</b> <span className="chip c-sold">MarketCheck match</span>
          <div className="mut">2100 Lakeside Pkwy, Atlanta GA · 214 vehicles</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginTop: 10,
            }}
          >
            <div>
              <div className="lab">Hours</div>
              <input className="inp" defaultValue="Mon–Sat 9–8, Sun closed" />
            </div>
            <div>
              <div className="lab">Doc fee</div>
              <input className="inp" defaultValue="$699" />
            </div>
          </div>
        </div>
        {DEMO_ROOFTOPS.filter(item => item.id !== 'lakeside').map(rooftop => (
          <label key={rooftop.id} className="chk" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={selected.includes(rooftop.id)}
              onChange={() =>
                setSelected(current =>
                  current.includes(rooftop.id)
                    ? current.filter(id => id !== rooftop.id)
                    : [...current, rooftop.id]
                )
              }
            />
            <div>
              <b>{rooftop.name}</b>
              <div className="mut">
                {rooftop.vehicles} vehicles · doc fee {rooftop.docFee}
              </div>
            </div>
          </label>
        ))}
        <p className="mut">DMS connection optional — add later in Settings.</p>
        <OnboardingNav
          backHref="/dealer/onboarding/org"
          nextHref="/dealer/onboarding/team"
          nextLabel="Continue"
        />
      </div>
    </OnboardingFrame>
  );
}
