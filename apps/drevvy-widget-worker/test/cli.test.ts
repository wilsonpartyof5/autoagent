import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config';
import { execute, type CliDeps } from '../src/cli';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { formatResultsTable, parseUrlList } from '../src/cli/format';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

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

  it('runs research and a dry-run chat for a list of urls', async () => {
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
    assert.match(result.stdout, /Widget chat/);
    assert.match(result.stdout, /gubagoo/);
    assert.match(result.stdout, /dry_run/);
    assert.match(result.stdout, /would send: Is this unit still available\? Stock #H24118/);
    assert.equal(pages.every((page) => page.sent.length === 0 && page.gotos.length === 1), true);
    assert.equal(directory.writes.length, 1);
    const saved = JSON.stringify(directory.writes[0]);
    assert.equal(saved.includes('5550177'), false);
    assert.equal(saved.includes('marketcheck'), false);
    assert.equal(saved.includes('1HGCV1F16NA000001'), false);
    assert.equal(attempts.attempts.length, 4);
    const leads = attempts.attempts.filter((attempt) => attempt.channel === 'lead_form');
    const widgets = attempts.attempts.filter((attempt) => attempt.channel === 'widget');
    assert.equal(leads.length, 2);
    assert.equal(widgets.length, 2);
    assert.equal(leads.every((attempt) => attempt.status === 'unknown' && attempt.stop_reason === 'no_lead_form'), true);
    assert.equal(widgets.every((attempt) => attempt.dry_run && attempt.status === 'dry_run'), true);
    assert.match(result.stdout, /Lead form/);
  });
});
