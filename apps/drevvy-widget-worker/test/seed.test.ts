import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config';
import { loadConfig } from '../src/config';
import { execute, type CliDeps } from '../src/cli';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { formatDirectoryReport, summarizeDirectory } from '../src/directory/report';
import { parseLaunchAreas } from '../src/seed/areas';
import { dealerHintKeys, listMarketCheckDealers, readDealerPage, type DealerHint } from '../src/seed/marketcheck';
import { seedDirectory, type DealerSource } from '../src/seed/run';
import { readFixture } from './fixture';

const html = readFixture('gubagoo-vdp.html');
const wall = readFixture('sokal-blocked.html');
const now = new Date('2026-10-16T00:00:00.000Z');
const secret = 'super-secret-key';
const vin = '1HGCV1F16NA000001';

const example: DealerHint = {
  name: 'Hint Motors',
  siteUrl: 'https://www.example-motors.test',
  phone: '8035550177',
  email: 'hint@marketcheck.test',
};
const fresh: DealerHint = {
  name: 'Fresh Motors',
  siteUrl: 'https://www.fresh-motors.test',
  phone: null,
  email: null,
};
const walled: DealerHint = {
  name: 'Walled Motors',
  siteUrl: 'https://www.walled-motors.test',
  phone: '8035550100',
  email: 'sales@walled-motors.test',
};

function dealerPayload() {
  return {
    num_found: 1,
    listings: [{ vin, price: 19999, media: { photo_links: ['https://images.marketcheck.com/secret.jpg'] } }],
    dealers: [
      {
        id: 'mc-1',
        seller_name: 'Example Motors',
        inventory_url: 'https://www.example-motors.test/inventory/civic',
        seller_phone: '8035550177',
        seller_email: 'hint@marketcheck.test',
        street: '1 Secret Street',
        city: 'Columbia',
        state: 'SC',
        zip: '29201',
        latitude: '34.0001',
        longitude: '-81.0001',
        listing_count: 40,
        listings: [{ vin, price: 25000 }],
      },
      {
        seller_name: 'MarketCheck',
        inventory_url: 'https://api.marketcheck.com/v2/dealers/car',
        seller_phone: '8035550199',
      },
      { seller_name: 'No Site Motors' },
    ],
  };
}

describe('launch areas', () => {
  it('parses ZIP codes and radii, and keeps the first copy of a ZIP', () => {
    const areas = parseLaunchAreas('# launch\n\n29201 25\n29401\n29201 99\n', 10);
    assert.deepEqual(areas, [
      { zip: '29201', radiusMiles: 25 },
      { zip: '29401', radiusMiles: 10 },
    ]);
  });

  it('rejects a missing radius, a bad ZIP, and a radius outside 1 to 500', () => {
    assert.throws(() => parseLaunchAreas('29201\n', null), /radius/);
    assert.throws(() => parseLaunchAreas('2920\n', 25), /ZIP/);
    assert.throws(() => parseLaunchAreas('29201 0\n', null), /1 to 500/);
    assert.throws(() => parseLaunchAreas('29201 501\n', null), /1 to 500/);
  });
});

