import { DEMO_CARDS } from './demo-cards';
import { idlePoses } from '../roles';
import type { AnimState, EvidenceState, Lane, RoleId, SprintCard } from '../types';

/** Three minutes and twelve seconds. Inside the 2–4 minute brief. */
export const DEMO_LOOP_MS = 192_000;

export type DemoCardPatch = {
  id: string;
  lane: Lane;
  blocked: boolean;
  blocker: string | null;
  whoCanClear: string | null;
  needsDw: boolean;
  executionState: string;
  evidenceState: EvidenceState;
  releaseAuthorized: boolean | null;
  headSha: string | null;
  pr: string | null;
  ci: string | null;
  qaResult: string | null;
  securityResult: string | null;
  postDeployEvidence: string | null;
  nextStep: string;
};

export type DemoSpeech = { role: RoleId; text: string };

export type MiniBot = { desk: 'pivot' | 'flutter'; label: string };

export type DemoStep = {
  id: string;
  atMs: number;
  title: string;
  detail: string;
  cardId: string | null;
  actorRole: RoleId | null;
  eventType: string;
  poses: Record<RoleId, AnimState>;
  patches: readonly DemoCardPatch[];
  speech: DemoSpeech | null;
  miniBot: MiniBot | null;
  simulatedApproval: boolean;
};

function patchFrom(card: SprintCard): DemoCardPatch {
  return {
    id: card.id,
    lane: card.lane,
    blocked: card.blocked,
    blocker: card.blocker,
    whoCanClear: card.whoCanClear,
    needsDw: card.needsDw,
    executionState: card.executionState ?? 'Synthetic. Not started.',
    evidenceState: card.evidenceState,
    releaseAuthorized: card.releaseAuthorized,
    headSha: card.headSha,
    pr: card.pr,
    ci: card.ci,
    qaResult: card.qaResult,
    securityResult: card.securityResult,
    postDeployEvidence: card.postDeployEvidence,
    nextStep: card.nextStep ?? 'Not available',
  };
}

