import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ingestTelnyxPayload, sendOutboundEmail, sendOutboundSms, type CommunicationsStore } from './communications';
import {
  buildEmailAlias,
  emailDisplayName,
  formatMailbox,
  pickSmsNumber,
  pickVoiceNumber,
  randomAliasTag,
  readShopperFirstName,
  resolveAssignment,
  routeInbound,
  selectSender,
  smsPoolHealth,
  voiceNumberLeaks,
  type ConversationIdentity,
  type PoolNumber,
  type RouteIdentity,
  type SmsAssignment,
} from './identity';
import type { IdentityRouter } from './identity-store';
import type { BrainVendorEvent } from './repository';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-10-17T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

test('migration locks a conversation identity and keeps the pool private', () => {
  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261019010000_conversation_identities.sql'), 'utf8');
  assert.match(sql, /conversation_identities_deal_dealer_unique unique \(deal_id, dealer_id\)/);
  assert.match(sql, /conversation_identities_email_alias_unique unique \(email_alias\)/);
  assert.match(sql, /conversation identity is locked/);
  assert.match(sql, /sms_cooldown_days integer not null default 90/);
  assert.match(sql, /where ended_at is null/);
  assert.match(sql, /offers\\.drevvy\\.com/);
  assert.match(sql, /unmatched_inbound/);
  assert.match(sql, /'conversation_identities'/);
  assert.match(sql, /revoke all on table public\.%I from public, anon, authenticated/i);
  assert.match(sql, /first_name/);
  assert.equal(/negotiat/i.test(sql), false);
});

test('email alias is opaque and the display name is only the first name', () => {
  const random = sequence([0.1, 0.2, 0.3, 0.4, 0.9]);
  const tag = randomAliasTag(random);
  assert.equal(tag.length >= 4 && tag.length <= 6, true);
  const alias = buildEmailAlias('Mary Ann', tag);
  assert.equal(alias, `maryann.${tag}@offers.drevvy.com`);
  assert.equal(alias?.includes('deal-1234'), false);
  assert.equal(buildEmailAlias('Maya', 'deal-1234'), null);
  assert.equal(emailDisplayName('Maya'), 'Maya');
  assert.equal(emailDisplayName('Drevvy'), null);
  assert.equal(emailDisplayName('Special Offers'), null);
  const mailbox = formatMailbox('Maya', alias ?? '');
  assert.equal(mailbox, `"Maya" <${alias}>`);
  assert.equal(/offers|drevvy/i.test('Maya'), false);
});

test('shopper first name comes from the profile before sign-in metadata', () => {
  assert.equal(readShopperFirstName('Maya', { given_name: 'Other' }), 'Maya');
  assert.equal(readShopperFirstName(null, { given_name: 'Luis' }), 'Luis');
  assert.equal(readShopperFirstName(null, { full_name: 'Ana Ruiz' }), 'Ana');
  assert.equal(readShopperFirstName('maya@example.com', { given_name: 'Maya' }), 'Maya');
  assert.equal(readShopperFirstName(null, { given_name: 'Drevvy Offers' }), null);
});

test('an assigned identity is kept when a later draft picks different addresses', () => {
  const existing = sampleIdentity({ smsNumberE164: '+18035550100', emailAlias: 'maya.ab12@offers.drevvy.com' });
  const draft = sampleIdentity({ smsNumberE164: '+18035550199', emailAlias: 'maya.zz99@offers.drevvy.com' });
  assert.equal(resolveAssignment(existing, draft).smsNumberE164, '+18035550100');
  assert.equal(resolveAssignment(null, draft).emailAlias, draft.emailAlias);
});

