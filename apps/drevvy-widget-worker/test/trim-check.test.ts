import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { availabilityLine } from '../src/widgets/script';
import { checkVehicleTrim, extractVdpTrim } from '../src/forms/trim';
import { runDay0 } from '../src/run/day0';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';
const html = readFixture('trim-mismatch.html');

const config: AppConfig = {
  aiBaseUrl: 'https://api.x.ai/v1',
  aiApiKey: 'test-key',
  aiModel: 'grok-4',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service',
  dryRun: false,
  allowlist: ['https://www.example-motors.test'],
  drevvyTextNumber: '803-555-0148',
  drevvyContactPhone: '803-555-0148',
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

describe('trim check before dealer contact', () => {
  it('reads the dealer page trim and flags a MarketCheck mismatch', () => {
    assert.equal(extractVdpTrim(html), 'Sport Touring');
    const same = checkVehicleTrim({ marketcheck: 'Sport Touring', vdp: 'sport touring', vinDecode: 'Sport Touring' });
    assert.equal(same.mismatch, false);
    assert.equal(same.shopperMessage, null);
    assert.equal(same.verifiedTrim, 'Sport Touring');

    const flagged = checkVehicleTrim({ marketcheck: 'Sport', vdp: 'Sport Touring', vinDecode: 'Sport Touring' });
    assert.equal(flagged.mismatch, true);
    assert.equal(flagged.verifiedTrim, 'Sport Touring');
    assert.match(flagged.shopperMessage ?? '', /MarketCheck listed the trim as Sport/);
    assert.match(flagged.shopperMessage ?? '', /dealer's page lists Sport Touring/);
    assert.equal(
      availabilityLine({ stockNumber: 'H24118', vin: '1HGCV1F16RA123456' }),
      'Hi, is stock #H24118 still available?',
    );
    assert.equal(availabilityLine({ stockNumber: 'H24118' }).includes('Sport'), false);
  });

  it('flags the deal, keeps the stock-number opener, and tells the shopper', async () => {
    const flags: string[] = [];
    const pages: FakeChatPage[] = [];
    const [run] = await runDay0({
      targets: [{
        url: pageUrl,
        stockNumber: null,
        dealId: 'deal-trim',
        vin: '1HGCV1F16RA123456',
        marketcheckTrim: 'Sport',
        year: 2024,
        make: 'Honda',
        model: 'Civic',
      }],
      openPage: async () => {
        const page = new FakeChatPage(html, { replies: ['This unit has been sold.'] });
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: {
        async complete(request: { messages: Array<{ content: string | unknown }> }) {
          const user = request.messages[1];
          const text = typeof user?.content === 'string' ? user.content : '';
          if (text.includes('sold') || text.includes('Dealer reply')) {
            return JSON.stringify({ status: 'sold', price: null, next_message: 'none' });
          }
          return JSON.stringify({ found: false });
        },
      },
      attempts: new MemoryAttemptStore(),
      directory: new MemoryDirectoryStore(),
      config,
      decodeVin: async () => 'Sport Touring',
      onTrimFlag: async (flag) => {
        flags.push(`${flag.dealId}:${flag.check.verifiedTrim}`);
      },
    });

    assert.equal(run?.trim?.mismatch, true);
    assert.equal(run?.trim?.verifiedTrim, 'Sport Touring');
    assert.match(run?.trim?.shopperMessage ?? '', /dealer's page lists Sport Touring/);
    assert.deepEqual(flags, ['deal-trim:Sport Touring']);
    const opener = pages[1]?.sent[0] ?? '';
    assert.equal(opener.includes('Sport'), false);
    assert.equal(opener, 'Hi, is stock #H24118 still available?');
  });
});
