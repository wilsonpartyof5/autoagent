import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ChatClient, ChatRequest } from '../src/ai/types';
import { runWidgetChat, type WidgetChatConfig } from '../src/chat/agent';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const pageUrl = 'https://www.example-motors.test/inventory/civic';
const html = readFixture('gubagoo-vdp.html');

const liveConfig: WidgetChatConfig = {
  dryRun: false,
  allowlist: ['https://www.example-motors.test'],
  drevvyTextNumber: '803-555-0148',
  drevvyContactPhone: '803-555-0148',
  drevvyEmail: 'deals@drevvy.test',
  shopperFirst: 'Maya',
  listedPrice: 24995,
  maxTurns: 6,
};

function classifyingAi(handler: (text: string, hasImage: boolean) => string): ChatClient & { calls: ChatRequest[] } {
  const calls: ChatRequest[] = [];
  return {
    calls,
    async complete(request) {
      calls.push(request);
      const user = request.messages[1];
      if (!user) throw new Error('missing user message');
      if (typeof user.content === 'string') return handler(user.content, false);
      const text = user.content.find((part) => part.type === 'text');
      return handler(text && text.type === 'text' ? text.text : '', true);
    },
  };
}

function scriptedAi(): ChatClient & { calls: ChatRequest[] } {
  return classifyingAi((text, hasImage) => {
    if (hasImage) return JSON.stringify({ status: 'sold', price: null, next_message: 'none' });
    if (text.includes('Are you a bot')) {
      return JSON.stringify({ status: 'unknown', price: null, next_message: 'none' });
    }
    if (text.includes('phone number')) {
      return JSON.stringify({ status: 'price_given', price: '$24,995', next_message: 'continue_offline' });
    }
    if (text.includes('sold')) return JSON.stringify({ status: 'sold', price: null, next_message: 'listing_price' });
    if (text.includes('salesperson')) {
      return JSON.stringify({ status: 'human_handoff', price: null, next_message: 'listing_price' });
    }
    if (text.includes('$24,995') || text.includes('$21,500')) {
      const price = text.includes('$21,500') ? '$21,500' : '$24,995';
      return JSON.stringify({ status: 'price_given', price, next_message: 'continue_offline' });
    }
    if (text.includes('available')) {
      return JSON.stringify({ status: 'available', price: null, next_message: 'continue_offline' });
    }
    return JSON.stringify({ status: 'unknown', price: null, next_message: 'none' });
  });
}

