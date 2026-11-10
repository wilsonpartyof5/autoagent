/**
 * Normalized Sprint HQ records. Phase A has no live adapter.
 * `releaseAuthorized: null` means unknown. It is not a silent "no".
 */

export type DataMode = 'demo' | 'snapshot' | 'live';

export type Lane =
  | 'backlog'
  | 'ready'
  | 'building'
  | 'review'
  | 'validation'
  | 'release_ready'
  | 'live';

export type EvidenceState = 'unverified' | 'prepared' | 'independently_verified' | 'released';

export type SourceSystem = 'proposal_pdf' | 'demo';

/** Character animation states from the Phase A spec. */
export type AnimState =
  | 'idle'
  | 'planning'
  | 'triaging'
  | 'building'
  | 'reviewing'
  | 'validating'
  | 'blocked'
  | 'waiting_approval'
  | 'released'
  | 'offline'
  | 'unknown';

export type VisualPose = 'idle' | 'work' | 'review' | 'blocked' | 'celebrate';

export type RoleId = 'main_pm' | 'greg' | 'pivot' | 'flutter' | 'qa' | 'security';

export type SprintCard = {
  id: string;
  title: string;
  lane: Lane;
  ownerRole: string | null;
  proposed: boolean;
  blocked: boolean;
  blocker: string | null;
  whoCanClear: string | null;
  needsDw: boolean;
  nextStep: string | null;
  dependencyIds: readonly string[];
  acceptanceCriteria: string | null;
  environment: string | null;
  evidenceState: EvidenceState;
  releaseAuthorized: boolean | null;
  headSha: string | null;
  baseSha: string | null;
  pr: string | null;
  ci: string | null;
  qaResult: string | null;
  securityResult: string | null;
  evidenceUrls: readonly string[];
  evidenceTimestamp: string | null;
  postDeployEvidence: string | null;
  lastUpdated: string | null;
  sourceMode: DataMode;
  sourceSystem: SourceSystem;
  executionState: string | null;
};

export type ViewId = 'board' | 'office' | 'agents' | 'runs' | 'approvals' | 'reports';

export type OfficeView = 'overview' | 'follow' | 'focus';

export type Speed = 0.5 | 1 | 2;
