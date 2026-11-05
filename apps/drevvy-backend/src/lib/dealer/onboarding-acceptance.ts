/**
 * Demo-desk record of rooftop linkage plus the two in-network commitments.
 * Test fixture only. This does not accept legal terms for a live dealer,
 * does not write dealerships or user_dealerships, and does not charge.
 */

import { DEMO_ROOFTOPS, TERMS_VERSION } from './demo-org';

export const REQUIRED_ONBOARDING_COMMITMENTS = ['message-only', 'itemized-otd'] as const;

export const ONBOARDING_FIXTURE_LABEL =
  'TEST FIXTURE · demo desk · not a live legal acceptance';

export type OnboardingFixtureRecord = {
  fixture: true;
  persistence: 'isolated-demo';
  label: typeof ONBOARDING_FIXTURE_LABEL;
  termsVersion: typeof TERMS_VERSION;
  rooftopIds: string[];
  commitments: string[];
  acceptedAt: string;
  acceptor: 'demo-derek-patel';
  legalAcceptance: false;
  chargedCents: 0;
  liveWrite: false;
};

export type OnboardingFixtureResult =
  | { ok: true; record: OnboardingFixtureRecord }
  | { ok: false; error: 'rooftops' | 'commitments' };

const records: OnboardingFixtureRecord[] = [];

export function resetOnboardingFixtures(): void {
  records.length = 0;
}

export function listOnboardingFixtures(): OnboardingFixtureRecord[] {
  return records.map((record) => ({ ...record, rooftopIds: [...record.rooftopIds], commitments: [...record.commitments] }));
}

export function knownDemoRooftopIds(ids: readonly string[]): string[] {
  const allowed = new Set(DEMO_ROOFTOPS.map((rooftop) => rooftop.id));
  const unique: string[] = [];
  for (const id of ids) {
    if (!allowed.has(id as (typeof DEMO_ROOFTOPS)[number]['id'])) continue;
    if (!unique.includes(id)) unique.push(id);
  }
  return unique;
}

export function recordOnboardingFixture(input: {
  rooftopIds: readonly string[];
  commitments: readonly string[];
  now: string;
}): OnboardingFixtureResult {
  const rooftopIds = knownDemoRooftopIds(input.rooftopIds);
  if (rooftopIds.length === 0 || !rooftopIds.includes('lakeside')) {
    return { ok: false, error: 'rooftops' };
  }
  const commitments = [...new Set(input.commitments.map((item) => item.trim()).filter(Boolean))];
  for (const required of REQUIRED_ONBOARDING_COMMITMENTS) {
    if (!commitments.includes(required)) return { ok: false, error: 'commitments' };
  }
  const record: OnboardingFixtureRecord = {
    fixture: true,
    persistence: 'isolated-demo',
    label: ONBOARDING_FIXTURE_LABEL,
    termsVersion: TERMS_VERSION,
    rooftopIds,
    commitments,
    acceptedAt: input.now,
    acceptor: 'demo-derek-patel',
    legalAcceptance: false,
    chargedCents: 0,
    liveWrite: false,
  };
  records.push(record);
  return { ok: true, record };
}