describe('MarketCheck dealer hints', () => {
  it('keeps name, website, and contact hints, and drops listing fields', () => {
    const page = readDealerPage(dealerPayload());
    assert.equal(page.count, 3);
    assert.equal(page.numFound, 1);
    assert.equal(page.hints.length, 1);
    const hint = page.hints[0];
    assert.ok(hint);
    assert.deepEqual(Object.keys(hint).sort(), [...dealerHintKeys()].sort());
    assert.equal(hint.siteUrl, 'https://www.example-motors.test');
    assert.equal(hint.name, 'Example Motors');
    assert.equal(hint.phone, '8035550177');
    assert.equal(hint.email, 'hint@marketcheck.test');
    const saved = JSON.stringify(page.hints);
    assert.equal(saved.includes(vin), false);
    assert.equal(saved.includes('Secret'), false);
    assert.equal(saved.includes('19999'), false);
    assert.equal(saved.includes('25000'), false);
    assert.equal(saved.includes('34.0001'), false);
    assert.equal(saved.includes('mc-1'), false);
    assert.equal(saved.includes('marketcheck.com'), false);
  });

  it('refuses a listings payload', () => {
    assert.throws(() => readDealerPage({ listings: [{ vin, price: 10000 }] }), /listings/);
  });

  it('pages the dealers list and does not leak the API key', async () => {
    const urls: URL[] = [];
    const paceCalls: number[] = [];
    let clock = 0;
    const fetchImpl = (async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input));
      urls.push(url);
      const start = Number(url.searchParams.get('start'));
      const body =
        start === 0
          ? { num_found: 2, dealers: [{ seller_name: 'Example Motors', inventory_url: 'https://www.example-motors.test' }] }
          : { num_found: 2, dealers: [{ seller_name: 'Second Motors', website: 'www.second-motors.test' }] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const hints = await listMarketCheckDealers({
      area: { zip: '29201', radiusMiles: 25 },
      apiKey: secret,
      baseUrl: 'https://api.marketcheck.com',
      timeoutMs: 1000,
      rows: 1,
      pace: async () => {
        paceCalls.push(clock);
        clock += 1;
      },
      fetchImpl,
    });

    assert.equal(urls.length, 2);
    assert.equal(urls[0]?.pathname, '/v2/dealers/car');
    assert.equal(urls[0]?.searchParams.get('zip'), '29201');
    assert.equal(urls[0]?.searchParams.get('radius'), '25');
    assert.equal(urls[0]?.searchParams.get('start'), '0');
    assert.equal(urls[0]?.searchParams.get('api_key'), secret);
    assert.equal(urls[1]?.searchParams.get('start'), '1');
    assert.deepEqual(
      hints.map((hint) => hint.siteUrl),
      ['https://www.example-motors.test', 'https://www.second-motors.test'],
    );
    assert.equal(JSON.stringify(hints).includes(secret), false);
    assert.equal(paceCalls.length, 2);

    await assert.rejects(
      () =>
        listMarketCheckDealers({
          area: { zip: '29201', radiusMiles: 25 },
          apiKey: secret,
          baseUrl: 'https://api.marketcheck.com',
          timeoutMs: 1000,
          pace: async () => undefined,
          fetchImpl: (async (input: Parameters<typeof fetch>[0]) => {
            throw new Error(`network down ${String(input)}`);
          }) as typeof fetch,
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.equal(message.includes(secret), false);
        assert.match(message, /ZIP 29201/);
        return true;
      },
    );

    await assert.rejects(
      () =>
        listMarketCheckDealers({
          area: { zip: '29201', radiusMiles: 25 },
          apiKey: secret,
          baseUrl: 'https://api.marketcheck.com',
          timeoutMs: 1000,
          pace: async () => undefined,
          fetchImpl: (async () =>
            new Response(null, {
              status: 302,
              headers: { location: `https://evil.test/?api_key=${secret}` },
            })) as typeof fetch,
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.equal(message.includes(secret), false);
        assert.equal(message.includes('evil.test'), false);
        assert.match(message, /redirected/);
        return true;
      },
    );
  });
});

describe('seed directory', () => {
  it('researches dealer sites, skips fresh and walled rows, and resumes', async () => {
    const store = new MemoryDirectoryStore();
    await store.upsert({
      site_url: fresh.siteUrl,
      name: 'Fresh Motors',
      phones: ['+18035550100'],
      emails: ['sales@fresh-motors.test'],
      widget_vendor: 'carnow',
      widget_playbook: 'carnow',
      source_urls: ['https://www.fresh-motors.test/'],
      confidence: 0.9,
      last_checked_at: now.toISOString(),
      status: 'active',
    });
    const fetched: string[] = [];
    let aiCalls = 0;
    let clock = 1_000_000;
    const sleeps: number[] = [];
    const logs: string[] = [];
    const listDealers: DealerSource = async (area, pace) => {
      await pace();
      if (area.zip === '29401') throw new Error('MarketCheck dealers request failed for ZIP 29401 (429).');
      if (area.zip === '29205') return [{ ...example, vin, street: '1 Secret Street' } as DealerHint];
      return [example, fresh, walled, { name: 'Nope', siteUrl: 'https://api.marketcheck.com/v2', phone: null, email: null }, example];
    };

    const summary = await seedDirectory({
      areas: [
        { zip: '29201', radiusMiles: 25 },
        { zip: '29401', radiusMiles: 25 },
        { zip: '29205', radiusMiles: 10 },
      ],
      listDealers,
      fetchPage: async (url) => {
        fetched.push(url);
        if (url.includes('walled-motors')) return { url, status: 200, html: wall };
        return { url, status: 200, html };
      },
      ai: {
        async complete() {
          aiCalls += 1;
          return JSON.stringify({
            name: 'Example Motors',
            phones: ['(803) 555-0199', '803-555-0177'],
            emails: ['sales@example-motors.test', 'hint@marketcheck.test'],
            widget_vendor: 'gubagoo',
            confidence: 0.91,
          });
        },
      },
      store,
      now,
      minIntervalMs: 1000,
      clock: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      log: (line) => logs.push(line),
    });

    assert.deepEqual(sleeps, [1000, 1000, 1000, 1000]);
    assert.deepEqual(fetched, ['https://www.example-motors.test/', 'https://www.walled-motors.test/']);
    assert.equal(aiCalls, 1);
    assert.equal(summary.dealers, 3);
    assert.equal(summary.researched, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.blocked, 1);
    assert.equal(summary.errors, 1);
    assert.equal(summary.areaErrors, 1);
    assert.deepEqual(
      summary.rows.map((row) => [row.siteUrl, row.action, row.status]),
      [
        ['https://www.example-motors.test', 'researched', 'active'],
        ['https://www.fresh-motors.test', 'skipped', 'active'],
        ['https://www.walled-motors.test', 'blocked', 'blocked'],
      ],
    );

    const exampleRow = store.rows.get(example.siteUrl);
    assert.equal(exampleRow?.name, 'Example Motors');
    assert.deepEqual(exampleRow?.phones, ['+18035550199']);
    assert.deepEqual(exampleRow?.emails, ['sales@example-motors.test']);
    assert.equal(exampleRow?.widget_vendor, 'gubagoo');
    assert.deepEqual(exampleRow?.source_urls, ['https://www.example-motors.test/']);
    assert.ok((exampleRow?.confidence ?? 0) >= 0.8);
    const walledRow = store.rows.get(walled.siteUrl);
    assert.equal(walledRow?.status, 'blocked');
    assert.deepEqual(walledRow?.phones, []);
    assert.deepEqual(walledRow?.emails, []);
    assert.deepEqual(walledRow?.source_urls, ['https://www.walled-motors.test/']);
    const saved = JSON.stringify(store.writes);
    assert.equal(saved.includes(vin), false);
    assert.equal(saved.includes('Secret'), false);
    assert.equal(saved.includes('5550177'), false);
    assert.equal(saved.includes('marketcheck'), false);
    assert.equal(saved.includes('Hint Motors'), false);
    assert.equal(logs.join('\n').includes(secret), false);
    assert.match(logs.join('\n'), /29401/);

    const resumed = await seedDirectory({
      areas: [{ zip: '29201', radiusMiles: 25 }],
      listDealers: async (_area, pace) => {
        await pace();
        return [example, fresh, walled];
      },
      fetchPage: async () => {
        throw new Error('should not fetch a fresh directory');
      },
      ai: {
        async complete() {
          throw new Error('should not call the model');
        },
      },
      store,
      now,
      minIntervalMs: 0,
      log: () => undefined,
    });
    assert.equal(resumed.skipped, 3);
    assert.equal(resumed.researched, 0);
    assert.equal(resumed.blocked, 0);

    const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 1);
    const refreshedFetches: string[] = [];
    const refreshed = await seedDirectory({
      areas: [{ zip: '29201', radiusMiles: 25 }],
      listDealers: async () => [example, fresh, walled],
      fetchPage: async (url) => {
        refreshedFetches.push(url);
        if (url.includes('walled-motors')) return { url, status: 200, html: wall };
        return { url, status: 200, html };
      },
      ai: {
        async complete() {
          return JSON.stringify({
            name: 'Example Motors',
            phones: ['(803) 555-0199'],
            emails: ['sales@example-motors.test'],
            widget_vendor: 'gubagoo',
            confidence: 0.9,
          });
        },
      },
      store,
      now: later,
      minIntervalMs: 0,
      log: () => undefined,
    });
    assert.equal(refreshed.skipped, 0);
    assert.deepEqual(refreshedFetches, [
      'https://www.example-motors.test/',
      'https://www.fresh-motors.test/',
      'https://www.walled-motors.test/',
    ]);
    assert.equal(store.rows.get(walled.siteUrl)?.status, 'blocked');
    assert.equal(store.rows.get(fresh.siteUrl)?.phones.includes('+18035550199'), true);
  });
});

describe('directory report', () => {
  it('counts vendors, statuses, and phone and email coverage', () => {
    const rows = [
      {
        id: '1',
        site_url: 'https://www.example-motors.test',
        name: 'Example Motors',
        phones: ['+18035550199'],
        emails: ['sales@example-motors.test'],
        widget_vendor: 'gubagoo',
        widget_playbook: 'gubagoo',
        source_urls: ['https://www.example-motors.test/'],
        confidence: 0.9,
        last_checked_at: now.toISOString(),
        status: 'active' as const,
        call_email_only: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: '2',
        site_url: 'https://www.walled-motors.test',
        name: null,
        phones: [],
        emails: [],
        widget_vendor: null,
        widget_playbook: null,
        source_urls: ['https://www.walled-motors.test/'],
        confidence: null,
        last_checked_at: now.toISOString(),
        status: 'blocked' as const,
        call_email_only: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];
    const report = summarizeDirectory(rows);
    assert.equal(report.dealers, 2);
    assert.equal(report.byStatus.active, 1);
    assert.equal(report.byStatus.blocked, 1);
    assert.equal(report.byStatus.no_widget, 0);
    assert.equal(report.phone, 1);
    assert.equal(report.email, 1);
    assert.equal(report.both, 1);
    assert.equal(report.neither, 1);
    assert.deepEqual(
      report.byVendor.map((entry) => entry.vendor),
      ['(none)', 'gubagoo'],
    );
    const text = formatDirectoryReport(report);
    assert.match(text, /By status/);
    assert.match(text, /By vendor/);
    assert.match(text, /blocked\s+1/);
    assert.match(text, /gubagoo\s+1/);
    assert.match(text, /phone\s+1\/2 \(50%\)/);
    assert.match(text, /email\s+1\/2 \(50%\)/);
    assert.match(text, /neither\s+1\/2 \(50%\)/);
    assert.match(formatDirectoryReport(summarizeDirectory([])), /0\/0 \(0%\)/);
  });
});

describe('seed and report commands', () => {
  it('does not open a browser or send a message, and prints the report', async () => {
    const directory = new MemoryDirectoryStore();
    const attempts = new MemoryAttemptStore();
    let opened = false;
    const files: Record<string, string> = {
      'launch-areas.txt': '# area\n29201 25\n29401\n',
    };
    const config: AppConfig = {
      ...loadConfig({
        AI_API_KEY: 'test-key',
        AI_MODEL: 'grok-4',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        SEED_MIN_INTERVAL_MS: '0',
      }),
    };
    const deps: CliDeps = {
      config,
      directory,
      attempts,
      fetchPage: async (url) => ({ url, status: 200, html: url.includes('walled') ? wall : html }),
      ai: {
        async complete() {
          return JSON.stringify({
            name: 'Example Motors',
            phones: ['(803) 555-0199'],
            emails: ['sales@example-motors.test'],
            widget_vendor: 'gubagoo',
            confidence: 0.9,
          });
        },
      },
      openPage: async () => {
        opened = true;
        throw new Error('seed must not open a browser');
      },
      readFile: (filePath) => {
        const text = files[filePath];
        if (text == null) throw new Error(`missing ${filePath}`);
        return text;
      },
      exists: (filePath) => filePath in files,
      now: () => now,
      listDealers: async (area) => {
        assert.equal(area.radiusMiles, area.zip === '29401' ? 40 : 25);
        return area.zip === '29401' ? [walled] : [example];
      },
    };

    const help = await execute(['--help'], deps);
    assert.match(help.stdout, /seed/);
    assert.match(help.stdout, /report/);
    assert.match(help.stdout, /never sends a message/);

    const missing = await execute(['seed'], deps);
    assert.equal(missing.exitCode, 1);

    const seeded = await execute(['seed', 'launch-areas.txt', '--radius', '40'], deps);
    assert.equal(seeded.exitCode, 0, seeded.stderr);
    assert.equal(opened, false);
    assert.equal(attempts.attempts.length, 0);
    assert.match(seeded.stdout, /Seed/);
    assert.match(seeded.stdout, /gubagoo/);
    assert.match(seeded.stdout, /blocked/);
    assert.doesNotMatch(seeded.stdout, /would send/);
    assert.equal(seeded.stdout.includes('5550177'), false);
    assert.equal(seeded.stdout.includes(secret), false);

    const report = await execute(['report'], deps);
    assert.equal(report.exitCode, 0, report.stderr);
    assert.match(report.stdout, /Directory report/);
    assert.match(report.stdout, /By status/);
    assert.match(report.stdout, /By vendor/);
    assert.match(report.stdout, /gubagoo/);
    assert.match(report.stdout, /phone\s+1\/2 \(50%\)/);
    assert.match(report.stdout, /email\s+1\/2 \(50%\)/);
    assert.equal(opened, false);
  });
});
