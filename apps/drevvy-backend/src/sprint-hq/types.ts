/**
 * Normalized Sprint HQ records.
 * `releaseAuthorized: null` means unknown. It is not a silent "no".
 * Live cards are produced only by the server GitHub adapter.
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

export type SourceSystem = 'proposal_pdf' | 'demo' | 'github';

export type LiveHealth = 'fresh' | 'stale' | 'unknown';

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
  /** Set when lane signals disagree. Absent on snapshot and demo cards. */
  reconciliation?: string | null;
  /** True only when a check run on this card's head is queued or in progress. */
  ciInProgress?: boolean;
};

export type LiveWorkflowRun = {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  headSha: string | null;
  updatedAt: string | null;
};

export type LiveClosedPull = {
  id: string;
  title: string;
  htmlUrl: string | null;
  updatedAt: string | null;
};

/** Serializable board passed from the server component into the client. No token. */
export type LiveBoard = {
  health: LiveHealth;
  source: string;
  syncedAt: string | null;
  detail: string;
  cards: SprintCard[];
  workflowRuns: LiveWorkflowRun[];
  closedUnmerged: LiveClosedPull[];
};

export type ViewId = 'board' | 'office' | 'agents' | 'runs' | 'approvals' | 'reports';

export type OfficeView = 'overview' | 'follow' | 'focus';

export type Speed = 0.5 | 1 | 2;
