import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config';
import { loadConfig } from '../src/config';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { planForm } from '../src/forms/plan';
import { detectLeadForms, detectPrechat } from '../src/forms/detect';
import { outreachIdentity } from '../src/forms/outreach';
import { resolveFormPhone } from '../src/forms/phone';
import { runDay0 } from '../src/run/day0';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';
const shopperPhone = '212-555-0198';
const textNumber = '803-555-0148';
const telnyxNumber = '843-555-0191';

const config: AppConfig = {
  aiBaseUrl: 'https://api.x.ai/v1',
  aiApiKey: 'test-key',
  aiModel: 'grok-4',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service',
  dryRun: false,
  allowlist: ['https://www.example-motors.test'],
  drevvyTextNumber: textNumber,
  drevvyContactPhone: null,
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

const quietAi = {
  async complete(request: { messages: Array<{ content: string | unknown }> }) {
    const user = request.messages[1];
    const text = typeof user?.content === 'string' ? user.content : '';
    if (text.includes('sold') || text.includes('Dealer reply')) {
      return JSON.stringify({ status: 'sold', price: null, next_message: 'none' });
    }
    return JSON.stringify({ found: false });
  },
};

function filled(page: FakeChatPage): Record<string, string> {
  return Object.fromEntries(page.outreach.map((fill) => [fill.kind, fill.value]));
}

describe('contact phone fallback', () => {
  it('reads DREVVY_CONTACT_PHONE and never treats the shopper phone as ours', () => {
    assert.equal(loadConfig({ DREVVY_CONTACT_PHONE: '(843) 555-0191' }).drevvyContactPhone, telnyxNumber);
    assert.equal(loadConfig({ DREVVY_CONTACT_PHONE: 'not-a-phone' }).drevvyContactPhone, null);
    assert.equal(loadConfig({}).drevvyContactPhone, null);
    assert.equal(resolveFormPhone(shopperPhone, shopperPhone), null);
    assert.equal(resolveFormPhone(telnyxNumber, shopperPhone), telnyxNumber);
  });

  it('fills a required phone with the Telnyx number, not the text number or the shopper', () => {
    const form = detectPrechat(readFixture('podium-text-us.html'));
    assert.ok(form);
    const plan = planForm(
      form,
      outreachIdentity({
        dryRun: false,
        allowlist: [],
        drevvyTextNumber: textNumber,
        drevvyContactPhone: telnyxNumber,
        drevvyEmail: 'deals@drevvy.test',
        shopperFirst: 'Maya',
        shopperPhone,
      }),
      'H24118',
      'prechat',
    );
    assert.equal(plan.stop, null);
    assert.equal(plan.fills.find((fill) => fill.kind === 'phone')?.value, telnyxNumber);
    assert.equal(JSON.stringify(plan.fills).includes(shopperPhone), false);
    assert.equal(JSON.stringify(plan.fills).includes(textNumber), false);
  });

  it('skips a phone widget and submits Check Availability with no phone', async () => {
    const pages: FakeChatPage[] = [];
    const [run] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null, dealId: 'deal-1' }],
      openPage: async () => {
        const page = new FakeChatPage(readFixture('widget-phone-fallback.html'));
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: quietAi,
      attempts: new MemoryAttemptStore(),
      directory: new MemoryDirectoryStore(),
      config: { ...config, shopperFirst: 'Maya' },
    });

    assert.equal(run?.scan?.phoneRequired, true);
    assert.deepEqual(run?.plan.channels, ['lead_form']);
    assert.equal(run?.plan.contactMode, 'check_availability');
    assert.equal(run?.chat, null);
    assert.equal(run?.lead?.status, 'submitted');
    assert.equal(filled(pages.at(-1)!).phone, undefined);
    assert.equal(filled(pages.at(-1)!).email, 'deals@drevvy.test');
    assert.equal(JSON.stringify(pages.at(-1)?.outreach).includes(shopperPhone), false);
    assert.equal(JSON.stringify(pages.at(-1)?.outreach).includes(textNumber), false);
    assert.equal(detectLeadForms(readFixture('widget-phone-fallback.html')).some((form) => /check availability/i.test(form.title)), true);
  });

  it('uses the Telnyx number when the widget requires a phone and the env is set', async () => {
    const notes: string[] = [];
    const pages: FakeChatPage[] = [];
    const [run] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null, dealId: 'deal-9' }],
      openPage: async () => {
        const page = new FakeChatPage(readFixture('podium-text-us.html'), {
          replies: ['This unit has been sold.'],
        });
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: quietAi,
      attempts: new MemoryAttemptStore(),
      directory: new MemoryDirectoryStore(),
      config: { ...config, drevvyContactPhone: telnyxNumber },
      onContactPhone: async (note) => {
        notes.push(`${note.dealId}:${note.phone}`);
      },
    });

    assert.deepEqual(run?.plan.channels, ['widget', 'lead_form']);
    const phones = pages.flatMap((page) => page.outreach.filter((fill) => fill.kind === 'phone').map((fill) => fill.value));
    assert.equal(phones.includes(telnyxNumber), true);
    assert.equal(phones.includes(textNumber), false);
    assert.equal(phones.includes(shopperPhone), false);
    assert.deepEqual(notes, ['deal-9:843-555-0191']);
  });
});
