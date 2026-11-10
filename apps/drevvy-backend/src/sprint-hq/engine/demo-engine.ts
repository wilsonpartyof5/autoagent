import { DEMO_CARDS } from '../fixtures/demo-cards';
import { DEMO_LOOP_MS, DEMO_SCRIPT, type DemoStep } from '../fixtures/demo-script';
import type { SprintCard } from '../types';

export type DemoProjection = {
  elapsedMs: number;
  step: DemoStep;
  cards: SprintCard[];
  simulatedApproval: boolean;
};

function assertDemoCards(cards: readonly SprintCard[]): void {
  for (const card of cards) {
    if (!/^DEMO-\d{3}$/.test(card.id)) {
      throw new Error('Demo engine refused a non-demo card');
    }
  }
}

/**
 * Pure projection. The clock selects a script step. Inputs are not mutated.
 * This module does not import the snapshot fixture.
 */
export function projectDemo(
  elapsedMs: number,
  script: readonly DemoStep[] = DEMO_SCRIPT,
  cards: readonly SprintCard[] = DEMO_CARDS,
): DemoProjection {
  assertDemoCards(cards);
  if (script.length === 0) {
    throw new Error('Demo script is empty');
  }
  const safe = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const looped = ((safe % DEMO_LOOP_MS) + DEMO_LOOP_MS) % DEMO_LOOP_MS;
  let step = script[0];
  for (const candidate of script) {
    if (candidate.atMs <= looped) step = candidate;
  }
  const merged = cards.map((card) => {
    const patch = step.patches.find((item) => item.id === card.id);
    if (!patch) {
      throw new Error(`Demo step ${step.id} is missing ${card.id}`);
    }
    const next: SprintCard = {
      ...card,
      lane: patch.lane,
      blocked: patch.blocked,
      blocker: patch.blocker,
      whoCanClear: patch.whoCanClear,
      needsDw: patch.needsDw,
      executionState: patch.executionState,
      evidenceState: patch.evidenceState,
      releaseAuthorized: patch.releaseAuthorized,
      headSha: patch.headSha,
      pr: patch.pr,
      ci: patch.ci,
      qaResult: patch.qaResult,
      securityResult: patch.securityResult,
      postDeployEvidence: patch.postDeployEvidence,
      nextStep: patch.nextStep,
      sourceMode: 'demo',
      sourceSystem: 'demo',
    };
    return next;
  });
  return {
    elapsedMs: looped,
    step,
    cards: merged,
    simulatedApproval: step.simulatedApproval,
  };
}

export function stepsForCard(cardId: string, script: readonly DemoStep[] = DEMO_SCRIPT): DemoStep[] {
  return script.filter((step) => step.cardId === cardId);
}
