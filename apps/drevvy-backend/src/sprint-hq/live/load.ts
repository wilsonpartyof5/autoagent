import type { GhCheckRun, GhCombined, GhDeployment, GhDeploymentStatus, GhPull, GhReview, GhWorkflowRun } from './github-types';
import { compareKey, LIVE_SOURCE, mapGithubSnapshot, productionDeployments } from './map-github';
import type { LiveBoard } from '../types';

export const GITHUB_API = 'https://api.github.com';
export const GITHUB_REPO = 'wilsonpartyof5/autoagent';
export const LIVE_CACHE_MS = 60_000;
const OPEN_LIMIT = 15;
const CLOSED_LIMIT = 8;
const COMPARE_LIMIT = 3;

export type LiveCache = {
  lastGood: LiveBoard | null;
  served: LiveBoard | null;
  expiresAt: number;
};

export function createLiveCache(): LiveCache {
  return { lastGood: null, served: null, expiresAt: 0 };
}

const processCache = createLiveCache();

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type LoadLiveOptions = {
  fetchImpl?: FetchLike;
  env?: { SPRINT_HQ_GITHUB_TOKEN?: string };
  now?: number;
  cache?: LiveCache;
};

class GithubStatusError extends Error {
  constructor(readonly status: number) {
    super(`GitHub status ${status}`);
  }
}

class RateLimitError extends Error {
  constructor() {
    super('rate limit');
  }
}

function repoUrl(path: string): string {
  return `${GITHUB_API}/repos/${GITHUB_REPO}${path}`;
}

export function githubHeaders(env: { SPRINT_HQ_GITHUB_TOKEN?: string }): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'drevvy-sprint-hq',
  };
  const token = env.SPRINT_HQ_GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function unknownBoard(reason: string): LiveBoard {
  return {
    health: 'unknown',
    source: LIVE_SOURCE,
    syncedAt: null,
    detail: `No successful sync yet after ${reason}.`,
    cards: [],
    workflowRuns: [],
    closedUnmerged: [],
  };
}

async function githubFetch(fetchImpl: FetchLike, url: string, headers: Record<string, string>): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.github.com') {
    throw new GithubStatusError(0);
  }
  const init = { headers, signal: AbortSignal.timeout(8000), next: { revalidate: 60 } } as RequestInit;
  return fetchImpl(url, init);
}

async function getJson<T>(fetchImpl: FetchLike, url: string, headers: Record<string, string>): Promise<T> {
  const response = await githubFetch(fetchImpl, url, headers);
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const text = await response.text();
    if (response.status === 429 || remaining === '0' || /rate limit/i.test(text)) throw new RateLimitError();
    throw new GithubStatusError(response.status);
  }
  if (response.status === 404) throw new GithubStatusError(404);
  if (!response.ok) throw new GithubStatusError(response.status);
  return (await response.json()) as T;
}

function expectArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new GithubStatusError(0);
  return value as T[];
}

async function mapPool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next !== undefined) await fn(next);
    }
  });
  await Promise.all(workers);
}