function buildScript(): readonly DemoStep[] {
  const patches = DEMO_CARDS.map(patchFrom);
  let poses = idlePoses();
  let miniBot: MiniBot | null = null;
  let simulatedApproval = false;
  const steps: DemoStep[] = [];

  const edit = (id: string): DemoCardPatch => {
    const found = patches.find((item) => item.id === id);
    if (!found) throw new Error(`Missing demo card ${id}`);
    return found;
  };

  const commit = (step: {
    id: string;
    atMs: number;
    title: string;
    detail: string;
    cardId?: string;
    actorRole?: RoleId;
    eventType: string;
    speech?: DemoSpeech;
  }) => {
    steps.push({
      id: step.id,
      atMs: step.atMs,
      title: step.title,
      detail: step.detail,
      cardId: step.cardId ?? null,
      actorRole: step.actorRole ?? null,
      eventType: step.eventType,
      poses: { ...poses },
      patches: patches.map((item) => ({ ...item })),
      speech: step.speech ?? null,
      miniBot: miniBot ? { ...miniBot } : null,
      simulatedApproval,
    });
  };

  commit({
    id: 'start',
    atMs: 0,
    title: 'Demo board is staged',
    detail: 'Three fictional cards sit in Backlog. Nothing here is the Nov 9 snapshot.',
    eventType: 'stage',
    speech: { role: 'main_pm', text: 'Cinema Demo is staged. These cards are fictional.' },
  });

  poses = { ...poses, main_pm: 'planning' };
  commit({
    id: 'prioritize',
    atMs: 6_000,
    title: 'Main PM sets a synthetic priority',
    detail: 'DEMO-002 is chosen first. Phase 1 discipline in this story: one builder.',
    cardId: 'DEMO-002',
    actorRole: 'main_pm',
    eventType: 'prioritize',
    speech: { role: 'main_pm', text: 'Synthetic priority: DEMO-002 goes first. One builder only.' },
  });

  poses = { ...poses, main_pm: 'idle', greg: 'triaging' };
  edit('DEMO-002').lane = 'ready';
  edit('DEMO-002').executionState = 'Synthetic Ready stamp by Greg.';
  edit('DEMO-002').nextStep = 'A fictional builder may start.';
  commit({
    id: 'mark-ready',
    atMs: 16_000,
    title: 'Greg marks DEMO-002 Ready',
    detail: 'Intake stamp is simulated. The snapshot backlog is not changed.',
    cardId: 'DEMO-002',
    actorRole: 'greg',
    eventType: 'ready',
    speech: { role: 'greg', text: 'DEMO-002 is Ready. Simulation only.' },
  });

  poses = { ...poses, greg: 'idle', pivot: 'building' };
  miniBot = { desk: 'pivot', label: 'DEMO-RUN-2' };
  edit('DEMO-002').lane = 'building';
  edit('DEMO-002').executionState = 'Synthetic Cursor run DEMO-RUN-2 is on the clock.';
  edit('DEMO-002').ci = 'running (synthetic)';
  edit('DEMO-002').nextStep = 'Wait for the fictional CI label.';
  commit({
    id: 'run-start',
    atMs: 30_000,
    title: 'Synthetic Cursor worker starts',
    detail: 'A temporary mini-bot appears at the backend desk. It is not a real cloud agent.',
    cardId: 'DEMO-002',
    actorRole: 'pivot',
    eventType: 'run_started',
    speech: { role: 'pivot', text: 'DEMO-RUN-2 started on DEMO-002. Not a connected run.' },
  });

  commit({
    id: 'ci-running',
    atMs: 44_000,
    title: 'Synthetic CI says running',
    detail: 'The status word is "running". There is no percent and no real check.',
    cardId: 'DEMO-002',
    actorRole: 'pivot',
    eventType: 'ci',
    speech: { role: 'pivot', text: 'Synthetic CI status: running.' },
  });

  poses = { ...poses, pivot: 'reviewing' };
  miniBot = null;
  edit('DEMO-002').lane = 'review';
  edit('DEMO-002').pr = 'DEMO-PR-2 (synthetic)';
  edit('DEMO-002').executionState = 'Synthetic pull request DEMO-PR-2 is open.';
  edit('DEMO-002').nextStep = 'Independent QA, still inside the script.';
  commit({
    id: 'pr-open',
    atMs: 58_000,
    title: 'Synthetic pull request opens',
    detail: 'DEMO-002 slides to Review because the script says so, not because GitHub moved it.',
    cardId: 'DEMO-002',
    actorRole: 'pivot',
    eventType: 'pr_opened',
    speech: { role: 'pivot', text: 'DEMO-PR-2 is a fictional pull request.' },
  });

  poses = { ...poses, pivot: 'idle', qa: 'reviewing' };
  edit('DEMO-002').executionState = 'Synthetic QA journey is in progress.';
  commit({
    id: 'qa-start',
    atMs: 70_000,
    title: 'QA starts a synthetic check',
    detail: 'QA is independent of the builder. This pass/fail is scripted.',
    cardId: 'DEMO-002',
    actorRole: 'qa',
    eventType: 'qa_start',
    speech: { role: 'qa', text: 'QA is checking DEMO-002. The author does not grade this.' },
  });

  poses = { ...poses, qa: 'blocked', pivot: 'blocked' };
  edit('DEMO-002').lane = 'building';
  edit('DEMO-002').blocked = true;
  edit('DEMO-002').blocker = 'Synthetic QA fail: the fictional journey evidence was missing.';
  edit('DEMO-002').whoCanClear = 'Pivot Ship';
  edit('DEMO-002').ci = 'failed (synthetic)';
  edit('DEMO-002').qaResult = 'Synthetic fail. Not a real test result.';
  edit('DEMO-002').evidenceState = 'prepared';
  edit('DEMO-002').executionState = 'Returned to Building after a scripted QA fail.';
  edit('DEMO-002').nextStep = 'Scripted repair.';
  commit({
    id: 'qa-fail',
    atMs: 82_000,
    title: 'Synthetic QA fail',
    detail: 'DEMO-002 returns to Building. A failed review does not disappear.',
    cardId: 'DEMO-002',
    actorRole: 'qa',
    eventType: 'qa_fail',
    speech: { role: 'qa', text: 'Synthetic fail. DEMO-002 goes back to Building.' },
  });

  poses = { ...poses, qa: 'idle', pivot: 'building' };
  miniBot = { desk: 'pivot', label: 'DEMO-RUN-2' };
  edit('DEMO-002').blocked = false;
  edit('DEMO-002').blocker = null;
  edit('DEMO-002').whoCanClear = null;
  edit('DEMO-002').ci = 'running (synthetic)';
  edit('DEMO-002').executionState = 'Synthetic repair run. Not a real retry policy.';
  edit('DEMO-002').nextStep = 'Open the same fictional PR again.';
  commit({
    id: 'repair',
    atMs: 96_000,
    title: 'Synthetic repair run',
    detail: 'The mini-bot returns. Nothing is auto-cancelled.',
    cardId: 'DEMO-002',
    actorRole: 'pivot',
    eventType: 'repair',
    speech: { role: 'pivot', text: 'Repair run on DEMO-002. Still fictional.' },
  });

  poses = { ...poses, greg: 'idle' };
  edit('DEMO-003').executionState = 'Still waiting on DEMO-002. Waiting is not stalled, and nothing is auto-cancelled.';
  commit({
    id: 'waiting-not-stalled',
    atMs: 104_000,
    title: 'DEMO-003 is waiting, not stalled',
    detail: 'A 30-minute silence would be a flag for investigation, not an automatic cancel. This beat is immediate and synthetic.',
    cardId: 'DEMO-003',
    actorRole: 'greg',
    eventType: 'waiting',
    speech: { role: 'greg', text: 'DEMO-003 is waiting. Waiting is not a stalled worker.' },
  });

  poses = { ...poses, pivot: 'reviewing' };
  miniBot = null;
  edit('DEMO-002').lane = 'review';
  edit('DEMO-002').executionState = 'Synthetic PR is open again after the repair.';
  edit('DEMO-002').nextStep = 'QA rerun inside the script.';
  commit({
    id: 'pr-again',
    atMs: 112_000,
    title: 'Fictional PR returns to Review',
    detail: 'Same synthetic id DEMO-PR-2. No GitHub write.',
    cardId: 'DEMO-002',
    actorRole: 'pivot',
    eventType: 'pr_opened',
    speech: { role: 'pivot', text: 'DEMO-PR-2 is back in Review. Still not a real pull request.' },
  });

  poses = { ...poses, pivot: 'idle', qa: 'validating' };
  edit('DEMO-002').lane = 'validation';
  edit('DEMO-002').evidenceState = 'independently_verified';
  edit('DEMO-002').qaResult = 'Synthetic pass by QA, not by the author.';
  edit('DEMO-002').ci = 'passed (synthetic)';
  edit('DEMO-002').executionState = 'Scripted QA pass. This is not production verification.';
  edit('DEMO-002').nextStep = 'Synthetic exact-head scan.';
  commit({
    id: 'qa-pass',
    atMs: 124_000,
    title: 'Synthetic QA pass',
    detail: 'DEMO-002 enters Validation inside the story. Prepared, verified, and released stay different words even here.',
    cardId: 'DEMO-002',
    actorRole: 'qa',
    eventType: 'qa_pass',
    speech: { role: 'qa', text: 'Synthetic QA pass on DEMO-002. Not a production result.' },
  });

  poses = { ...poses, qa: 'idle', security: 'reviewing' };
  edit('DEMO-002').headSha = 'DEMO-SHA-02 (synthetic, not a commit)';
  edit('DEMO-002').securityResult = 'Synthetic exact-head check for DEMO-SHA-02.';
  edit('DEMO-002').executionState = 'Security scanned a fictional SHA. Not an approval to release.';
  edit('DEMO-002').nextStep = 'Ask for a simulated approval.';
  commit({
    id: 'security-scan',
    atMs: 136_000,
    title: 'Security scans a fictional SHA',
    detail: 'DEMO-SHA-02 is not a git object. The shield does not mean approved.',
    cardId: 'DEMO-002',
    actorRole: 'security',
    eventType: 'security',
    speech: { role: 'security', text: 'Scanning DEMO-SHA-02. This SHA is not real.' },
  });

  poses = { ...poses, security: 'idle', main_pm: 'waiting_approval' };
  edit('DEMO-002').needsDw = true;
  edit('DEMO-002').executionState = 'Simulated approval requested. There is no approval button.';
  edit('DEMO-002').nextStep = 'The script will mark a simulated approval. DW is not asked.';
  commit({
    id: 'approval-requested',
    atMs: 148_000,
    title: 'Simulated approval requested',
    detail: 'The approval desk glows in the story. Phase A cannot approve or deploy.',
    cardId: 'DEMO-002',
    actorRole: 'main_pm',
    eventType: 'approval_requested',
    speech: { role: 'main_pm', text: 'Approval requested inside the simulation. This is not a real ask.' },
  });

  simulatedApproval = true;
  edit('DEMO-002').releaseAuthorized = true;
  edit('DEMO-002').needsDw = false;
  edit('DEMO-002').executionState = 'Simulated approval recorded in the script. Nothing was authorized.';
  edit('DEMO-002').nextStep = 'Move to Release-ready in the story only.';
  commit({
    id: 'simulated-approval',
    atMs: 160_000,
    title: 'Simulated approval',
    detail: 'Labeled simulated. It does not authorize a deploy, SQL, or a store submission.',
    cardId: 'DEMO-002',
    actorRole: 'main_pm',
    eventType: 'simulated_approval',
    speech: { role: 'main_pm', text: 'Simulated approval. Not a DW decision. Nothing was deployed.' },
  });

  poses = { ...poses, main_pm: 'planning' };
  edit('DEMO-002').lane = 'release_ready';
  edit('DEMO-002').executionState = 'Story-only Release-ready. A merge would still not be Live.';
  edit('DEMO-002').nextStep = 'Fictional post-deploy beat.';
  commit({
    id: 'release-ready',
    atMs: 170_000,
    title: 'Story reaches Release-ready',
    detail: 'Merged is not Live. This lane still waits on a deployment that did not happen.',
    cardId: 'DEMO-002',
    actorRole: 'main_pm',
    eventType: 'release_ready',
    speech: { role: 'main_pm', text: 'Release-ready in the story only. Merged is not Live.' },
  });

  poses = {
    main_pm: 'released',
    greg: 'released',
    pivot: 'released',
    flutter: 'released',
    qa: 'released',
    security: 'released',
  };
  edit('DEMO-002').lane = 'live';
  edit('DEMO-002').evidenceState = 'released';
  edit('DEMO-002').postDeployEvidence = 'Synthetic post-deploy note. No production deploy ran.';
  edit('DEMO-002').executionState = 'Fictional Live. There is no deployment and no post-deploy proof.';
  edit('DEMO-002').nextStep = 'The loop returns these cards to Backlog.';
  commit({
    id: 'fictional-release',
    atMs: 180_000,
    title: 'Fictional release celebration',
    detail: 'Bots celebrate a scripted confirmation. Production was not touched.',
    cardId: 'DEMO-002',
    actorRole: 'main_pm',
    eventType: 'fictional_release',
    speech: { role: 'main_pm', text: 'Simulated release. Nothing shipped.' },
  });

  if (steps[steps.length - 1].atMs >= DEMO_LOOP_MS) {
    throw new Error('Demo script must finish before the loop point');
  }
  if (steps[0].atMs !== 0) {
    throw new Error('Demo script must start at 0');
  }
  for (let index = 1; index < steps.length; index += 1) {
    if (steps[index].atMs <= steps[index - 1].atMs) {
      throw new Error('Demo script times must increase');
    }
  }
  return Object.freeze(steps.map((step) => Object.freeze({ ...step, patches: Object.freeze(step.patches.map((item) => Object.freeze(item))) })));
}

export const DEMO_SCRIPT: readonly DemoStep[] = buildScript();

export function demoStep(id: string): DemoStep {
  const found = DEMO_SCRIPT.find((step) => step.id === id);
  if (!found) throw new Error(`Unknown demo step ${id}`);
  return found;
}
