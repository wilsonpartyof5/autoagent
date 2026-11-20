import assert from 'node:assert/strict';
import test from 'node:test';

import { createLiveCache, githubHeaders, loadLiveBoard } from './load';
import { modeBanner } from '../display';

const HEAD = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const MERGE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const DEPLOY = 'cccccccccccccccccccccccccccccccccccccccc';

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function router(urls: string[]) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    urls.push(url);
    const header = new Headers(init?.headers);
    assert.equal(header.get('authorization'), null);
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/pulls') && parsed.searchParams.get('state') === 'open') {
      return json([{
        number: 11,
        title: 'Open work',
        html_url: 'https://github.com/wilsonpartyof5/autoagent/pull/11',
        state: 'open',
        draft: false,
        user: { login: 'octocat' },
        labels: [],
        head: { sha: HEAD },
        base: { sha: 'dddddddddddddddddddddddddddddddddddddddd' },
        updated_at: '2026-11-10T14:00:00Z',
        body: 'LEAKED BODY',
      }]);
    }
    if (parsed.pathname.endsWith('/pulls') && parsed.searchParams.get('state') === 'closed') {
      return json([{
        number: 22,
        title: 'Merged work',
        html_url: 'https://github.com/wilsonpartyof5/autoagent/pull/22',
        state: 'closed',
        merged_at: '2026-11-10T12:00:00Z',
        merge_commit_sha: MERGE,
        user: { login: 'octocat' },
        labels: [],
        head: { sha: HEAD },
        base: { sha: 'dddddddddddddddddddddddddddddddddddddddd' },
        updated_at: '2026-11-10T12:30:00Z',
      }]);
    }
    if (parsed.pathname.endsWith('/check-runs')) return json({ check_runs: [{ name: 'unit', status: 'completed', conclusion: 'failure' }] });
    if (parsed.pathname.endsWith('/reviews')) return json([]);
    if (parsed.pathname.endsWith('/deployments')) {
      return json([{ id: 6, sha: DEPLOY, environment: 'Production', created_at: '2026-11-10T13:00:00Z' }]);
    }
    if (parsed.pathname.endsWith('/statuses')) {
      return json([{ state: 'success', environment: 'Production', environment_url: 'https://drevvy.com/ship', created_at: '2026-11-10T13:06:00Z' }]);
    }
    if (parsed.pathname.includes('/compare/')) return json({ status: 'ahead' });
    if (parsed.pathname.endsWith('/actions/runs')) {
      return json({ workflow_runs: [{ id: 9, name: 'CI', status: 'completed', conclusion: 'success', html_url: 'https://github.com/wilsonpartyof5/autoagent/actions/runs/9', head_sha: HEAD, updated_at: '2026-11-10T13:10:00Z' }] });
    }
    throw new Error(`unexpected ${url}`);
  };
}

test('a successful read is fresh LIVE data and a later failure becomes Stale without demo cards', async () => {
  const urls: string[] = [];
  const cache = createLiveCache();
  const board = await loadLiveBoard({
    fetchImpl: router(urls),
    env: {},
    now: Date.parse('2026-11-10T15:00:00Z'),
    cache,
  });
  assert.equal(board.health, 'fresh');
  assert.equal(modeBanner('live', board).claimsLive, true);
  assert.match(modeBanner('live', board).text, /^LIVE — github.com\/wilsonpartyof5\/autoagent — Last sync /);
  const open = board.cards.find((card) => card.id === 'PR-11');
  const merged = board.cards.find((card) => card.id === 'PR-22');
  assert.equal(open?.lane, 'building');
  assert.equal(open?.blocked, true);
  assert.equal(open?.blocker, 'Failed checks: unit');
  assert.equal(merged?.lane, 'live');
  assert.match(merged?.postDeployEvidence ?? '', /https:\/\/drevvy.com\/ship/);
  assert.equal(JSON.stringify(board).includes('LEAKED BODY'), false);
  assert.equal(board.cards.some((card) => card.id.startsWith('DEMO-')), false);
  assert.ok(urls.some((url) => url.includes('/repos/wilsonpartyof5/autoagent/pulls?')));
  assert.ok(urls.some((url) => url.includes('/commits/') && url.includes('/check-runs')));
  assert.ok(urls.some((url) => url.includes('/deployments/6/statuses')));
  assert.ok(urls.some((url) => url.includes(`/compare/${MERGE}...${DEPLOY}`)));
  assert.ok(urls.some((url) => url.endsWith('/actions/runs?per_page=15')));

  const callsBefore = urls.length;
  const cached = await loadLiveBoard({ fetchImpl: router(urls), env: {}, now: Date.parse('2026-11-10T15:00:30Z'), cache });
  assert.equal(cached.health, 'fresh');
  assert.equal(urls.length, callsBefore);

  const stale = await loadLiveBoard({
    fetchImpl: async () => json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' }),
    env: {},
    now: Date.parse('2026-11-10T15:02:00Z'),
    cache,
  });
  assert.equal(stale.health, 'stale');
  assert.equal(modeBanner('live', stale).claimsLive, false);
  assert.match(modeBanner('live', stale).text, /^Stale —/);
  assert.equal(stale.cards.find((card) => card.id === 'PR-22')?.lane, 'live');
  assert.equal(stale.cards.some((card) => card.sourceMode === 'demo'), false);

  const held = await loadLiveBoard({
    fetchImpl: async () => {
      throw new Error('should not refetch during the stale window');
    },
    env: {},
    now: Date.parse('2026-11-10T15:02:30Z'),
    cache,
  });
  assert.equal(held.health, 'stale');
  assert.equal(modeBanner('live', held).claimsLive, false);
});

test('the first failed read is Unknown, has no cards, and does not claim LIVE', async () => {
  const board = await loadLiveBoard({
    fetchImpl: async () => json('rate limit exceeded', 429),
    env: {},
    now: Date.parse('2026-11-10T16:00:00Z'),
    cache: createLiveCache(),
  });
  assert.equal(board.health, 'unknown');
  assert.equal(board.cards.length, 0);
  assert.equal(board.syncedAt, null);
  const banner = modeBanner('live', board);
  assert.equal(banner.claimsLive, false);
  assert.match(banner.text, /^Unknown —/);
  assert.equal(banner.text.includes('LIVE —'), false);
});

test('the optional token is sent only to GitHub and is not copied into the board', async () => {
  assert.equal(githubHeaders({}).Authorization, undefined);
  const headers = githubHeaders({ SPRINT_HQ_GITHUB_TOKEN: 'test-token-value' });
  assert.equal(headers.Authorization, 'Bearer test-token-value');
  let authorization: string | null = null;
  const board = await loadLiveBoard({
    env: { SPRINT_HQ_GITHUB_TOKEN: 'test-token-value' },
    cache: createLiveCache(),
    now: Date.parse('2026-11-10T17:00:00Z'),
    fetchImpl: async (_url, init) => {
      authorization = new Headers(init?.headers).get('authorization');
      return json({ message: 'nope' }, 500);
    },
  });
  assert.equal(authorization, 'Bearer test-token-value');
  assert.equal(JSON.stringify(board).includes('test-token-value'), false);
  assert.equal(board.health, 'unknown');
});
