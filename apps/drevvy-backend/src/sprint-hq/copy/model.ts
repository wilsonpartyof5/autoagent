/**
 * Operating-model copy reflected from the Nov 10 v2 proposal.
 * Summarized for the dashboard. Not a transcript of the source PDF.
 */

export const WIP_RULES = [
  'Phase 1 is one manual cycle with one builder, dispatched by Main PM.',
  'Two builders, one backend and one mobile, is a later phase and needs a separate DW decision.',
  'The standing limit discussed for that later phase is two active builders. QA and Security sit outside that cap.',
  'QA does not test work it authored. Security does not approve work it built. Nobody approves their own changes.',
  'At most three committed sprint outcomes at a time. This view has no committed sprint baseline.',
  'Blocked is a flag with a named clearer. The card stays in its lane.',
  'A merged pull request is not Live.',
] as const;

export const PHASE_1_PILOT = {
  title: 'Phase 1 pilot — one manual cycle',
  status: 'Proposed. Not started. Not a committed sprint baseline.',
  goal: 'Prove one shopper journey end to end.',
  environment: 'Local first. Any hosted staging needs a separate DW approval. Market intelligence stays off for users.',
  builders: 'One builder, dispatched by Main PM. Automatic next-card dispatch is not part of Phase 1.',
  doneMeans:
    'Independent QA reruns the journey, Security checks that exact head, and an evidence path is recorded. Author tests alone do not count as done.',
  outOfScope: 'Hosted SQL, deploys, publication, store submissions, payments, and dealer contact.',
  candidates: [
    'S1-a — wire the parser into a local build, market-intelligence flag off.',
    'S1-b — prove one shopper journey end to end on the local stack.',
    'Independent QA on the sign-out spinner fix (G-126 · S126-2).',
  ],
  beforeCommit:
    'Greg reconciles the parent outcome, G-135, and acceptance against the master sheet before anything is committed. G-128 + G-136 still needs a read-only ownership check, and hosted SQL stays held.',
  provesOut:
    'The proposal suggests moving on after repeated clean cycles with evidence. That bar is not met, and this screen does not measure it.',
} as const;

export const STALL_RULE =
  'An active worker with no recorded progress for 30 minutes is a flag for investigation, not an automatic cancel. Waiting on review or approval is not stalled. This view has no run telemetry, so nothing is flagged from a clock.';

export const LIVE_UNAVAILABLE =
  'Live connection unavailable — not configured. The proposed GitHub Project does not exist yet, and this screen does not create one.';
