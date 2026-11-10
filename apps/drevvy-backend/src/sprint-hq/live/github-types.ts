/**
 * Fields the mapper is allowed to read. Pull-request bodies, review comments,
 * and check logs are intentionally absent so they cannot be copied onto a card.
 */

export type GhUser = { login?: string };

export type GhLabel = { name?: string };

export type GhPull = {
  number?: number;
  title?: string;
  html_url?: string;
  state?: string;
  draft?: boolean;
  merged_at?: string | null;
  merge_commit_sha?: string | null;
  updated_at?: string;
  user?: GhUser;
  labels?: GhLabel[];
  head?: { sha?: string };
  base?: { sha?: string };
};

export type GhCheckRun = {
  name?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
};

export type GhStatus = {
  context?: string;
  state?: string;
};

export type GhCombined = {
  state?: string;
  statuses?: GhStatus[];
};

export type GhReview = {
  state?: string;
  submitted_at?: string;
  user?: GhUser;
};

export type GhDeployment = {
  id?: number;
  sha?: string;
  environment?: string;
  created_at?: string;
};

export type GhDeploymentStatus = {
  state?: string;
  environment?: string;
  target_url?: string | null;
  environment_url?: string | null;
  created_at?: string;
};

export type GhWorkflowRun = {
  id?: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  head_sha?: string;
  updated_at?: string;
};

export type CompareStatus = 'ahead' | 'behind' | 'identical' | 'diverged';
