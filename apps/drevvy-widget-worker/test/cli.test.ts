import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config';
import { execute, type CliDeps } from '../src/cli';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { formatResultsTable, parseUrlList } from '../src/cli/format';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const availability = readFixture('check-availability.html');

const html = readFixture('gubagoo-vdp.html');
const pageUrl = 'https://www.example-motors.test/inventory/civic';

const config: AppConfig = {
  aiBaseUrl: 'https://api.x.ai/v1',
  aiApiKey: 'test-key',
  aiModel: 'grok-4',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service',
  dryRun: true,
  allowlist: [],
  drevvyTextNumber: '803-555-0148',
  drevvyEmail: 'deals@drevvy.test',
  shopperFirst: 'Maya',
  leadLastName: 'via Drevvy',
  leadZip: '29201',
  fetchTimeoutMs: 1000,
  maxTurns: 6,
  scanSettleMs: 0,
  scanConcurrency: 1,
  scanTimeoutMs: 25_000,
  marketcheckApiKey: null,
  marketcheckBaseUrl: 'https://api.marketcheck.com',
  seedIntervalMs: 1_000,
  testMode: true,
};

describe('cli', () => {
  it('parses a url file and formats a results table', () => {
    const targets = parseUrlList('# comment\n\nhttps://www.example-motors.test/inventory/civic H24118\n');
    assert.deepEqual(targets, [{ url: pageUrl, stockNumber: 'H24118' }]);
    const table = formatResultsTable([
      { url: pageUrl, vendor: 'gubagoo', status: 'dry_run', price: null, dryRun: 'true' },
    ]);
    assert.match(table, /url\s+vendor\s+status\s+price\s+dry_run/);
    assert.match(table, /gubagoo\s+dry_run\s+-\s+true/);
  });

  it('runs research and a lead-only day-0 pass when the composer is missing', async () => {
    const directory = new MemoryDirectoryStore();
    const attempts = new MemoryAttemptStore();
    const pages: FakeChatPage[] = [];
    const files: Record<string, string> = {
      'urls.txt': `${pageUrl} H24118\nhttps://www.example-motors.test/inventory/other\n`,
      'hints.json': JSON.stringify({
        [pageUrl]: {
          dealerName: 'Hint Motors',
          phone: '8035550177',
          email: 'hint@marketcheck.test',
          vin: '1HGCV1F16NA000001',
        },
      }),
    };
    const deps: CliDeps = {
      config,
      directory,
      attempts,
      fetchPage: async (url) => ({ url, status: 200, html }),
      ai: {
        async complete() {
          return JSON.stringify({
            name: 'Hint Motors',
            phones: ['803-555-0199', '803-555-0177'],
            emails: ['sales@example-motors.test', 'hint@marketcheck.test'],
            widget_vendor: 'gubagoo',
            confidence: 0.91,
          });
        },
      },
      openPage: async () => {
        const page = new FakeChatPage(html);
        pages.push(page);
        return { page, close: () => page.close() };
      },
      readFile: (filePath) => {
        const text = files[filePath];
        if (text == null) throw new Error(`missing ${filePath}`);
        return text;
      },
      exists: (filePath) => filePath in files,
    };

    const result = await execute(['run', 'urls.txt', '--hints', 'hints.json'], deps);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Research/);
    assert.match(result.stdout, /Day 0/);
    assert.match(result.stdout, /Lead form/);
    assert.doesNotMatch(result.stdout, /Widget chat/);
    assert.doesNotMatch(result.stdout, /would send:/);
    assert.match(result.stdout, /gubagoo/);
    assert.match(result.stdout, /composer_not_found/);
    assert.match(result.stdout, /lead_form/);
    assert.equal(pages.every((page) => page.sent.length === 0 && page.gotos.length === 1), true);
    const saved = JSON.stringify(directory.writes);
    assert.equal(saved.includes('5550177'), false);
    assert.equal(saved.includes('marketcheck'), false);
    assert.equal(saved.includes('1HGCV1F16NA000001'), false);
    assert.equal(attempts.attempts.length, 4);
    const leads = attempts.attempts.filter((attempt) => attempt.channel === 'lead_form');
    const scans = attempts.attempts.filter((attempt) => attempt.channel === 'widget');
    assert.equal(leads.length, 2);
    assert.equal(scans.length, 2);
    assert.equal(leads.every((attempt) => attempt.status === 'unknown' && attempt.stop_reason === 'unsupported_vendor'), true);
    assert.equal(leads.every((attempt) => attempt.selected_channels === 'lead_form'), true);
    assert.equal(
      scans.every(
        (attempt) =>
          attempt.status === 'composer_not_found' &&
          attempt.selected_channels === 'lead_form' &&
          (attempt.channel_reason ?? '').includes('composer_not_found'),
      ),
      true,
    );
  });

  it('health logs the form it would fill and writes a dry-run attempt', async () => {
    const attempts = new MemoryAttemptStore();
    const page = new FakeChatPage(availability);
    const result = await execute(['health', pageUrl], healthDeps(attempts, page));
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /dry_run true/);
    assert.match(result.stdout, /sends false/);
    assert.match(result.stdout, /first_name: Maya/);
    assert.match(result.stdout, /email: deals@drevvy\.test/);
    assert.equal(page.outreach.length, 0);
    assert.equal(page.submits.length, 0);
    assert.equal(page.sent.length, 0);
    assert.equal(attempts.attempts.length, 1);
    assert.equal(attempts.attempts[0]?.dry_run, true);
    assert.equal(attempts.attempts[0]?.status, 'dry_run');
    assert.equal(attempts.attempts[0]?.channel, 'lead_form');
    assert.match(result.stdout, /Health summary/);
    assert.match(result.stdout, /vendors: unknown=1/);
    assert.match(result.stdout, /reasons: dry_run=1/);
  });

  it('health with no urls writes nothing and does not open a page', async () => {
    const attempts = new MemoryAttemptStore();
    let opened = 0;
    const result = await execute(['health'], {
      ...healthDeps(attempts, new FakeChatPage(availability)),
      openPage: async () => {
        opened += 1;
        const page = new FakeChatPage(availability);
        return { page, close: () => page.close() };
      },
    });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /urls 0/);
    assert.equal(attempts.attempts.length, 0);
    assert.equal(opened, 0);
  });

  it('health reads WIDGET_HEALTH_URLS and ignores DRY_RUN=false', async () => {
    const attempts = new MemoryAttemptStore();
    const page = new FakeChatPage(availability);
    const result = await execute(['health'], {
      ...healthDeps(attempts, page),
      config: { ...config, dryRun: false, allowlist: ['https://www.example-motors.test'] },
      env: { WIDGET_HEALTH_URLS: pageUrl },
    });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /DRY_RUN=false is ignored/);
    assert.equal(page.submits.length, 0);
    assert.equal(page.outreach.length, 0);
    assert.equal(attempts.attempts[0]?.dry_run, true);
    assert.equal(attempts.attempts[0]?.status, 'dry_run');
  });

  it('chat skips the widget channel for a call/email-only dealer', async () => {
    const directory = new MemoryDirectoryStore();
    await directory.markCallEmailOnly('https://www.example-motors.test');
    let opened = 0;
    const result = await execute(['chat', pageUrl], {
      ...healthDeps(new MemoryAttemptStore(), new FakeChatPage(availability)),
      directory,
      openPage: async () => {
        opened += 1;
        const page = new FakeChatPage(availability);
        return { page, close: () => page.close() };
      },
    });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Widget channel skipped/);
    assert.match(result.stdout, /call_email_only/);
    assert.equal(opened, 0);
  });
});

function healthDeps(attempts: MemoryAttemptStore, page: FakeChatPage): CliDeps {
  return {
    config,
    directory: new MemoryDirectoryStore(),
    attempts,
    fetchPage: async (url) => ({ url, status: 200, html: availability }),
    ai: { async complete() { throw new Error('health must not call the model'); } },
    openPage: async () => ({ page, close: () => page.close() }),
    readFile: () => { throw new Error('missing file'); },
    exists: () => false,
    env: {},
  };
}
