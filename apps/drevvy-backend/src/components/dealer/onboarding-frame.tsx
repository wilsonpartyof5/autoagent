'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/glass/glass-theme';
import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from '@/lib/dealer/demo-org';

export function OnboardingFrame({
  step,
  children,
}: {
  step: OnboardingStepId;
  children: ReactNode;
}) {
  const current = ONBOARDING_STEPS.findIndex(item => item.id === step);

  return (
    <div className="ob">
      <div className="top g" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link className="logo" href="/dealer/login">
            D
          </Link>
          <div className="wm">
            Drevvy <span>Dealer</span>
          </div>
        </div>
        <ThemeToggle />
      </div>
      <div className="stepper">
        {ONBOARDING_STEPS.map((item, index) => {
          const state =
            index < current ? 'step done' : index === current ? 'step on' : 'step';
          return (
            <div key={item.id} className={state}>
              <div className="dot">{index < current ? '✓' : index + 1}</div>
              {item.label}
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}

export function OnboardingNav({
  backHref,
  nextHref,
  nextLabel,
  nextDisabled,
}: {
  backHref: string;
  nextHref?: string;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 20,
      }}
    >
      <Link className="btn2" href={backHref}>
        Back
      </Link>
      {nextHref ? (
        <Link
          className="btn"
          href={nextHref}
          aria-disabled={nextDisabled}
          style={nextDisabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          {nextLabel}
        </Link>
      ) : (
        <button type="submit" className="btn" disabled={nextDisabled}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}
