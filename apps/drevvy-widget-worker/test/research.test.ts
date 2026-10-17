import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ChatClient, ChatRequest } from '../src/ai/types';
import { DIRECTORY_WRITE_KEYS } from '../src/directory/types';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { researchVehiclePage, type FetchedPage } from '../src/research/job';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';
const html = readFixture('gubagoo-vdp.html');

function fetcher(calls: string[]): (url: string) => Promise<FetchedPage> {
  return async (url) => {
    calls.push(url);
    return { url, status: 200, html };
  };
}

function ai(raw: string, calls: ChatRequest[]): ChatClient {
  return {
    async complete(request) {
      calls.push(request);
      return raw;
    },
  };
}

describe('research job', () => {
  it('stores page contacts and ignores MarketCheck hints that are not on the page', async () => {
    const calls: string[] = [];
    const prompts: ChatRequest[] = [];
    const store = new MemoryDirectoryStore();
    const result = await researchVehiclePage({
      vehiclePageUrl: pageUrl,
      hints: { dealerName: 'Hint Motors', phone: '8035550177', email: 'hint@marketcheck.test' },
      fetchPage: fetcher(calls),
      ai: ai(
        JSON.stringify({
          name: 'Example Motors',
          phones: ['(803) 555-0199', '803-555-0177'],
          emails: ['sales@example-motors.test', 'hint@marketcheck.test'],
          widget_vendor: 'podium',
          confidence: 0.42,
        }),
        prompts,
      ),
      store,
      now: new Date('2026-10-16T00:00:00.000Z'),
    });

    assert.equal(result.error, null);
    assert.equal(result.skipped, false);
    assert.deepEqual(calls, [pageUrl, 'https://www.example-motors.test/']);
    const write = store.writes[0];
    assert.deepEqual(Object.keys(write).sort(), [...DIRECTORY_WRITE_KEYS].sort());
    assert.equal(write.site_url, 'https://www.example-motors.test');
    assert.equal(write.name, 'Example Motors');
    assert.deepEqual(write.phones, ['+18035550199']);
    assert.deepEqual(write.emails, ['sales@example-motors.test']);
    assert.equal(write.widget_vendor, 'gubagoo');
    assert.equal(write.status, 'active');
    assert.ok((write.confidence ?? 0) >= 0.8);
    const saved = JSON.stringify(write);
    assert.equal(saved.includes('8035550177'), false);
    assert.equal(saved.includes('5550177'), false);
    assert.equal(saved.includes('marketcheck'), false);
    assert.equal(saved.includes('Hint Motors'), false);
    const prompt = JSON.stringify(prompts[0]);
    assert.equal(prompt.includes('8035550177'), true);
    assert.equal(prompt.includes('vin'), false);
  });

  it('does not fetch again until the row is older than 30 days', async () => {
    const store = new MemoryDirectoryStore();
    const now = new Date('2026-10-16T00:00:00.000Z');
    await store.upsert({
      site_url: 'https://www.example-motors.test',
      name: 'Example Motors',
      phones: ['+18035550199'],
      emails: [],
      widget_vendor: 'gubagoo',
      widget_playbook: 'gubagoo',
      source_urls: [pageUrl],
      confidence: 0.9,
      last_checked_at: now.toISOString(),
      status: 'active',
    });
    let fetched = false;
    const skipped = await researchVehiclePage({
      vehiclePageUrl: pageUrl,
      fetchPage: async () => {
        fetched = true;
        throw new Error('should not fetch');
      },
      ai: {
        async complete() {
          throw new Error('should not call the model');
        },
      },
      store,
      now,
    });
    assert.equal(skipped.skipped, true);
    assert.equal(fetched, false);

    const due = await researchVehiclePage({
      vehiclePageUrl: pageUrl,
      fetchPage: fetcher([]),
      ai: ai(JSON.stringify({ name: 'Example Motors', phones: [], emails: [], widget_vendor: null, confidence: 0.9 }), []),
      store,
      now: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 1),
    });
    assert.equal(due.skipped, false);
    assert.equal(store.writes.length, 2);
  });

  it('records a bot wall as blocked and does not ask the model', async () => {
    const store = new MemoryDirectoryStore();
    let asked = false;
    const wall = `${readFixture('sokal-blocked.html')}<a href="tel:+18035550199">(803) 555-0199</a>`;
    const result = await researchVehiclePage({
      vehiclePageUrl: pageUrl,
      hints: { dealerName: 'Hint Motors', phone: '8035550177', email: 'hint@marketcheck.test' },
      fetchPage: async (url) => ({ url, status: 200, html: wall }),
      ai: {
        async complete() {
          asked = true;
          throw new Error('should not call the model');
        },
      },
      store,
      now: new Date('2026-10-16T00:00:00.000Z'),
    });
    assert.equal(asked, false);
    assert.equal(result.row?.status, 'blocked');
    assert.deepEqual(result.row?.phones, []);
    assert.deepEqual(result.row?.emails, []);
    assert.equal(result.row?.name, null);
    assert.deepEqual(result.row?.source_urls, [pageUrl, 'https://www.example-motors.test/']);
    const saved = JSON.stringify(store.writes[0]);
    assert.equal(saved.includes('5550177'), false);
    assert.equal(saved.includes('5550199'), false);
    assert.equal(saved.includes('marketcheck'), false);
  });

  it('keeps a 403 bot wall and ignores a page that only says access denied', async () => {
    const store = new MemoryDirectoryStore();
    const denied = await researchVehiclePage({
      vehiclePageUrl: pageUrl,
      fetchPage: async (url) => ({
        url,
        status: 200,
        html: '<html><body><p>Access denied</p></body></html>',
      }),
      ai: ai(JSON.stringify({ name: null, phones: [], emails: [], widget_vendor: null, confidence: 0.2 }), []),
      store,
    });
    assert.equal(denied.row?.status, 'needs_review');

    const blocked = await researchVehiclePage({
      vehiclePageUrl: 'https://www.walled-motors.test/inventory/civic',
      fetchPage: async (url) => ({
        url,
        status: 403,
        html: '<html><title>Access Denied</title><p>You have been blocked.</p></html>',
      }),
      ai: {
        async complete() {
          throw new Error('should not call the model');
        },
      },
      store,
    });
    assert.equal(blocked.row?.status, 'blocked');
    assert.equal(blocked.row?.site_url, 'https://www.walled-motors.test');
  });

  it('refuses a MarketCheck URL and writes nothing', async () => {
    const store = new MemoryDirectoryStore();
    const result = await researchVehiclePage({
      vehiclePageUrl: 'https://api.marketcheck.com/v2/listing/1',
      fetchPage: async () => {
        throw new Error('should not fetch');
      },
      ai: {
        async complete() {
          throw new Error('should not call the model');
        },
      },
      store,
    });
    assert.match(result.error ?? '', /MarketCheck/);
    assert.equal(store.writes.length, 0);
  });
});
