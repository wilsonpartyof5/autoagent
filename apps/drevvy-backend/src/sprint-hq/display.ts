import { laneLabel } from './lanes';
import type { DataMode, LiveBoard, SprintCard } from './types';

export const NOT_AVAILABLE = 'Not available';

/** Founder-internal admin route. Documented default. Not the public showcase default. */
export const DEFAULT_MODE: DataMode = 'snapshot';

export type ModeBanner = {
  mode: DataMode;
  text: string;
  /** True only for a fresh GitHub sync. Demo, snapshot, stale, and unknown stay false. */
  claimsLive: boolean;
};

export function modeBanner(mode: DataMode, live?: LiveBoard | null): ModeBanner {
  if (mode === 'demo') {
    return { mode, text: 'SIMULATION — NOT LIVE', claimsLive: false };
  }
  if (mode === 'snapshot') {
    return { mode, text: 'PROPOSAL SNAPSHOT — Nov 9, 2026', claimsLive: false };
  }
  if (live?.health === 'fresh' && live.syncedAt) {
    return {
      mode,
      text: `LIVE — ${live.source} — Last sync ${live.syncedAt} — health fresh`,
      claimsLive: true,
    };
  }
  if (live?.health === 'stale') {
    return {
      mode,
      text: `Stale — ${live.source} — last good sync ${live.syncedAt ?? 'not available'} — ${live.detail}`,
      claimsLive: false,
    };
  }
  return {
    mode,
    text: `Unknown — ${live?.detail ?? 'no successful GitHub sync yet'}`,
    claimsLive: false,
  };
}

export function show(value: string | null | undefined): string {
  if (value == null) return NOT_AVAILABLE;
  const text = value.trim();
  return text.length === 0 ? NOT_AVAILABLE : text;
}

export function showList(values: readonly string[]): string {
  if (values.length === 0) return NOT_AVAILABLE;
  return values.join(', ');
}

export function showRelease(card: SprintCard): string {
  if (card.releaseAuthorized == null) return NOT_AVAILABLE;
  if (card.sourceMode === 'demo') {
    return card.releaseAuthorized
      ? 'Simulated approval — not a real authorization'
      : 'Not authorized (simulation)';
  }
  return card.releaseAuthorized ? 'Authorized' : 'Not authorized';
}

export function proposalOrExisting(card: SprintCard): string {
  if (card.sourceMode === 'demo') return 'Synthetic';
  return card.proposed ? 'Proposed' : 'Existing';
}

export type DrawerRow = { label: string; value: string };

/** Labels match the Phase A card-drawer contract. */
export function drawerRows(card: SprintCard): DrawerRow[] {
  return [
    { label: 'id', value: card.id },
    { label: 'outcome', value: show(card.title) },
    { label: 'sourceMode', value: card.sourceMode },
    { label: 'proposalOrExisting', value: proposalOrExisting(card) },
    { label: 'owner', value: card.ownerRole ?? 'Unassigned' },
    { label: 'lane', value: laneLabel(card.lane) },
    { label: 'executionState', value: show(card.executionState) },
    { label: 'holdFlag', value: card.blocked ? 'Yes' : 'No' },
    { label: 'holdOwner', value: show(card.whoCanClear) },
    { label: 'nextStep', value: show(card.nextStep) },
    { label: 'dependencies', value: showList(card.dependencyIds) },
    { label: 'acceptanceCriteria', value: show(card.acceptanceCriteria) },
    { label: 'testEnvironment', value: show(card.environment) },
    { label: 'headSHA', value: show(card.headSha) },
    { label: 'baseSHA', value: show(card.baseSha) },
    { label: 'PR', value: show(card.pr) },
    { label: 'CI', value: show(card.ci) },
    { label: 'QAResult', value: show(card.qaResult) },
    { label: 'securityResult', value: show(card.securityResult) },
    { label: 'evidenceURLs', value: showList(card.evidenceUrls) },
    { label: 'evidenceTimestamp', value: show(card.evidenceTimestamp) },
    { label: 'releaseAuthorization', value: showRelease(card) },
    { label: 'postDeployEvidence', value: show(card.postDeployEvidence) },
    { label: 'lastUpdated', value: show(card.lastUpdated) },
    { label: 'reconciliation', value: show(card.reconciliation) },
  ];
}

export function approvalBrief(card: SprintCard): string {
  const rows = drawerRows(card)
    .map((row) => `${row.label}: ${row.value}`)
    .join('\n');
  return [
    'Drevvy Sprint HQ — approval brief',
    'Read-only summary. This text does not approve, deploy, merge, or publish.',
    `Banner: ${card.sourceMode === 'live' ? 'Sync health is on the page banner. This brief does not claim LIVE.' : modeBanner(card.sourceMode).text}`,
    '',
    rows,
  ].join('\n');
}

export type Metric = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export function metricsFor(mode: DataMode, cards: readonly SprintCard[], live?: LiveBoard | null): Metric[] {
  if (mode === 'live') {
    const counted = live?.health === 'fresh' || live?.health === 'stale';
    const running = cards.filter((card) => card.ciInProgress).length;
    const holds = cards.filter((card) => card.blocked).length;
    return [
      { id: 'progress', label: 'Verified progress', value: '—', detail: 'No committed sprint baseline' },
      {
        id: 'builders',
        label: 'Active builders',
        value: 'Not configured',
        detail: `Cursor run telemetry is not connected. GitHub checks in progress: ${running}.`,
      },
      {
        id: 'blocked',
        label: 'Holds in view',
        value: counted ? String(holds) : '—',
        detail: 'Counted from GitHub check failures in this sync',
      },
      { id: 'approvals', label: 'Approvals needed', value: 'Not configured', detail: 'GitHub does not record a DW approval' },
      { id: 'time', label: 'Sprint time left', value: 'Not configured', detail: 'No committed sprint baseline' },
    ];
  }

  const holds = cards.filter((card) => card.blocked).length;
  const dw = cards.filter((card) => card.needsDw).length;
  const synthetic = mode === 'demo';
  return [
    {
      id: 'progress',
      label: 'Verified progress',
      value: '—',
      detail: 'No committed sprint baseline',
    },
    {
      id: 'builders',
      label: 'Active builders',
      value: synthetic ? 'Synthetic' : 'Not configured',
      detail: synthetic
        ? 'Demo clock only. Not a live worker count.'
        : 'No run telemetry connected',
    },
    {
      id: 'blocked',
      label: 'Holds in view',
      value: String(holds),
      detail: synthetic ? 'Synthetic holds on demo cards' : 'Counted from the cards in this snapshot',
    },
    {
      id: 'approvals',
      label: 'DW decisions named',
      value: String(dw),
      detail: synthetic
        ? 'A simulated approval is not a real decision'
        : 'Named in the Nov 9 proposal. Not a live queue.',
    },
    {
      id: 'time',
      label: 'Sprint time left',
      value: 'Not configured',
      detail: 'No committed sprint baseline',
    },
  ];
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