test('text numbers are least recently used, shared across dealers, and cooled down at one dealer', () => {
  const pool: PoolNumber[] = [
    { phoneE164: '+18035550101', status: 'active', isTest: false, lastAssignedAt: '2026-10-01T00:00:00.000Z' },
    { phoneE164: '+18035550102', status: 'active', isTest: false, lastAssignedAt: null },
    { phoneE164: '+18035550103', status: 'retired', isTest: false, lastAssignedAt: null },
    { phoneE164: '+18035550104', status: 'active', isTest: true, lastAssignedAt: null },
  ];
  const fresh = pickSmsNumber({
    pool,
    assignments: [],
    dealerId: 'dealer-a',
    shopperId: 'shopper-1',
    now: NOW,
    cooldownDays: 90,
    test: false,
  });
  assert.deepEqual(fresh, { phoneE164: '+18035550102' });

  const liveElsewhere: SmsAssignment[] = [{
    dealerId: 'dealer-b',
    shopperId: 'shopper-9',
    smsNumberE164: '+18035550102',
    endedAt: null,
  }];
  const reused = pickSmsNumber({
    pool,
    assignments: liveElsewhere,
    dealerId: 'dealer-a',
    shopperId: 'shopper-1',
    now: NOW,
    cooldownDays: 90,
    test: false,
  });
  assert.deepEqual(reused, { phoneE164: '+18035550102' });

  const liveHere: SmsAssignment[] = [{
    dealerId: 'dealer-a',
    shopperId: 'shopper-9',
    smsNumberE164: '+18035550102',
    endedAt: null,
  }];
  const next = pickSmsNumber({
    pool,
    assignments: liveHere,
    dealerId: 'dealer-a',
    shopperId: 'shopper-1',
    now: NOW,
    cooldownDays: 90,
    test: false,
  });
  assert.deepEqual(next, { phoneE164: '+18035550101' });

  const cooling: SmsAssignment[] = [
    {
      dealerId: 'dealer-a',
      shopperId: 'shopper-9',
      smsNumberE164: '+18035550102',
      endedAt: new Date(NOW.getTime() - 10 * DAY).toISOString(),
    },
    {
      dealerId: 'dealer-a',
      shopperId: 'shopper-8',
      smsNumberE164: '+18035550101',
      endedAt: new Date(NOW.getTime() - 10 * DAY).toISOString(),
    },
  ];
  assert.deepEqual(pickSmsNumber({
    pool,
    assignments: cooling,
    dealerId: 'dealer-a',
    shopperId: 'shopper-1',
    now: NOW,
    cooldownDays: 90,
    test: false,
  }), { error: 'none_available' });

  assert.deepEqual(pickSmsNumber({
    pool,
    assignments: cooling,
    dealerId: 'dealer-a',
    shopperId: 'shopper-9',
    now: NOW,
    cooldownDays: 90,
    test: false,
  }), { phoneE164: '+18035550102' });

  const old: SmsAssignment[] = [{
    dealerId: 'dealer-a',
    shopperId: 'shopper-9',
    smsNumberE164: '+18035550102',
    endedAt: new Date(NOW.getTime() - 91 * DAY).toISOString(),
  }];
  assert.deepEqual(pickSmsNumber({
    pool,
    assignments: old,
    dealerId: 'dealer-a',
    shopperId: 'shopper-1',
    now: NOW,
    cooldownDays: 90,
    test: false,
  }), { phoneE164: '+18035550102' });

  assert.deepEqual(pickSmsNumber({
    pool,
    assignments: [],
    dealerId: 'dealer-a',
    shopperId: 'shopper-1',
    now: NOW,
    cooldownDays: 90,
    test: true,
  }), { phoneE164: '+18035550104' });
});

test('a small live pool is flagged for a new number purchase', () => {
  const pool: PoolNumber[] = [
    { phoneE164: '+18035550101', status: 'active', isTest: false, lastAssignedAt: null },
    { phoneE164: '+18035550102', status: 'active', isTest: true, lastAssignedAt: null },
  ];
  assert.equal(smsPoolHealth(pool, 2, false).low, true);
  assert.equal(smsPoolHealth([
    ...pool,
    { phoneE164: '+18035550103', status: 'active', isTest: false, lastAssignedAt: null },
    { phoneE164: '+18035550105', status: 'active', isTest: false, lastAssignedAt: null },
  ], 2, false).low, false);
});

test('voice numbers are shared caller IDs for a state', () => {
  const numbers = [{ state: 'SC', phoneE164: '+18035551000' }];
  assert.equal(pickVoiceNumber(numbers, 'sc'), '+18035551000');
  assert.equal(pickVoiceNumber(numbers, 'NC'), null);
  assert.equal(voiceNumberLeaks('Please text us at 803-555-1000.', '+18035551000'), true);
  assert.equal(voiceNumberLeaks('Please text us at 803-555-0148 or email maya.ab12@offers.drevvy.com.', '+18035551000'), false);
});

