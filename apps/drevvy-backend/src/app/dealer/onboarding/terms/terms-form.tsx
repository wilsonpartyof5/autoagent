'use client';

import { useEffect, useMemo, useState } from 'react';

import { acceptDemoOnboarding } from '@/app/dealer/demo-actions';
import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';
import { ONBOARDING_FIXTURE_LABEL } from '@/lib/dealer/onboarding-acceptance';
import { TERMS_BOXES, TERMS_VERSION, rooftopName } from '@/lib/dealer/demo-org';

export function TermsForm({
  rooftopIds,
  errorFlag,
}: {
  rooftopIds: string[];
  errorFlag: string | null;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const allChecked = useMemo(
    () => TERMS_BOXES.every(box => checked[box.id]),
    [checked],
  );
  const ready = allChecked && rooftopIds.length > 0;

  useEffect(() => {
    if (errorFlag === 'session') setError('Drevvy could not start the demo desk session.');
    if (errorFlag === 'commitments') {
      setError('Message-only and itemized best out-the-door both have to be checked. Nothing was recorded.');
    }
    if (errorFlag === 'rooftops') {
      setError('Add at least the Lakeside Honda fixture rooftop before accepting. Nothing was recorded.');
    }
  }, [errorFlag]);

  return (
    <OnboardingFrame step="terms">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">In-network messaging terms</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          Terms version <b>{TERMS_VERSION}</b>
          {rooftopIds.length > 0
            ? ` · fixture rooftops: ${rooftopIds.map(rooftopName).join(', ')}`
            : ' · no rooftop linkage recorded yet'}
          . Check all to continue.
        </p>
        <p className="note">{ONBOARDING_FIXTURE_LABEL}. Checking these boxes does not accept terms for a live dealer account.</p>
        <form action={acceptDemoOnboarding}>
          {rooftopIds.map(id => (
            <input key={id} type="hidden" name="shownRooftop" value={id} />
          ))}
          {TERMS_BOXES.map(box => (
            <label key={box.id} className="chk">
              <input
                type="checkbox"
                name="commitment"
                value={box.id}
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
            Demo acceptor Derek Patel · Owner/GM · fixture only. No live legal acceptance and no charge.
          </p>
          {error ? (
            <p className="dn" role="alert">
              {error}
            </p>
          ) : null}
          <OnboardingNav
            backHref="/dealer/onboarding/routing"
            nextLabel={`Accept terms ${TERMS_VERSION}`}
            nextDisabled={!ready}
            submit
          />
        </form>
      </div>
    </OnboardingFrame>
  );
}
