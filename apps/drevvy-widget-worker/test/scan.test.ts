import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config';
import { execute, type CliDeps } from '../src/cli';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { runScan } from '../src/scan/run';
import { isBotBlockedPage } from '../src/forms/outreach';
import { detectVendorEvidence } from '../src/widgets/evidence';
import { htmlHasSelector } from '../src/widgets/match';
import { isOverlayDismiss } from '../src/widgets/overlays';
import { playbookForVendor } from '../src/widgets/playbooks';
import { parseLauncherPoint } from '../src/widgets/vision';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';

const quietAi = {
  async complete() {
    return JSON.stringify({ found: false, x: 0, y: 0, reason: 'no chat bubble' });
  },
};

function scanPage(html: string, options: ConstructorParameters<typeof FakeChatPage>[1] = {}) {
  return new FakeChatPage(html, options);
}

async function scan(page: FakeChatPage, ai: { complete: (request: never) => Promise<string> } = quietAi) {
  const attempts = new MemoryAttemptStore();
  const directory = new MemoryDirectoryStore();
  const result = await runScan({
    vehiclePageUrl: pageUrl,
    page,
    ai,
    attempts,
    directory,
  });
  return { result, attempts, directory, page };
}

describe('scan snapshots', () => {
  it('reads a CarNow launcher from a network request and an iframe', async () => {
    const host = readFixture('carnow-host.html');
    const frame = readFixture('carnow-frame.html');
    const evidence = detectVendorEvidence({
      html: host,
      frames: [{ url: 'https://app.carnow.com/chat', html: frame }],
      networkUrls: ['https://app.carnow.com/widget.js'],
    });
    assert.equal(evidence.vendor, 'carnow');
    assert.equal(evidence.source, 'network');

    const page = scanPage(host, {
      networkUrls: ['https://app.carnow.com/widget.js'],
      frames: [{ url: 'https://app.carnow.com/chat', html: frame }],
    });
    const { result, page: used } = await scan(page);
    assert.equal(result.status, 'dry_run');
    assert.equal(result.widgetVendor, 'carnow');
    assert.equal(result.playbook, 'carnow');
    assert.match(result.reason, /carnow playbook/);
    assert.deepEqual(used.sent, []);
    assert.deepEqual(used.outreach, []);
    assert.deepEqual(used.submits, []);
  });

  it('records widget_offline when a Gubagoo script never renders a launcher', async () => {
    const { result, directory } = await scan(scanPage(readFixture('gubagoo-offline.html')));
    assert.equal(result.status, 'widget_offline');
    assert.equal(result.widgetVendor, 'gubagoo');
    assert.equal(result.playbook, 'gubagoo');
    assert.match(result.reason, /gubagoo/);
    assert.match(result.reason, /script/);
    assert.match(result.reason, /launcher/i);
    assert.equal(directory.writes[0]?.widget_playbook, 'gubagoo');
    assert.equal(directory.writes[0]?.widget_vendor, 'gubagoo');
    assert.equal(directory.writes[0]?.status, 'active');
  });

  it('records no_widget when nothing chat-like appears', async () => {
    const { result, directory } = await scan(scanPage(readFixture('no-widget.html')));
    assert.equal(result.status, 'no_widget');
    assert.equal(result.widgetVendor, null);
    assert.equal(result.playbook, 'generic');
    assert.equal(directory.writes[0]?.status, 'no_widget');
  });

  it('classifies SOKAL and a short access-denied page as blocked', async () => {
    assert.equal(isBotBlockedPage(readFixture('sokal-title.html')), true);
    assert.equal(isBotBlockedPage(readFixture('access-denied.html')), true);
    assert.equal(isBotBlockedPage(readFixture('inventory-access.html')), false);
    const longInventory = `${readFixture('inventory-access.html')}<script src="https://ct.datadome.co/tags.js"></script>`;
    assert.equal(isBotBlockedPage(longInventory), false);

    const title = await scan(scanPage(readFixture('sokal-title.html')));
    assert.equal(title.result.status, 'blocked');
    assert.equal(title.directory.writes[0]?.status, 'needs_review');
    assert.equal(title.page.points.length, 0);

    const denied = await scan(scanPage(readFixture('access-denied.html')));
    assert.equal(denied.result.status, 'blocked');

    const inventory = await scan(scanPage(readFixture('inventory-access.html')));
    assert.equal(inventory.result.status, 'no_widget');
  });

  it('dismisses a cookie banner and a trade-in popup, then finds the composer', async () => {
    const page = scanPage(readFixture('cookie-banner.html'), {
      htmlAfterDismiss: readFixture('gubagoo-ready.html'),
    });
    const { result, page: used } = await scan(page);
    assert.deepEqual(used.dismissed, ['Accept All', 'No thanks']);
    assert.equal(result.status, 'dry_run');
    assert.equal(result.widgetVendor, 'gubagoo');
    assert.equal(result.playbook, 'gubagoo');
    assert.deepEqual(used.sent, []);
    assert.deepEqual(used.outreach, []);
    assert.deepEqual(used.clicks, []);
  });

  it('clicks a vision point for an unknown launcher and does not type', async () => {
    const page = scanPage(readFixture('no-widget.html'), { composerAfterVision: true });
    const ai = {
      async complete() {
        return JSON.stringify({ found: true, x: 1180, y: 860, reason: 'round chat bubble in the corner' });
      },
    };
    const { result, page: used, directory } = await scan(page, ai);
    assert.equal(result.status, 'dry_run');
    assert.equal(result.widgetVendor, null);
    assert.equal(result.playbook, 'generic');
    assert.deepEqual(used.points, [{ x: 1180, y: 860 }]);
    assert.deepEqual(used.sent, []);
    assert.deepEqual(used.outreach, []);
    assert.equal(directory.writes[0]?.status, 'active');
    assert.equal(directory.writes[0]?.widget_playbook, 'generic');
  });

  it('records page_timeout when the browser never finishes loading', async () => {
    const page = scanPage(readFixture('no-widget.html'), {
      gotoError: new Error('Timeout 30000ms exceeded'),
    });
    const { result, directory, page: used } = await scan(page);
    assert.equal(result.status, 'page_timeout');
    assert.match(result.reason, /timed out/i);
    assert.equal(directory.writes[0]?.status, 'needs_review');
    assert.deepEqual(used.gotos, []);
  });

  it('does not open a site that was already recorded as blocked', async () => {
    const attempts = new MemoryAttemptStore();
    const directory = new MemoryDirectoryStore();
    const first = scanPage(readFixture('sokal-title.html'));
    const firstResult = await runScan({
      vehiclePageUrl: pageUrl,
      page: first,
      ai: quietAi,
      attempts,
      directory,
    });
    assert.equal(firstResult.status, 'blocked');
    assert.equal(firstResult.id == null, false);
    assert.deepEqual(first.gotos, [pageUrl]);

    const second = scanPage(readFixture('gubagoo-ready.html'));
    const secondResult = await runScan({
      vehiclePageUrl: pageUrl,
      page: second,
      ai: quietAi,
      attempts,
      directory,
    });
    assert.equal(secondResult.status, 'blocked');
    assert.equal(secondResult.id, null);
    assert.deepEqual(second.gotos, []);
    assert.equal(attempts.attempts.length, 1);
  });

  it('stops on a captcha without clicking or filling', async () => {
    const page = scanPage(readFixture('captcha-widget.html'));
    const { result, page: used } = await scan(page);
    assert.equal(result.status, 'captcha');
    assert.match(result.reason, /captcha/i);
    assert.deepEqual(used.points, []);
    assert.deepEqual(used.clicks, []);
    assert.deepEqual(used.sent, []);
    assert.deepEqual(used.outreach, []);
    assert.equal(used.screenshots, 0);
  });

  it('records composer_not_found after one launcher click', async () => {
    const page = scanPage(readFixture('gubagoo-vdp.html'));
    const { result, page: used } = await scan(page);
    assert.equal(result.status, 'composer_not_found');
    assert.equal(result.widgetVendor, 'gubagoo');
    assert.equal(used.clicks.length, 1);
    assert.deepEqual(used.sent, []);
    assert.deepEqual(used.outreach, []);
  });

  it('keeps stored phones and emails when a scan updates the playbook', async () => {
    const directory = new MemoryDirectoryStore();
    await directory.upsert({
      site_url: 'https://www.example-motors.test',
      name: 'Example Motors',
      phones: ['8035550199'],
      emails: ['sales@example-motors.test'],
      widget_vendor: null,
      widget_playbook: null,
      source_urls: ['https://www.example-motors.test/'],
      confidence: 0.4,
      last_checked_at: '2026-01-01T00:00:00.000Z',
      status: 'no_widget',
    });
    const page = scanPage(readFixture('gubagoo-ready.html'));
    const result = await runScan({
      vehiclePageUrl: pageUrl,
      page,
      ai: quietAi,
      attempts: new MemoryAttemptStore(),
      directory,
    });
    assert.equal(result.status, 'dry_run');
    const saved = directory.rows.get('https://www.example-motors.test');
    assert.deepEqual(saved?.phones, ['8035550199']);
    assert.deepEqual(saved?.emails, ['sales@example-motors.test']);
    assert.equal(saved?.name, 'Example Motors');
    assert.equal(saved?.widget_vendor, 'gubagoo');
    assert.equal(saved?.widget_playbook, 'gubagoo');
    assert.equal(saved?.source_urls.includes(pageUrl), true);
  });

  it('waits for a late-loading widget before deciding', async () => {
    const page = scanPage(readFixture('no-widget.html'), {
      afterSettleHtml: readFixture('gubagoo-ready.html'),
    });
    const { result } = await scan(page);
    assert.equal(result.status, 'dry_run');
    assert.equal(result.widgetVendor, 'gubagoo');
    assert.equal(result.playbook, 'gubagoo');
  });

  it('prints a scan table from the cli', async () => {
    const files: Record<string, string> = {
      'urls.txt': `${pageUrl}\n`,
    };
    const config: AppConfig = {
      aiBaseUrl: 'https://api.x.ai/v1',
      aiApiKey: null,
      aiModel: null,
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'service',
      dryRun: true,
      allowlist: [],
      drevvyTextNumber: null,
      drevvyEmail: null,
      shopperFirst: null,
      leadLastName: 'via Drevvy',
      leadZip: null,
      fetchTimeoutMs: 1000,
      maxTurns: 6,
      scanSettleMs: 0,
    };
    const deps: CliDeps = {
      config,
      directory: new MemoryDirectoryStore(),
      attempts: new MemoryAttemptStore(),
      fetchPage: async (url) => ({ url, status: 200, html: '' }),
      ai: quietAi,
      openPage: async () => {
        const page = scanPage(readFixture('gubagoo-ready.html'));
        return { page, close: () => page.close() };
      },
      readFile: (filePath) => {
        const text = files[filePath];
        if (text == null) throw new Error(`missing ${filePath}`);
        return text;
      },
      exists: (filePath) => filePath in files,
    };
    const cli = await execute(['scan', 'urls.txt'], deps);
    assert.equal(cli.exitCode, 0, cli.stderr);
    assert.match(cli.stdout, /Scan/);
    assert.match(cli.stdout, /vendor/);
    assert.match(cli.stdout, /status/);
    assert.match(cli.stdout, /gubagoo/);
    assert.match(cli.stdout, /dry_run/);
    assert.match(cli.stdout, /playbook/);
  });
});