test('senders use the identity row, with env values only in test mode', () => {
  const identity = sampleIdentity({});
  const email = selectSender({ channel: 'email', identity, testMode: false });
  assert.equal('from' in email && email.from, `"Maya" <${identity.emailAlias}>`);
  assert.equal('replyTo' in email && email.replyTo, identity.emailAlias);
  const sms = selectSender({ channel: 'sms', identity, testMode: false });
  assert.equal('from' in sms && sms.from, identity.smsNumberE164);
  const voice = selectSender({ channel: 'voice', identity, testMode: false });
  assert.equal('from' in voice && voice.from, '+18035551000');
  const missingVoice = selectSender({
    channel: 'voice',
    identity: { ...identity, voiceNumberE164: null },
    testMode: false,
  });
  assert.equal('error' in missingVoice, true);
  const blocked = selectSender({
    channel: 'sms',
    identity: null,
    testMode: false,
    fallback: { sms: '+18035550148' },
  });
  assert.deepEqual(blocked, { error: 'A conversation identity is required.' });
  const testSms = selectSender({
    channel: 'sms',
    identity: null,
    testMode: true,
    fallback: { sms: '803-555-0148' },
  });
  assert.equal('from' in testSms && testSms.from, '+18035550148');
});

test('inbound mail finds the conversation by alias, text pair, thread, then client state', () => {
  const live = routeRow({ id: 'conv-live', emailAlias: 'maya.ab12@offers.drevvy.com', smsNumberE164: '+18035550101' });
  const ended = routeRow({
    id: 'conv-old',
    dealId: 'deal-old',
    emailAlias: 'maya.old1@offers.drevvy.com',
    smsNumberE164: '+18035550101',
    endedAt: '2026-01-01T00:00:00.000Z',
  });
  const otherDealer = routeRow({
    id: 'conv-other',
    dealId: 'deal-other',
    dealerId: 'dealer-b',
    emailAlias: 'maya.cd34@offers.drevvy.com',
    smsNumberE164: '+18035550101',
  });
  const identities = [live, ended, otherDealer];
  const parties = [
    { conversationId: 'conv-live', channel: 'sms' as const, ourAddress: '+18035550101', theirAddress: '+18035550999' },
    { conversationId: 'conv-other', channel: 'sms' as const, ourAddress: '+18035550101', theirAddress: '+18035550888' },
  ];

  assert.equal(routeInbound({
    channel: 'email',
    to: 'Maya <maya.ab12@offers.drevvy.com>',
    from: 'desk@dealer.example',
    inReplyTo: null,
    references: null,
    clientState: {},
    identities,
    parties,
    threads: [],
  })?.conversationId, 'conv-live');

  assert.equal(routeInbound({
    channel: 'sms',
    to: '+1 (803) 555-0101',
    from: '803-555-0999',
    inReplyTo: null,
    references: null,
    clientState: {},
    identities,
    parties,
    threads: [],
  })?.via, 'sms_pair');

  assert.equal(routeInbound({
    channel: 'sms',
    to: '+18035550101',
    from: '+18035550000',
    inReplyTo: null,
    references: null,
    clientState: {},
    identities,
    parties,
    threads: [],
  }), null);

  assert.equal(routeInbound({
    channel: 'email',
    to: 'unknown@offers.drevvy.com',
    from: 'desk@dealer.example',
    inReplyTo: '<msg.abc@offers.drevvy.com>',
    references: null,
    clientState: {},
    identities,
    parties,
    threads: [{ conversationId: 'conv-live', messageId: '<msg.abc@offers.drevvy.com>' }],
  })?.via, 'thread');

  assert.equal(routeInbound({
    channel: 'call',
    to: '+18035551000',
    from: '+18035550999',
    inReplyTo: null,
    references: null,
    clientState: { conversationId: 'conv-other' },
    identities,
    parties,
    threads: [],
  })?.conversationId, 'conv-other');

  const ambiguous = routeInbound({
    channel: 'sms',
    to: '+18035550101',
    from: '+18035550777',
    inReplyTo: null,
    references: null,
    clientState: {},
    identities,
    parties: [
      { conversationId: 'conv-live', channel: 'sms', ourAddress: '+18035550101', theirAddress: '+18035550777' },
      { conversationId: 'conv-other', channel: 'sms', ourAddress: '+18035550101', theirAddress: '+18035550777' },
    ],
    threads: [],
  });
  assert.equal(ambiguous, null);
});

