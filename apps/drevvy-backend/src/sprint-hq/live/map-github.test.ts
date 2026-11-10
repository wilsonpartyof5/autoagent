import assert from 'node:assert/strict';
import test from 'node:test';

import type { GhPull } from './github-types';
import { compareKey, mapGithubSnapshot, type GithubSnapshot } from './map-github';

const HEAD = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const MERGE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const DEPLOY = 'cccccccccccccccccccccccccccccccccccccccc';
const SYNCED = '2026-11-10T15:00:00Z';

function pull(overrides: GhPull): GhPull {
  return {
    number: 10,
    title: 'Recorded fixture',
    html_url: 'https://github.com/wilsonpartyof5/autoagent/pull/10',
    state: 'open',
    draft: false,
    merged_at: null,
    merge_commit_sha: null,
    updated_at: '2026-11-10T14:00:00Z',
    user: { login: 'octocat' },
    labels: [],
    head: { sha: HEAD },
    base: { sha: 'dddddddddddddddddddddddddddddddddddddddd' },
    ...overrides,
  };
}

function snapshot(overrides: Partial<GithubSnapshot>): GithubSnapshot {
  return {
    openPulls: [],
    closedPulls: [],
    checks: {},
    statuses: {},
    reviews: {},
    deployments: [],
    deploymentStatuses: {},
    compares: {},
    workflowRuns: [],
    syncedAt: SYNCED,
    ...overrides,
  };
}

function only(overrides: Partial<GithubSnapshot>) {
  const mapped = mapGithubSnapshot(snapshot(overrides));
  assert.equal(mapped.cards.length, 1);
  return mapped.cards[0];
}