describe('widget finding helpers', () => {
  it('parses a launcher point and rejects captcha, cookies, and wild coordinates', () => {
    assert.deepEqual(parseLauncherPoint('{"found":true,"x":12,"y":40,"reason":"chat bubble"}'), {
      x: 12,
      y: 40,
      reason: 'chat bubble',
    });
    assert.equal(parseLauncherPoint('{"found":false,"x":12,"y":40,"reason":"none"}'), null);
    assert.equal(parseLauncherPoint('{"found":true,"x":12,"y":40,"reason":"cookie banner"}'), null);
    assert.equal(parseLauncherPoint('{"found":true,"x":12,"y":40,"reason":"trade-in popup"}'), null);
    assert.equal(parseLauncherPoint('{"found":true,"x":9000,"y":10,"reason":"chat"}'), null);
    assert.equal(parseLauncherPoint('not json'), null);
  });

  it('dismisses cookie and trade-in controls and leaves chat controls alone', () => {
    assert.equal(isOverlayDismiss('Accept All', 'ComplyAuto cookies'), true);
    assert.equal(isOverlayDismiss('Accept', 'hello'), false);
    assert.equal(isOverlayDismiss('Accept', 'cookie consent'), true);
    assert.equal(isOverlayDismiss('No thanks', 'Value your trade-in'), true);
    assert.equal(isOverlayDismiss('Chat', ''), false);
    assert.equal(isOverlayDismiss('Text us', 'cookies'), false);
    assert.equal(isOverlayDismiss('Check Availability', 'cookies'), false);
  });

  it('matches a single launcher or composer tag', () => {
    const html = readFixture('gubagoo-ready.html');
    assert.equal(htmlHasSelector(html, '.gg-chat-launcher'), true);
    assert.equal(htmlHasSelector(html, '#gg-chat-input'), true);
    assert.equal(htmlHasSelector(html, '#gubagoo-toolbar button'), false);
    assert.equal(htmlHasSelector(html, '.cn-chat-button'), false);
  });

  it('maps Gubagoo and CarNow to their playbooks and everything else to generic', () => {
    assert.equal(playbookForVendor('gubagoo'), 'gubagoo');
    assert.equal(playbookForVendor('carnow'), 'carnow');
    assert.equal(playbookForVendor('podium'), 'generic');
    assert.equal(playbookForVendor('smartpath'), 'generic');
    assert.equal(playbookForVendor('aiva'), 'generic');
    assert.equal(playbookForVendor(null), 'generic');
  });
});