test('the send gateway reads the identity and unmatched inbound is kept for review', async () => {
  const identity = sampleIdentity({});
  const memory = memoryStore();
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.from, identity.smsNumberE164);
    return jsonResponse({ data: { id: 'sms-1' } });
  };
  const sms = await sendOutboundSms(memory.store, {
    from: '+19995550100',
    to: '+18035550999',
    text: 'Please text this number.',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl,
    identity,
    link: { dealId: identity.dealId, dealerId: identity.dealerId, touchpointId: 'D0-T1' },
  });
  assert.equal('messageId' in sms ? sms.messageId : null, 'sms-1');
  assert.equal(memory.saved[0]?.from_address, identity.smsNumberE164);
  assert.equal(memory.saved[0]?.conversation_identity_id, identity.id);

  const sent: { email: Record<string, unknown> | null } = { email: null };
  const emailFetch: typeof fetch = async (_input, init) => {
    sent.email = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ data: { id: 'email-1' } });
  };
  const email = await sendOutboundEmail(memory.store, {
    from: 'deals@drevvy.example',
    to: 'desk@dealer.example',
    subject: 'Price check',
    text: 'What is the price?',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl: emailFetch,
    identity,
    link: { dealId: identity.dealId, dealerId: identity.dealerId, touchpointId: 'D0-E1' },
  });
  assert.equal('messageId' in email ? email.messageId : null, 'email-1');
  assert.equal(sent.email?.from, `"Maya" <${identity.emailAlias}>`);
  assert.equal(sent.email?.reply_to, identity.emailAlias);
  assert.equal(String(sent.email?.from).includes(identity.dealId), false);
  assert.equal(String(sent.email?.reply_to).includes(identity.dealId), false);

  const unmatched: unknown[] = [];
  const router: IdentityRouter = {
    async route(input) {
      return routeInbound({
        ...input,
        identities: [toRoute(identity)],
        parties: [],
        threads: [],
      });
    },
    async recordUnmatched(input) {
      unmatched.push(input);
    },
    async remember() {},
  };
  const aliasHit = await ingestTelnyxPayload({
    data: {
      id: 'evt-alias',
      event_type: 'email.received',
      occurred_at: '2026-10-17T18:00:00.000Z',
      payload: {
        direction: 'inbound',
        from: 'desk@dealer.example',
        to: identity.emailAlias,
        subject: 'Re: Price',
        body: { plain: 'Still available.' },
      },
    },
  }, { store: memory.store, apiKey: null, router });
  assert.equal(aliasHit.httpStatus, 200);
  const stored = memory.saved.find((row) => row.vendor_event_id === 'evt-alias');
  assert.equal(stored?.conversation_identity_id, identity.id);
  assert.equal(stored?.deal_id, identity.dealId);

  await ingestTelnyxPayload({
    data: {
      id: 'evt-lost',
      event_type: 'message.received',
      occurred_at: '2026-10-17T18:05:00.000Z',
      payload: {
        direction: 'inbound',
        from: { phone_number: '+18035550000' },
        to: [{ phone_number: '+18035550111' }],
        text: 'Who is this?',
      },
    },
  }, { store: memory.store, apiKey: null, router });
  assert.equal(unmatched.length, 1);
});

function sampleIdentity(overrides: Partial<ConversationIdentity>): ConversationIdentity {
  return {
    id: 'conv-1',
    dealId: 'deal-1',
    dealerId: 'dealer-a',
    shopperId: 'shopper-1',
    shopperFirstName: 'Maya',
    emailAlias: 'maya.k7qd@offers.drevvy.com',
    smsNumberE164: '+18035550101',
    voiceNumberE164: '+18035551000',
    lockedAt: NOW.toISOString(),
    createdAt: NOW.toISOString(),
    isTest: false,
    endedAt: null,
    ...overrides,
  };
}

function routeRow(overrides: Partial<RouteIdentity> & { id: string }): RouteIdentity {
  return {
    dealId: 'deal-1',
    dealerId: 'dealer-a',
    emailAlias: 'maya.ab12@offers.drevvy.com',
    smsNumberE164: '+18035550101',
    endedAt: null,
    ...overrides,
  };
}

function toRoute(identity: ConversationIdentity): RouteIdentity {
  return {
    id: identity.id,
    dealId: identity.dealId,
    dealerId: identity.dealerId,
    emailAlias: identity.emailAlias,
    smsNumberE164: identity.smsNumberE164,
    endedAt: identity.endedAt,
  };
}

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function memoryStore(): { store: CommunicationsStore; saved: BrainVendorEvent[] } {
  const saved: BrainVendorEvent[] = [];
  const store: CommunicationsStore = {
    async testNumbers() {
      return new Set<string>();
    },
    async findByVendorEvent() {
      return null;
    },
    async findCallContext() {
      return null;
    },
    async save(event) {
      saved.push(event);
      return { id: `id-${saved.length}` };
    },
    async attach() {},
    async uploadRecording() {
      return true;
    },
  };
  return { store, saved };
}