const successRun = [{ name: 'unit', status: 'completed', conclusion: 'success', html_url: 'https://github.com/wilsonpartyof5/autoagent/runs/1' }];
const failedRun = [{ name: 'unit', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/wilsonpartyof5/autoagent/runs/2' }];
const runningRun = [{ name: 'unit', status: 'in_progress', conclusion: null, html_url: 'https://github.com/wilsonpartyof5/autoagent/runs/3' }];

test('a merged pull request without a production deployment is release-ready and never Live', () => {
  const card = only({
    closedPulls: [pull({ number: 21, state: 'closed', merged_at: '2026-11-10T12:00:00Z', merge_commit_sha: MERGE, title: 'Already deployed to production' })],
  });
  assert.equal(card.lane, 'release_ready');
  assert.equal(card.executionState, 'Merged, not released');
  assert.equal(card.postDeployEvidence, null);
  assert.notEqual(card.lane, 'live');
});

test('an exact production SHA match is Live and records the deployment URL and time', () => {
  const card = only({
    closedPulls: [pull({ number: 22, state: 'closed', merged_at: '2026-11-10T12:00:00Z', merge_commit_sha: MERGE })],
    deployments: [{ id: 5, sha: MERGE, environment: 'Production', created_at: '2026-11-10T13:00:00Z' }],
    deploymentStatuses: {
      '5': [{ state: 'success', environment: 'Production', environment_url: 'https://admin.drevvy.com', created_at: '2026-11-10T13:05:00Z' }],
    },
  });
  assert.equal(card.lane, 'live');
  assert.equal(card.postDeployEvidence, 'https://admin.drevvy.com/ at 2026-11-10T13:05:00Z');
  assert.equal(card.releaseAuthorized, null);
  assert.deepEqual(card.evidenceUrls, ['https://admin.drevvy.com/']);
});

test('a descendant production SHA proved by compare is Live, and diverged or missing proof is not', () => {
  const merged = pull({ number: 23, state: 'closed', merged_at: '2026-11-10T12:00:00Z', merge_commit_sha: MERGE });
  const deployments = [{ id: 6, sha: DEPLOY, environment: 'Production', created_at: '2026-11-10T13:00:00Z' }];
  const deploymentStatuses = {
    '6': [{ state: 'success', environment: 'Production', target_url: 'https://drevvy.com/ship', created_at: '2026-11-10T13:06:00Z' }],
  };
  const ahead = only({
    closedPulls: [merged],
    deployments,
    deploymentStatuses,
    compares: { [compareKey(MERGE, DEPLOY)]: 'ahead' },
  });
  assert.equal(ahead.lane, 'live');
  assert.match(ahead.postDeployEvidence ?? '', /https:\/\/drevvy.com\/ship at 2026-11-10T13:06:00Z/);

  const diverged = only({
    closedPulls: [merged],
    deployments,
    deploymentStatuses,
    compares: { [compareKey(MERGE, DEPLOY)]: 'diverged' },
  });
  assert.equal(diverged.lane, 'release_ready');
  assert.equal(diverged.executionState, 'Merged, not released');

  const missing = only({ closedPulls: [merged], deployments, deploymentStatuses, compares: {} });
  assert.equal(missing.lane, 'release_ready');
});

test('a preview deployment or a failed production status does not make a merge Live', () => {
  const merged = pull({ number: 24, state: 'closed', merged_at: '2026-11-10T12:00:00Z', merge_commit_sha: MERGE });
  const preview = only({
    closedPulls: [merged],
    deployments: [{ id: 7, sha: MERGE, environment: 'Preview', created_at: '2026-11-10T13:00:00Z' }],
    deploymentStatuses: { '7': [{ state: 'success', environment: 'Preview', environment_url: 'https://preview.example', created_at: '2026-11-10T13:01:00Z' }] },
  });
  assert.equal(preview.lane, 'release_ready');
  const failed = only({
    closedPulls: [merged],
    deployments: [{ id: 8, sha: MERGE, environment: 'Production', created_at: '2026-11-10T13:00:00Z' }],
    deploymentStatuses: { '8': [{ state: 'failure', environment: 'Production', created_at: '2026-11-10T13:02:00Z' }] },
  });
  assert.equal(failed.lane, 'release_ready');
});

test('failed checks land in Building with a blocked reason and do not read the title', () => {
  const card = only({
    openPulls: [pull({ title: 'Ready for release', labels: [{ name: 'qa-verified' }] })],
    checks: { [HEAD]: failedRun },
    reviews: { '10': [{ state: 'APPROVED', submitted_at: '2026-11-10T14:30:00Z', user: { login: 'reviewer' } }] },
  });
  assert.equal(card.lane, 'building');
  assert.equal(card.blocked, true);
  assert.equal(card.blocker, 'Failed checks: unit');
  assert.equal(card.reconciliation, 'Needs reconciliation');
  assert.match(card.executionState ?? '', /Needs reconciliation/);
  assert.notEqual(card.lane, 'live');
});

test('green checks wait in Review, and an independent approval or evidence label moves to Validation', () => {
  const waiting = only({ openPulls: [pull({})], checks: { [HEAD]: successRun } });
  assert.equal(waiting.lane, 'review');
  assert.equal(waiting.executionState, 'Awaiting review');

  const selfApproved = only({
    openPulls: [pull({})],
    checks: { [HEAD]: successRun },
    reviews: { '10': [{ state: 'APPROVED', submitted_at: '2026-11-10T14:30:00Z', user: { login: 'octocat' } }] },
  });
  assert.equal(selfApproved.lane, 'review');

  const approved = only({
    openPulls: [pull({})],
    checks: { [HEAD]: successRun },
    reviews: { '10': [{ state: 'APPROVED', submitted_at: '2026-11-10T14:40:00Z', user: { login: 'reviewer' } }] },
  });
  assert.equal(approved.lane, 'validation');

  const labeled = only({
    openPulls: [pull({ labels: [{ name: 'Security-Verified' }] })],
    checks: { [HEAD]: successRun },
  });
  assert.equal(labeled.lane, 'validation');
  assert.equal(labeled.securityResult, 'Label security-verified');

  const looseLabel = only({
    openPulls: [pull({ labels: [{ name: 'qa' }] })],
    checks: { [HEAD]: successRun },
  });
  assert.equal(looseLabel.lane, 'review');
});

test('a draft or a head with no checks stays in Building, and in-progress checks set the running flag', () => {
  const draft = only({
    openPulls: [pull({ draft: true })],
    checks: { [HEAD]: successRun },
    reviews: { '10': [{ state: 'APPROVED', submitted_at: '2026-11-10T14:40:00Z', user: { login: 'reviewer' } }] },
  });
  assert.equal(draft.lane, 'building');
  assert.equal(draft.reconciliation, 'Needs reconciliation');

  const none = only({
    openPulls: [pull({})],
    checks: { [HEAD]: [] },
    statuses: { [HEAD]: { state: 'pending', statuses: [] } },
  });
  assert.equal(none.lane, 'building');
  assert.equal(none.executionState, 'No checks');
  assert.equal(none.ciInProgress, false);

  const running = only({ openPulls: [pull({})], checks: { [HEAD]: runningRun } });
  assert.equal(running.lane, 'building');
  assert.equal(running.blocked, false);
  assert.equal(running.ciInProgress, true);
  assert.equal(running.executionState, 'Checks in progress');
});

test('the mapper copies titles, numbers, SHAs, and check names, and drops bodies and comments', () => {
  const mapped = mapGithubSnapshot(snapshot({
    openPulls: [pull({ title: 'Visible title', body: 'LEAKED BODY', comments: 'LEAKED COMMENT' } as GhPull & { body: string; comments: string })],
    checks: { [HEAD]: failedRun },
    reviews: { '10': [{ state: 'COMMENTED', submitted_at: '2026-11-10T14:10:00Z', user: { login: 'reviewer' }, body: 'SECRET COMMENT' } as never] },
    closedPulls: [pull({ number: 30, state: 'closed', merged_at: null, title: 'Closed without merge' })],
    workflowRuns: [{ id: 4, name: 'CI', status: 'completed', conclusion: 'success', html_url: 'https://github.com/wilsonpartyof5/autoagent/actions/runs/4', head_sha: HEAD, updated_at: '2026-11-10T14:20:00Z', display_title: 'LEAKED RUN TITLE' } as never],
  }));
  const blob = JSON.stringify(mapped);
  assert.equal(blob.includes('LEAKED BODY'), false);
  assert.equal(blob.includes('LEAKED COMMENT'), false);
  assert.equal(blob.includes('SECRET COMMENT'), false);
  assert.equal(blob.includes('LEAKED RUN TITLE'), false);
  assert.match(blob, /Visible title/);
  assert.match(blob, /PR-10/);
  assert.match(blob, new RegExp(HEAD));
  assert.match(blob, /unit: failure/);
  assert.equal(mapped.closedUnmerged[0]?.id, 'PR-30');
  assert.equal(mapped.cards.some((card) => card.id === 'PR-30'), false);
  assert.equal(mapped.workflowRuns[0]?.name, 'CI');
});