describe('widget chat agent', () => {
  it('opens the page in a dry run and sends nothing', async () => {
    const page = new FakeChatPage(html, { replies: ['Yes, this unit is still available.'] });
    const ai = scriptedAi();
    const store = new MemoryAttemptStore();
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai,
      config: { ...liveConfig, dryRun: true, allowlist: [] },
      store,
    });

    assert.equal(result.status, 'dry_run');
    assert.equal(result.dryRun, true);
    assert.deepEqual(page.gotos, [pageUrl]);
    assert.deepEqual(page.sent, []);
    assert.deepEqual(page.clicks, []);
    assert.equal(ai.calls.length, 0);
    assert.equal(result.widgetVendor, 'gubagoo');
    assert.equal(result.stockNumber, 'H24118');
    assert.equal(store.attempts[0]?.transcript.some((entry) => entry.text.includes('Hi, is stock #H24118 still available?') && entry.via === 'planned'), true);
    assert.match(store.attempts[0]?.transcript.map((entry) => entry.text).join('\n') ?? '', /nothing was sent/);
  });

  it('follows availability, price, and the Drevvy handoff', async () => {
    const page = new FakeChatPage(html, {
      replies: ['Yes, this unit is still available.', 'Listing price is $24,995.'],
    });
    const ai = scriptedAi();
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai,
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });

    assert.deepEqual(page.sent, [
      'Hi, is stock #H24118 still available?',
      'Is it still listed at $24,995?',
      "Thanks. I'd like to continue over text and email, please reach us at 803-555-0148 or deals@drevvy.test.",
    ]);
    assert.equal(result.status, 'price_given');
    assert.equal(result.price, '$24,995');
    assert.equal(page.sent.some((message) => message.includes('introduction')), false);
    assert.equal(/i'm an ai|i'm drevvy's ai/i.test(page.sent[0] ?? ''), false);
  });

  it('answers a bot question honestly and does not share a shopper phone', async () => {
    const page = new FakeChatPage(html, {
      replies: [
        'Are you a bot?',
        'Yes, this unit is still available.',
        'Listing price is $21,500.',
      ],
    });
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(page.sent[1], "I'm Drevvy's AI, working for Maya.");
    assert.equal(result.status, 'price_given');
    assert.equal(page.sent.join('\n').includes('shopper@'), false);
  });

  it('stops when the dealer asks for the shopper phone', async () => {
    const page = new FakeChatPage(html, {
      replies: ['Can I get your phone number? The shopper can text 212-555-0198.'],
    });
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'asked_contact');
    assert.deepEqual(page.sent, ['Hi, is stock #H24118 still available?']);
    assert.equal(page.sent.join('\n').includes('212-555-0198'), false);
    assert.equal(page.sent.join('\n').includes('803-555-0148'), false);
  });

  it('stops when the unit is sold or a human takes over', async () => {
    const sold = new FakeChatPage(html, { replies: ['Sorry, that one sold yesterday.'] });
    const soldResult = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page: sold,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(soldResult.status, 'sold');
    assert.equal(sold.sent.length, 1);

    const human = new FakeChatPage(html, { replies: ['A salesperson will call you.'] });
    const humanResult = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page: human,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(humanResult.status, 'human_handoff');
    assert.equal(human.sent.length, 1);
  });

  it('stops on a captcha before typing', async () => {
    const captcha = new FakeChatPage(readFixture('captcha-widget.html'));
    const captchaResult = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page: captcha,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(captchaResult.status, 'captcha');
    assert.deepEqual(captcha.sent, []);
    assert.deepEqual(captcha.outreach, []);
  });

  it('fills a pre-chat form with the shopper first name and the Drevvy number, then continues the script', async () => {
    const form = new FakeChatPage(readFixture('prechat-form.html'), {
      replies: ['Yes, this unit is still available.', 'Listing price is $24,995.'],
    });
    const store = new MemoryAttemptStore();
    const formResult = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page: form,
      ai: scriptedAi(),
      config: liveConfig,
      store,
    });
    assert.equal(formResult.status, 'price_given');
    assert.deepEqual(
      form.outreach.map((fill) => [fill.kind, fill.value]),
      [
        ['full_name', 'Maya'],
        ['phone', '803-555-0148'],
        ['email', 'deals@drevvy.test'],
      ],
    );
    assert.equal(form.submits.length, 1);
    assert.equal(form.sent[0], 'Hi, is it still available?');
    assert.equal(JSON.stringify(form.outreach).includes('212-555-0198'), false);
    assert.equal(store.attempts[0]?.channel, 'prechat');
    assert.equal(store.attempts[0]?.status, 'submitted');
    assert.equal(store.attempts.at(-1)?.channel, 'widget');
    assert.equal(store.attempts[0]?.first_reply_channel, 'widget');
  });

  it('fills a Podium Text us gate with the first name only', async () => {
    const page = new FakeChatPage(readFixture('podium-text-us.html'), {
      replies: ['Yes, this unit is still available.', 'Listing price is $24,995.'],
    });
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.deepEqual(
      page.outreach.map((fill) => [fill.kind, fill.value]),
      [
        ['full_name', 'Maya'],
        ['phone', '803-555-0148'],
      ],
    );
    assert.equal(page.submits.length, 1);
    assert.equal(page.sent[0], 'Hi, is stock #H24118 still available?');
    assert.equal(page.sent[1], 'Is it still listed at $24,995?');
    assert.equal(result.status, 'price_given');
  });

  it('logs a pre-chat form during dry run and does not submit it', async () => {
    const page = new FakeChatPage(readFixture('podium-text-us.html'));
    const store = new MemoryAttemptStore();
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: { ...liveConfig, dryRun: true, allowlist: [] },
      store,
    });
    assert.equal(result.status, 'dry_run');
    assert.deepEqual(page.outreach, []);
    assert.deepEqual(page.submits, []);
    assert.deepEqual(page.sent, []);
    assert.deepEqual(
      store.attempts.map((attempt) => [attempt.channel, attempt.status]),
      [
        ['prechat', 'dry_run'],
        ['widget', 'dry_run'],
      ],
    );
  });

  it('stops a pre-chat form that asks for private information', async () => {
    const page = new FakeChatPage(readFixture('private-prechat.html'));
    const store = new MemoryAttemptStore();
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store,
    });
    assert.equal(result.status, 'private_info');
    assert.equal(result.channel, 'widget');
    assert.deepEqual(page.outreach, []);
    assert.deepEqual(page.submits, []);
    assert.deepEqual(page.sent, []);
    assert.equal(store.attempts[0]?.channel, 'prechat');
    assert.equal(store.attempts[0]?.status, 'private_info');
  });

  it('does not treat a footer lead form as the chat widget', async () => {
    const page = new FakeChatPage(readFixture('footer-lead-form.html'), {
      replies: ['Yes, this unit is still available.', 'Listing price is $24,995.'],
    });
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'price_given');
    assert.equal(page.sent[0], 'Hi, is stock #H24118 still available?');
  });

  it('refuses a composer that is an email field', async () => {
    const page = new FakeChatPage(html, { composerAttrs: { type: 'email', name: 'email' } });
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'contact_form');
    assert.deepEqual(page.sent, []);
  });

  it('does not send when the dealer is not allowlisted', async () => {
    const page = new FakeChatPage(html);
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: { ...liveConfig, allowlist: ['https://other.test'] },
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'not_allowlisted');
    assert.deepEqual(page.sent, []);
    assert.deepEqual(page.clicks, []);
  });

  it('uses a screenshot when the dealer reply has no text', async () => {
    const page = new FakeChatPage(html, { replies: [null] });
    const ai = scriptedAi();
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai,
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(page.screenshots, 1);
    assert.equal(ai.calls.length, 1);
    const user = ai.calls[0]?.messages[1];
    assert.equal(Array.isArray(user?.content), true);
    assert.equal(result.status, 'sold');
    assert.equal(result.transcript.some((entry) => entry.via === 'screenshot'), true);
    assert.equal(result.channel, 'widget');
    assert.deepEqual(page.sent, ['Hi, is stock #H24118 still available?']);
  });

  it('stops at the turn cap', async () => {
    const page = new FakeChatPage(html, {
      replies: ['Yes, this unit is still available.', 'Listing price is $24,995.'],
    });
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: { ...liveConfig, maxTurns: 2 },
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'turn_limit');
    assert.deepEqual(page.sent, [
      'Hi, is stock #H24118 still available?',
      'Is it still listed at $24,995?',
    ]);
  });

  it('records no_widget without typing', async () => {
    const page = new FakeChatPage(readFixture('no-widget.html'));
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'no_widget');
    assert.deepEqual(page.sent, []);
  });

  it('records widget_offline when the vendor script never shows a launcher', async () => {
    const page = new FakeChatPage(readFixture('gubagoo-offline.html'));
    const result = await runWidgetChat({
      vehiclePageUrl: pageUrl,
      page,
      ai: scriptedAi(),
      config: liveConfig,
      store: new MemoryAttemptStore(),
    });
    assert.equal(result.status, 'widget_offline');
    assert.equal(result.stopReason, 'widget_offline');
    assert.equal(result.widgetVendor, 'gubagoo');
    const notes = result.transcript.map((entry) => entry.text).join('\n');
    assert.match(notes, /gubagoo/);
    assert.match(notes, /launcher/i);
    assert.deepEqual(page.sent, []);
    assert.deepEqual(page.clicks, []);
  });
});
