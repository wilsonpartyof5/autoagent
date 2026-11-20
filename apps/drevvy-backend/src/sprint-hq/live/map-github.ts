import type { GhCheckRun, GhCombined, GhDeployment, GhDeploymentStatus, GhPull, GhReview, GhWorkflowRun, CompareStatus } from './github-types';
import type { LiveClosedPull, LiveWorkflowRun, SprintCard } from '../types';

export const LIVE_SOURCE = 'github.com/wilsonpartyof5/autoagent';

/** Exact label names. A title that mentions QA or security is not evidence. */
export const EVIDENCE_LABELS = ['qa-verified', 'security-verified'] as const;

const FAIL_CONCLUSIONS = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);
const RUNNING_STATUSES = new Set(['in_progress', 'queued', 'pending', 'waiting', 'requested']);

export type ProductionDeployment = {
  id: number;
  sha: string;
  url: string | null;
  at: string | null;
};

export type GithubSnapshot = {
  openPulls: readonly GhPull[];
  closedPulls: readonly GhPull[];
  checks: Readonly<Record<string, readonly GhCheckRun[]>>;
  statuses: Readonly<Record<string, GhCombined | null>>;
  reviews: Readonly<Record<string, readonly GhReview[]>>;
  deployments: readonly GhDeployment[];
  deploymentStatuses: Readonly<Record<string, readonly GhDeploymentStatus[]>>;
  /** Keyed by compareKey(mergeSha, deploySha). Missing means not proved. */
  compares: Readonly<Record<string, CompareStatus>>;
  workflowRuns: readonly GhWorkflowRun[];
  syncedAt: string;
};

export function compareKey(mergeSha: string, deploySha: string): string {
  return `${mergeSha.toLowerCase()}...${deploySha.toLowerCase()}`;
}

export function cleanSha(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(text) ? text : null;
}

export function isProductionEnvironment(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^production(\b|[\s-]|$)/i.test(value.trim());
}

export function sanitizeText(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)) return null;
  return text;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function githubWebUrl(value: unknown): string | null {
  const url = httpsUrl(value);
  if (!url) return null;
  const host = new URL(url).hostname;
  if (host !== 'github.com' && host !== 'www.github.com') return null;
  return url;
}

export function productionDeployments(
  deployments: readonly GhDeployment[],
  deploymentStatuses: Readonly<Record<string, readonly GhDeploymentStatus[]>>,
): ProductionDeployment[] {
  const found: ProductionDeployment[] = [];
  for (const deployment of deployments) {
    if (!isProductionEnvironment(deployment.environment)) continue;
    const sha = cleanSha(deployment.sha);
    const id = deployment.id;
    if (!sha || typeof id !== 'number') continue;
    const statuses = [...(deploymentStatuses[String(id)] ?? [])].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );
    const latest = statuses[0];
    if (!latest || latest.state !== 'success') continue;
    if (latest.environment && !isProductionEnvironment(latest.environment)) continue;
    found.push({
      id,
      sha,
      url: httpsUrl(latest.environment_url) ?? httpsUrl(latest.target_url),
      at: isoOrNull(latest.created_at) ?? isoOrNull(deployment.created_at),
    });
  }
  return found;
}

type CheckPicture = {
  kind: 'none' | 'running' | 'failed' | 'green';
  inProgress: boolean;
  failedNames: string[];
  summary: string | null;
};

function checkPicture(runs: readonly GhCheckRun[] | undefined, combined: GhCombined | null | undefined): CheckPicture {
  const parts: string[] = [];
  const failedNames: string[] = [];
  let inProgress = false;
  let sawSuccess = false;

  for (const run of runs ?? []) {
    const name = sanitizeText(run.name, 80) ?? 'check';
    const status = (run.status ?? '').toLowerCase();
    const conclusion = (run.conclusion ?? '').toLowerCase();
    if (RUNNING_STATUSES.has(status)) {
      inProgress = true;
      parts.push(`${name}: ${status}`);
      continue;
    }
    if (status === 'completed' && FAIL_CONCLUSIONS.has(conclusion)) {
      failedNames.push(name);
      parts.push(`${name}: ${conclusion}`);
      continue;
    }
    if (status === 'completed' && conclusion === 'success') {
      sawSuccess = true;
      parts.push(`${name}: success`);
      continue;
    }
    if (conclusion) parts.push(`${name}: ${conclusion}`);
    else if (status) parts.push(`${name}: ${status}`);
  }

  let combinedFailure = false;
  let combinedPending = false;
  let combinedSuccess = false;
  if ((runs ?? []).length === 0 && combined) {
    for (const status of combined.statuses ?? []) {
      const context = sanitizeText(status.context, 80) ?? 'status';
      const state = (status.state ?? '').toLowerCase();
      parts.push(`${context}: ${state || 'unknown'}`);
      if (state === 'failure' || state === 'error') {
        combinedFailure = true;
        failedNames.push(context);
      } else if (state === 'pending') combinedPending = true;
      else if (state === 'success') combinedSuccess = true;
    }
    const rollup = (combined.state ?? '').toLowerCase();
    if (rollup === 'failure' || rollup === 'error') combinedFailure = true;
    else if (rollup === 'success' && (combined.statuses ?? []).some((status) => (status.state ?? '').toLowerCase() === 'success')) {
      combinedSuccess = true;
    }
  }

  const summary = parts.length === 0 ? null : parts.join('; ').slice(0, 500);
  if (failedNames.length > 0 || combinedFailure) {
    return { kind: 'failed', inProgress, failedNames, summary };
  }
  if (inProgress || combinedPending) {
    return { kind: 'running', inProgress: true, failedNames: [], summary };
  }
  if (sawSuccess || combinedSuccess) {
    return { kind: 'green', inProgress: false, failedNames: [], summary };
  }
  return { kind: 'none', inProgress: false, failedNames: [], summary };
}

