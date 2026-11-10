import type { Lane } from './types';

export const LANE_ORDER = [
  'backlog',
  'ready',
  'building',
  'review',
  'validation',
  'release_ready',
  'live',
] as const satisfies readonly Lane[];

export type LaneMeta = {
  id: Lane;
  label: string;
  exit: string;
  /** Release-ready and Live carry the v2 "merged is not live" note. */
  mergedNote: boolean;
};

export const LANES: readonly LaneMeta[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    exit: 'Greg intake: deduped, feasible, acceptance set.',
    mergedNote: false,
  },
  {
    id: 'ready',
    label: 'Ready',
    exit: 'One owner. Acceptance and the test environment are agreed.',
    mergedNote: false,
  },
  {
    id: 'building',
    label: 'Building',
    exit: 'Head is ready for review. Push and publish stay under existing authorization.',
    mergedNote: false,
  },
  {
    id: 'review',
    label: 'Review',
    exit: 'Security exact-head check and independent QA. A pass here is not a release.',
    mergedNote: false,
  },
  {
    id: 'validation',
    label: 'Validation',
    exit: 'Feature verified in the agreed environment. Green CI alone is not enough.',
    mergedNote: false,
  },
  {
    id: 'release_ready',
    label: 'Release-ready',
    exit: 'Evidence is complete and the card waits on an authorized deployment.',
    mergedNote: true,
  },
  {
    id: 'live',
    label: 'Live',
    exit: 'Authorized deployment, then post-deploy verification.',
    mergedNote: true,
  },
];

export const MERGED_NOT_LIVE_NOTE =
  'Merged is not Live. A merge would sit in Merged-not-released until an authorized deployment and a post-deploy check. This board keeps seven lanes; Merged-not-released is a gate note, not an eighth column.';

export function laneLabel(lane: Lane): string {
  return LANES.find((item) => item.id === lane)?.label ?? lane;
}

export function laneMeta(lane: Lane): LaneMeta {
  const found = LANES.find((item) => item.id === lane);
  if (!found) {
    throw new Error(`Unknown lane ${lane}`);
  }
  return found;
}