async function fetchBoard(options: LoadLiveOptions | undefined, syncedAt: string): Promise<LiveBoard> {
  const env = options?.env ?? { SPRINT_HQ_GITHUB_TOKEN: process.env.SPRINT_HQ_GITHUB_TOKEN };
  const fetchImpl = options?.fetchImpl ?? fetch;
  const headers = githubHeaders(env);

  const open = expectArray<GhPull>(
    await getJson<unknown>(fetchImpl, repoUrl('/pulls?state=open&sort=updated&direction=desc&per_page=15'), headers),
  ).slice(0, OPEN_LIMIT);
  const closed = expectArray<GhPull>(
    await getJson<unknown>(fetchImpl, repoUrl('/pulls?state=closed&sort=updated&direction=desc&per_page=8'), headers),
  ).slice(0, CLOSED_LIMIT);

  const checks: Record<string, GhCheckRun[]> = {};
  const statuses: Record<string, GhCombined | null> = {};
  const reviews: Record<string, GhReview[]> = {};
  const heads = new Set<string>();
  for (const pull of [...open, ...closed]) {
    const sha = typeof pull.head?.sha === 'string' ? pull.head.sha.trim().toLowerCase() : '';
    if (/^[0-9a-f]{7,40}$/.test(sha)) heads.add(sha);
  }

  await mapPool([...heads], 4, async (sha) => {
    const payload = await getJson<{ check_runs?: GhCheckRun[] }>(fetchImpl, repoUrl(`/commits/${sha}/check-runs?per_page=20`), headers);
    const runs = expectArray<GhCheckRun>(payload.check_runs ?? []);
    checks[sha] = runs;
    statuses[sha] = runs.length === 0
      ? await getJson<GhCombined>(fetchImpl, repoUrl(`/commits/${sha}/status`), headers)
      : null;
  });

  await mapPool(open, 4, async (pull) => {
    if (typeof pull.number !== 'number') return;
    reviews[String(pull.number)] = expectArray<GhReview>(
      await getJson<unknown>(fetchImpl, repoUrl(`/pulls/${pull.number}/reviews?per_page=20`), headers),
    );
  });

  const deployments = expectArray<GhDeployment>(
    await getJson<unknown>(fetchImpl, repoUrl('/deployments?per_page=15'), headers),
  ).slice(0, 15);
  const deploymentStatuses: Record<string, GhDeploymentStatus[]> = {};
  const production = deployments.filter((item) => typeof item.environment === 'string' && /^production(\b|[\s-]|$)/i.test(item.environment.trim()));
  await mapPool(production, 4, async (deployment) => {
    if (typeof deployment.id !== 'number') return;
    deploymentStatuses[String(deployment.id)] = expectArray<GhDeploymentStatus>(
      await getJson<unknown>(fetchImpl, repoUrl(`/deployments/${deployment.id}/statuses?per_page=10`), headers),
    );
  });

  const compares: Record<string, 'ahead' | 'behind' | 'identical' | 'diverged'> = {};
  const proved = productionDeployments(deployments, deploymentStatuses).slice(0, COMPARE_LIMIT);
  for (const pull of closed) {
    if (typeof pull.merged_at !== 'string' || !pull.merged_at) continue;
    const mergeSha = typeof pull.merge_commit_sha === 'string' ? pull.merge_commit_sha.trim().toLowerCase() : '';
    if (!/^[0-9a-f]{7,40}$/.test(mergeSha)) continue;
    if (proved.some((item) => item.sha === mergeSha)) continue;
    for (const item of proved) {
      const key = compareKey(mergeSha, item.sha);
      if (compares[key]) continue;
      try {
        const body = await getJson<{ status?: string }>(fetchImpl, repoUrl(`/compare/${mergeSha}...${item.sha}`), headers);
        const status = body.status;
        compares[key] = status === 'ahead' || status === 'behind' || status === 'identical' || status === 'diverged' ? status : 'diverged';
      } catch (error) {
        if (error instanceof GithubStatusError && error.status === 404) compares[key] = 'diverged';
        else throw error;
      }
    }
  }

  const actions = await getJson<{ workflow_runs?: GhWorkflowRun[] }>(fetchImpl, repoUrl('/actions/runs?per_page=15'), headers);
  const mapped = mapGithubSnapshot({
    openPulls: open,
    closedPulls: closed,
    checks,
    statuses,
    reviews,
    deployments,
    deploymentStatuses,
    compares,
    workflowRuns: Array.isArray(actions.workflow_runs) ? actions.workflow_runs.slice(0, 15) : [],
    syncedAt,
  });

  return {
    health: 'fresh',
    source: LIVE_SOURCE,
    syncedAt,
    detail: 'health fresh',
    cards: mapped.cards,
    workflowRuns: mapped.workflowRuns,
    closedUnmerged: mapped.closedUnmerged,
  };
}

/**
 * Read-only GitHub sync for the admin server. The optional token is read from
 * the process environment and is never returned. Failures stay Stale or Unknown.
 */
export async function loadLiveBoard(options?: LoadLiveOptions): Promise<LiveBoard> {
  if (typeof window !== 'undefined') {
    throw new Error('Sprint HQ GitHub adapter is server-only');
  }
  const now = options?.now ?? Date.now();
  const box = options?.cache ?? processCache;
  if (box.served && now < box.expiresAt) return box.served;

  const syncedAt = new Date(now).toISOString();
  try {
    const board = await fetchBoard(options, syncedAt);
    box.lastGood = board;
    box.served = board;
    box.expiresAt = now + LIVE_CACHE_MS;
    return board;
  } catch (error) {
    const reason = error instanceof RateLimitError ? 'a rate limit' : 'a fetch failure';
    const served = box.lastGood
      ? { ...box.lastGood, health: 'stale' as const, detail: `Last good sync kept after ${reason}.` }
      : unknownBoard(reason);
    box.served = served;
    box.expiresAt = now + LIVE_CACHE_MS;
    return served;
  }
}
