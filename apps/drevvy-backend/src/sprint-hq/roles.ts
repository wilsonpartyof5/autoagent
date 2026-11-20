import type { AnimState, DataMode, RoleId, SprintCard, VisualPose } from './types';

export const ROLE_IDS = ['main_pm', 'greg', 'pivot', 'flutter', 'qa', 'security'] as const satisfies readonly RoleId[];

export type RoleProfile = {
  id: RoleId;
  name: string;
  duty: string;
  accent: string;
  desk: string;
  ownerLabel: string | null;
};

export const ROLES: Record<RoleId, RoleProfile> = {
  main_pm: {
    id: 'main_pm',
    name: 'Main PM',
    duty: 'Priorities, dispatch, and unblock. One interface to DW.',
    accent: '#3ee0ff',
    desk: 'Planning desk',
    ownerLabel: null,
  },
  greg: {
    id: 'greg',
    name: 'Greg',
    duty: 'Intake and canonical backlog steward.',
    accent: '#7dffa8',
    desk: 'Backlog desk',
    ownerLabel: null,
  },
  pivot: {
    id: 'pivot',
    name: 'Pivot Ship',
    duty: 'Backend owner. Coordinates task-bound Cursor builders.',
    accent: '#5aa2ff',
    desk: 'Backend desk',
    ownerLabel: 'Pivot Ship',
  },
  flutter: {
    id: 'flutter',
    name: 'Flutter Build',
    duty: 'iOS and Android owner. Coordinates mobile builders.',
    accent: '#ff7ab8',
    desk: 'Mobile desk',
    ownerLabel: 'Flutter Build',
  },
  qa: {
    id: 'qa',
    name: 'QA & Integration',
    duty: 'Independent functional QA. Separate from the author and from Security.',
    accent: '#3ddc97',
    desk: 'Test lab',
    ownerLabel: 'QA & Integration',
  },
  security: {
    id: 'security',
    name: 'Drevvy Security',
    duty: 'Exact-head review before merge or release. Does not self-approve.',
    accent: '#c4a6ff',
    desk: 'Security console',
    ownerLabel: 'Drevvy Security',
  },
};

export function idlePoses(): Record<RoleId, AnimState> {
  return {
    main_pm: 'idle',
    greg: 'idle',
    pivot: 'idle',
    flutter: 'idle',
    qa: 'idle',
    security: 'idle',
  };
}

/**
 * The six named roles stay idle outside Cinema Demo. GitHub does not assign
 * those roles. A separate GitHub Actions indicator is the only live motion,
 * and only while a check run is actually in progress.
 */
export function visualPose(state: AnimState, mode: DataMode): VisualPose {
  if (mode !== 'demo') return 'idle';
  switch (state) {
    case 'planning':
    case 'triaging':
    case 'building':
      return 'work';
    case 'reviewing':
    case 'validating':
      return 'review';
    case 'blocked':
      return 'blocked';
    case 'released':
      return 'celebrate';
    default:
      return 'idle';
  }
}

export function animLabel(state: AnimState): string {
  switch (state) {
    case 'waiting_approval':
      return 'Waiting on approval';
    case 'idle':
      return 'Idle';
    case 'planning':
      return 'Planning';
    case 'triaging':
      return 'Triaging';
    case 'building':
      return 'Building';
    case 'reviewing':
      return 'Reviewing';
    case 'validating':
      return 'Validating';
    case 'blocked':
      return 'Blocked';
    case 'released':
      return 'Release celebration';
    case 'offline':
      return 'Offline';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Unknown';
  }
}

export function confirmedStatus(mode: DataMode, state: AnimState): string {
  if (mode !== 'demo') return 'Activity unknown';
  return `${animLabel(state)} (simulation)`;
}

export function cardsForRole(role: RoleId, cards: readonly SprintCard[]): SprintCard[] {
  const label = ROLES[role].ownerLabel;
  if (!label) return [];
  return cards.filter((card) => card.ownerRole === label);
}

export type BotReadout = {
  role: string;
  currentAssignment: string;
  confirmedStatus: string;
  lastEvidence: string;
  linkedPrRun: string;
  nextAction: string;
};

export function botReadout(
  role: RoleId,
  mode: DataMode,
  cards: readonly SprintCard[],
  state: AnimState,
  linked: string | null,
): BotReadout {
  const owned = cardsForRole(role, cards);
  let currentAssignment = 'No card is assigned to this role in this view.';
  if (role === 'main_pm') {
    currentAssignment = 'No card owner. Coordinates priority and the single report to DW.';
  } else if (role === 'greg') {
    currentAssignment = 'No card owner. Stewards intake. Greg\'s master sheet stays canonical until a migration is approved.';
  } else if (owned.length > 0) {
    currentAssignment = owned.map((card) => `${card.id}: ${card.title}`).join(' · ');
  }
  const next = owned.find((card) => card.nextStep)?.nextStep ?? null;
  return {
    role: ROLES[role].name,
    currentAssignment,
    confirmedStatus: confirmedStatus(mode, state),
    lastEvidence: mode === 'demo' ? 'Demo clock only. Not a recorded run.' : 'Not available',
    linkedPrRun: linked ?? 'Not available',
    nextAction: next ?? 'Not available',
  };
}