function evidenceLabels(pull: GhPull): { qa: boolean; security: boolean; any: boolean } {
  const names = new Set((pull.labels ?? []).map((label) => (label.name ?? '').trim().toLowerCase()));
  const qa = names.has('qa-verified');
  const security = names.has('security-verified');
  return { qa, security, any: qa || security };
}

function hasIndependentApproval(reviews: readonly GhReview[], author: string | null): boolean {
  const latest = new Map<string, { state: string; at: string }>();
  for (const review of reviews) {
    const login = sanitizeText(review.user?.login, 39);
    if (!login) continue;
    if (author && login.toLowerCase() === author.toLowerCase()) continue;
    const at = review.submitted_at ?? '';
    const prev = latest.get(login.toLowerCase());
    if (!prev || at >= prev.at) latest.set(login.toLowerCase(), { state: (review.state ?? '').toUpperCase(), at });
  }
  for (const review of latest.values()) {
    if (review.state === 'APPROVED') return true;
  }
  return false;
}

function containsMerge(mergeSha: string, deploySha: string, compares: Readonly<Record<string, CompareStatus>>): boolean {
  if (mergeSha.toLowerCase() === deploySha.toLowerCase()) return true;
  const status = compares[compareKey(mergeSha, deploySha)];
  return status === 'ahead' || status === 'identical';
}

function blankCard(pull: GhPull, syncedAt: string): SprintCard {
  const number = pull.number ?? 0;
  return {
    id: `PR-${number}`,
    title: sanitizeText(pull.title) ?? `Pull request ${number}`,
    lane: 'building',
    ownerRole: sanitizeText(pull.user?.login, 39),
    proposed: false,
    blocked: false,
    blocker: null,
    whoCanClear: null,
    needsDw: false,
    nextStep: null,
    dependencyIds: [],
    acceptanceCriteria: null,
    environment: null,
    evidenceState: 'unverified',
    releaseAuthorized: null,
    headSha: cleanSha(pull.head?.sha),
    baseSha: cleanSha(pull.base?.sha),
    pr: githubWebUrl(pull.html_url),
    ci: null,
    qaResult: null,
    securityResult: null,
    evidenceUrls: [],
    evidenceTimestamp: isoOrNull(pull.updated_at),
    postDeployEvidence: null,
    lastUpdated: isoOrNull(pull.updated_at) ?? syncedAt,
    sourceMode: 'live',
    sourceSystem: 'github',
    executionState: null,
    reconciliation: null,
    ciInProgress: false,
  };
}

