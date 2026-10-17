import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { leadMessage } from '../src/forms/outreach';
import { selectDay0Channels } from '../src/run/channels';
import { runDay0 } from '../src/run/day0';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';
const phoneMessage = leadMessage({ stockNumber: 'H24118', phone: '803-555-0148' });
const fullMessage = leadMessage({
  stockNumber: 'H24118',
  phone: '803-555-0148',
  email: 'deals@drevvy.test',
});

const config: AppConfig = {
  aiBaseUrl: 'https://api.x.ai/v1',
  aiApiKey: 'test-key',
  aiModel: 'grok-4',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service',
  dryRun: false,
  allowlist: ['https://www.example-motors.test'],
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

describe('day-0 channel selection', () => {
  it('sends both channels only when the widget is ready', () => {
    const ready = selectDay0Channels('dry_run');
    assert.deepEqual(ready.channels, ['widget', 'lead_form']);
    assert.equal(ready.fallback, null);
    assert.match(ready.reason, /ready/i);
    assert.match(ready.reason, /first name/i);
    assert.match(ready.reason, /Drevvy number/i);

    for (const status of ['no_widget', 'widget_offline', 'composer_not_found', 'page_timeout', 'error']) {
      const plan = selectDay0Channels(status);
      assert.deepEqual(plan.channels, ['lead_form']);
      assert.equal(plan.fallback, null);
      assert.match(plan.reason, new RegExp(status));
      assert.match(plan.reason, /day-0 first touch/);
    }

    for (const status of ['captcha', 'contact_form']) {
      const plan = selectDay0Channels(status);
      assert.deepEqual(plan.channels, ['lead_form']);
      assert.match(plan.reason, /blocked-for-chat/);
    }

    const blocked = selectDay0Channels('blocked');
    assert.deepEqual(blocked.channels, []);
    assert.equal(blocked.fallback, 'email_text_call');
    assert.match(blocked.reason, /do not retry/i);
  });

  it('uses the full lead identity when the widget is not ready', async () => {
    const pages: FakeChatPage[] = [];
    const store = new MemoryAttemptStore();
    const [run] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null }],
      openPage: async () => {
        const page = new FakeChatPage(readFixture('check-availability.html'));
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: quietAi,
      attempts: store,
      directory: new MemoryDirectoryStore(),
      config,
    });

    assert.equal(run?.scan?.status, 'no_widget');
    assert.deepEqual(run?.plan.channels, ['lead_form']);
    assert.equal(run?.chat, null);
    assert.equal(pages.length, 2);
    assert.equal(run?.lead?.status, 'submitted');
    assert.deepEqual(filled(pages[1]!), {
      first_name: 'Maya',
      last_name: 'via Drevvy',
      phone: '803-555-0148',
      email: 'deals@drevvy.test',
      zip: '29201',
      message: fullMessage,
    });
    assert.equal(pages[1]?.submits.length, 1);
    assert.equal(store.attempts.find((attempt) => attempt.channel === 'widget')?.selected_channels, 'lead_form');
    assert.match(store.attempts.find((attempt) => attempt.channel === 'widget')?.channel_reason ?? '', /no_widget/);
  });

  it('sends the widget and a first-name lead form when the widget is ready', async () => {
    const pages: FakeChatPage[] = [];
    const store = new MemoryAttemptStore();
    const html = readFixture('gubagoo-ready-phone.html');
    const [run] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null }],
      openPage: async () => {
        const page = new FakeChatPage(html, { replies: ['This unit has been sold.'] });
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: quietAi,
      attempts: store,
      directory: new MemoryDirectoryStore(),
      config,
    });

    assert.equal(run?.scan?.status, 'dry_run');
    assert.deepEqual(run?.plan.channels, ['widget', 'lead_form']);
    assert.equal(pages.length, 3);
    assert.equal(run?.chat?.channel, 'widget');
    assert.equal(run?.chat?.status, 'sold');
    assert.equal(pages[1]?.sent.length > 0, true);
    assert.equal(run?.lead?.status, 'submitted');
    assert.deepEqual(filled(pages[2]!), {
      first_name: 'Maya',
      phone: '803-555-0148',
      message: phoneMessage,
    });
    assert.equal(phoneMessage.includes('deals@drevvy.test'), false);
    assert.equal(JSON.stringify(pages[2]?.outreach).includes('via Drevvy'), false);
    assert.equal(JSON.stringify(pages[2]?.outreach).includes('deals@drevvy.test'), false);
    assert.equal(pages[2]?.submits.length, 1);
    assert.equal(store.attempts.every((attempt) => attempt.selected_channels === 'widget,lead_form'), true);

    const again = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null }],
      openPage: async () => {
        const page = new FakeChatPage(html, { replies: ['This unit has been sold.'] });
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: quietAi,
      attempts: store,
      directory: new MemoryDirectoryStore(),
      config,
    });
    assert.equal(again[0]?.lead?.status, 'already_submitted');
    assert.equal(pages.at(-1)?.submits.length, 0);
    assert.equal(pages.at(-1)?.outreach.length, 0);
  });

  it('stops a ready lead form that requires more than a first name and phone, and still chats', async () => {
    const pages: FakeChatPage[] = [];
    const [run] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null }],
      openPage: async () => {
        const page = new FakeChatPage(readFixture('gubagoo-ready-required.html'), { replies: ['This unit has been sold.'] });
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: quietAi,
      attempts: new MemoryAttemptStore(),
      directory: new MemoryDirectoryStore(),
      config,
    });

    assert.equal(run?.chat?.status, 'sold');
    assert.equal(run?.lead?.status, 'unknown');
    assert.equal(run?.lead?.stopReason, 'unsupported_field');
    assert.equal(pages[2]?.outreach.length, 0);
    assert.equal(pages[2]?.submits.length, 0);
  });

  it('does not retry a bot wall and marks email, text, and call', async () => {
    const pages: FakeChatPage[] = [];
    const store = new MemoryAttemptStore();
    const openPage = async () => {
      const page = new FakeChatPage(readFixture('sokal-title.html'));
      pages.push(page);
      return { page, close: () => page.close() };
    };
    const [first] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null }],
      openPage,
      ai: quietAi,
      attempts: store,
      directory: new MemoryDirectoryStore(),
      config,
    });

    assert.equal(first?.scan?.status, 'blocked');
    assert.equal(first?.plan.fallback, 'email_text_call');
    assert.equal(first?.lead, null);
    assert.equal(first?.chat, null);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0]?.gotos, [pageUrl]);
    assert.equal(store.attempts.length, 1);
    assert.equal(store.attempts[0]?.fallback, 'email_text_call');
    assert.equal(store.attempts[0]?.selected_channels, null);
    assert.match(store.attempts[0]?.channel_reason ?? '', /Do not retry/);

    const [second] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: null }],
      openPage,
      ai: quietAi,
      attempts: store,
      directory: new MemoryDirectoryStore(),
      config,
    });
    assert.equal(second?.plan.fallback, 'email_text_call');
    assert.equal(second?.lead, null);
    assert.equal(second?.chat, null);
    assert.equal(store.attempts.length, 1);
    assert.deepEqual(pages[1]?.gotos, []);
  });

  it('sends only the lead form when the composer never appears', async () => {
    const pages: FakeChatPage[] = [];
    const store = new MemoryAttemptStore();
    const [run] = await runDay0({
      targets: [{ url: pageUrl, stockNumber: 'H24118' }],
      openPage: async () => {
        const page = new FakeChatPage(readFixture('gubagoo-vdp.html'));
        pages.push(page);
        return { page, close: () => page.close() };
      },
      ai: quietAi,
      attempts: store,
      directory: new MemoryDirectoryStore(),
      config: { ...config, dryRun: true },
    });

    assert.equal(run?.scan?.status, 'composer_not_found');
    assert.deepEqual(run?.plan.channels, ['lead_form']);
    assert.equal(run?.chat, null);
    assert.equal(pages.length, 2);
    assert.equal(pages.every((page) => page.sent.length === 0), true);
    const scan = store.attempts.find((attempt) => attempt.status === 'composer_not_found');
    assert.equal(scan?.selected_channels, 'lead_form');
    assert.match(scan?.channel_reason ?? '', /composer_not_found/);
    assert.equal(run?.lead?.stopReason, 'no_lead_form');
  });
});