function mapOne(
  pull: GhPull,
  snapshot: GithubSnapshot,
  productions: readonly ProductionDeployment[],
): SprintCard | null {
  if (typeof pull.number !== 'number' || !Number.isInteger(pull.number) || pull.number <= 0) return null;
  const merged = typeof pull.merged_at === 'string' && pull.merged_at.length > 0;
  if (!merged && pull.state !== 'open') return null;

  const card = blankCard(pull, snapshot.syncedAt);
  const labels = evidenceLabels(pull);
  if (labels.qa) card.qaResult = 'Label qa-verified';
  if (labels.security) card.securityResult = 'Label security-verified';
  const author = card.ownerRole;
  const approved = hasIndependentApproval(snapshot.reviews[String(pull.number)] ?? [], author);
  const head = cleanSha(pull.head?.sha);
  const picture = checkPicture(snapshot.checks[head ?? ''], head ? snapshot.statuses[head] : null);
  card.ci = picture.summary;
  card.ciInProgress = picture.inProgress;

  if (merged) {
    const mergeSha = cleanSha(pull.merge_commit_sha);
    card.headSha = cleanSha(pull.head?.sha);
    if (!mergeSha) {
      card.lane = 'release_ready';
      card.executionState = 'Needs reconciliation: merged pull request has no merge SHA, so it is not Live.';
      card.reconciliation = 'Needs reconciliation';
      card.nextStep = 'Merged, not released';
      return card;
    }
    const matches = productions.filter((item) => containsMerge(mergeSha, item.sha, snapshot.compares));
    matches.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
    const match = matches[0];
    if (!match) {
      card.lane = 'release_ready';
      card.executionState = 'Merged, not released';
      card.nextStep = 'Merged, not released';
      return card;
    }
    card.lane = 'live';
    card.environment = 'Production';
    card.evidenceState = 'released';
    card.evidenceTimestamp = match.at;
    card.evidenceUrls = match.url ? [match.url] : [];
    card.postDeployEvidence = match.url ? `${match.url} at ${match.at ?? 'time not available'}` : `Production deployment ${match.sha} at ${match.at ?? 'time not available'}`;
    card.executionState = 'Production deployment contains the merge SHA';
    card.nextStep = 'Production deployment recorded';
    return card;
  }

  const draft = pull.draft === true;
  const promotion = approved || labels.any;
  if (draft) {
    card.lane = 'building';
    card.executionState = 'Draft';
    card.nextStep = 'Draft is still in progress';
    if (picture.kind === 'failed') {
      card.blocked = true;
      card.blocker = `Failed checks: ${picture.failedNames.join(', ')}`;
    }
    if (promotion) {
      card.reconciliation = 'Needs reconciliation';
      card.executionState = 'Needs reconciliation: draft pull request also has an approving review or evidence label.';
    }
    return card;
  }
  if (picture.kind === 'failed') {
    card.lane = 'building';
    card.blocked = true;
    card.blocker = `Failed checks: ${picture.failedNames.join(', ')}`;
    card.executionState = 'Checks failed';
    card.nextStep = 'Clear the failed checks';
  } else if (picture.kind === 'running' || picture.kind === 'none') {
    card.lane = 'building';
    if (picture.kind === 'running') {
      card.executionState = 'Checks in progress';
      card.nextStep = 'Wait for the check run to finish';
    } else {
      card.executionState = 'No checks';
      card.nextStep = 'No checks on the head SHA';
    }
  } else if (promotion) {
    card.lane = 'validation';
    card.executionState = approved && labels.any
      ? 'Approving review and evidence label recorded'
      : approved
        ? 'Approving review recorded'
        : 'Evidence label recorded';
    card.nextStep = 'Validation evidence is a label or an approving review';
  } else {
    card.lane = 'review';
    card.executionState = 'Awaiting review';
    card.nextStep = 'Waiting on an approving review';
  }

  if (promotion && card.lane !== 'validation') {
    card.reconciliation = 'Needs reconciliation';
    card.executionState = `Needs reconciliation: an approving review or evidence label is present, but the pull request is still ${card.executionState}.`;
  }
  return card;
}

export function mapGithubSnapshot(snapshot: GithubSnapshot): { cards: SprintCard[]; closedUnmerged: LiveClosedPull[]; workflowRuns: LiveWorkflowRun[] } {
  const productions = productionDeployments(snapshot.deployments, snapshot.deploymentStatuses);
  const byNumber = new Map<number, GhPull>();
  for (const pull of snapshot.openPulls) {
    if (typeof pull.number === 'number') byNumber.set(pull.number, pull);
  }
  for (const pull of snapshot.closedPulls) {
    if (typeof pull.number !== 'number') continue;
    const prev = byNumber.get(pull.number);
    if (!prev || (typeof pull.merged_at === 'string' && pull.merged_at.length > 0)) byNumber.set(pull.number, pull);
  }

  const cards: SprintCard[] = [];
  const closedUnmerged: LiveClosedPull[] = [];
  for (const pull of byNumber.values()) {
    const merged = typeof pull.merged_at === 'string' && pull.merged_at.length > 0;
    if (pull.state === 'closed' && !merged) {
      if (typeof pull.number === 'number') {
        closedUnmerged.push({
          id: `PR-${pull.number}`,
          title: sanitizeText(pull.title) ?? `Pull request ${pull.number}`,
          htmlUrl: githubWebUrl(pull.html_url),
          updatedAt: isoOrNull(pull.updated_at),
        });
      }
      continue;
    }
    const card = mapOne(pull, snapshot, productions);
    if (card) cards.push(card);
  }

  cards.sort((a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? '') || a.id.localeCompare(b.id));

  const workflowRuns: LiveWorkflowRun[] = [];
  for (const run of snapshot.workflowRuns) {
    if (typeof run.id !== 'number') continue;
    workflowRuns.push({
      id: `actions-${run.id}`,
      name: sanitizeText(run.name, 120) ?? 'GitHub Actions',
      status: sanitizeText(run.status, 40) ?? 'unknown',
      conclusion: sanitizeText(run.conclusion, 40),
      htmlUrl: githubWebUrl(run.html_url),
      headSha: cleanSha(run.head_sha),
      updatedAt: isoOrNull(run.updated_at),
    });
  }

  return { cards, closedUnmerged, workflowRuns };
}
