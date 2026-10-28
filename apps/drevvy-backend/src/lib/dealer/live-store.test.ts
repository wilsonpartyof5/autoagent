import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { inNetworkOpener } from './rooftop-match';
import {
  assembleLiveAnalytics,
  assembleLiveConversation,
  assembleLiveInbox,
  deriveConversationStage,
  deskVehicleFromSnapshot,
  shopperRefFromDealId,
  type LiveDeskBundle,
} from './live-store';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-10-28T15:00:00.000Z');
const DEAL_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function walk(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.equal(
        ['phone', 'email', 'address', 'vin', 'consumeruserid', 'city'].includes(key.toLowerCase()),
        false,
        key,
      );
      walk(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string') {
    assert.equal(value.includes('@'), false, path);
    assert.equal(/negotiat/i.test(value), false, path);
  }
}

const ROW = {
  deal_id: DEAL_ID,
  rooftop_id: '11111111-1111-4111-8111-111111111111',
  shopper_first_name: 'Dana Blake',
  opener: inNetworkOpener('Dana'),
  created_at: '2026-10-28T12:00:00.000Z',
  otd_warning_count: 0,
  otd_itemized_at: null,
  otd_removal_recommended_at: null,
  come_in_admin_flag: false,
  first_reply_at: null,
  stated_price_cents: null,
  written_otd_cents: null,
  dealer_marked_sold_at: null,
};

const DEAL = {
  id: DEAL_ID,
  listing_id: 'lst_rav4',
  status: 'interested',
  vehicle_snapshot: {
    year: 2024,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'XLE',
    price: 33240,
    vin: 'JTMRWRFV0RD000001',
    city: 'Atlanta',
  },
  created_at: '2026-10-28T12:00:00.000Z',
};

test('desk vehicle and ref strip shopper and listing identity', () => {
  assert.equal(shopperRefFromDealId(DEAL_ID), '#AAAA');
  const desk = deskVehicleFromSnapshot(DEAL.vehicle_snapshot);
  assert.deepEqual(desk.vehicle, { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'XLE' });
  assert.equal(desk.advertisedPriceCents, 3_324_000);
  assert.equal('vin' in desk.vehicle, false);
  assert.equal(JSON.stringify(desk).includes('Atlanta'), false);
  assert.equal(JSON.stringify(desk).includes('JTMR'), false);
});

test('stages follow reply, numbers, sold, and closed signals', () => {
  assert.equal(deriveConversationStage({}), 'new_request');
  assert.equal(deriveConversationStage({ firstReplyAt: NOW.toISOString() }), 'in_conversation');
  assert.equal(deriveConversationStage({ otdItemizedAt: NOW.toISOString() }), 'numbers_shared');
  assert.equal(deriveConversationStage({ bought: true }), 'car_sold');
  assert.equal(deriveConversationStage({ dealerMarkedSoldAt: NOW.toISOString() }), 'car_sold');
  assert.equal(deriveConversationStage({ endState: 'ended_no_response' }), 'no_reply');
  assert.equal(deriveConversationStage({ dealStatus: 'closed' }), 'closed');
});

test('live inbox is first-name-only and rooftop scoped', () => {
  const conversation = assembleLiveConversation(ROW, DEAL, [], [], null);
  assert.equal(conversation.shopperFirstName, 'Dana');
  assert.equal(conversation.shopperRef, '#AAAA');
  assert.equal(conversation.rooftopId, ROW.rooftop_id);
  assert.equal(conversation.stage, 'new_request');
  assert.equal(conversation.messages[0]?.kind, 'opener');
  assert.equal(conversation.messages[0]?.body, 'Dana wants your best itemized out-the-door');
  assert.equal(conversation.stockNumber, '—');
  assert.equal(JSON.stringify(conversation).includes('Blake'), false);
  assert.equal(JSON.stringify(conversation).includes('Atlanta'), false);
  assert.equal(JSON.stringify(conversation).includes('JTMR'), false);
  walk(conversation, 'conversation');

  const bundle: LiveDeskBundle = {
    conversations: [ROW],
    deals: [DEAL],
    messages: [],
    warnings: [],
    lifecycle: [],
  };
  const needs = assembleLiveInbox(bundle, 'needs_reply', NOW);
  assert.equal(needs.length, 1);
  assert.equal(needs[0]?.shopperFirstName, 'Dana');
  assert.equal(needs[0]?.needsReply, true);
  const chatting = assembleLiveInbox({
    ...bundle,
    conversations: [{ ...ROW, first_reply_at: '2026-10-28T12:10:00.000Z' }],
    messages: [{
      id: 'm1',
      deal_id: DEAL_ID,
      author: 'salesperson',
      kind: 'chat',
      body: 'Yes, that RAV4 is here.',
      sent_at: '2026-10-28T12:10:00.000Z',
    }],
  }, 'in_chat', NOW);
  assert.equal(chatting[0]?.stage, 'in_conversation');
  assert.equal(chatting[0]?.needsReply, false);
});

test('live analytics counts rooftop conversations in range, not sample cards', () => {
  const started = assembleLiveConversation(ROW, DEAL, [], [], null);
  const closed = assembleLiveConversation(
    { ...ROW, deal_id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', dealer_marked_sold_at: '2026-10-27T12:00:00.000Z' },
    { ...DEAL, id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
    [],
    [],
    { deal_id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', end_state: 'sold', bought: true },
  );
  const numbered = assembleLiveConversation(
    {
      ...ROW,
      deal_id: 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      first_reply_at: '2026-10-28T12:16:00.000Z',
      otd_itemized_at: '2026-10-28T12:16:00.000Z',
      stated_price_cents: 3_300_000,
    },
    { ...DEAL, id: 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
    [],
    [],
    null,
  );
  const summary = assembleLiveAnalytics([started, closed, numbered], '7d', NOW);
  assert.equal(summary.source, 'live');
  assert.equal(summary.conversationsStarted, 3);
  assert.equal(summary.conversationsClosed, 1);
  assert.equal(summary.numbersShared, 1);
  assert.equal(summary.replyRate, 1 / 3);
  assert.equal(summary.medianFirstReplyMinutes, 16);
});

test('composer routes persist through live store helpers, not mock.ts', () => {
  const messages = readFileSync(join(HERE, '../../app/api/dealer/v1/leads/[leadId]/messages/route.ts'), 'utf8');
  const numbers = readFileSync(join(HERE, '../../app/api/dealer/v1/leads/[leadId]/numbers/route.ts'), 'utf8');
  const inbox = readFileSync(join(HERE, '../../app/api/dealer/v1/inbox/route.ts'), 'utf8');
  const analytics = readFileSync(join(HERE, '../../app/api/dealer/v1/analytics/route.ts'), 'utf8');
  const actions = readFileSync(join(HERE, '../../app/dealer/actions.ts'), 'utf8');
  assert.match(messages, /postLiveMessage/);
  assert.match(numbers, /shareLiveNumbers/);
  assert.match(inbox, /listLiveInbox/);
  assert.match(analytics, /liveAnalytics/);
  assert.match(actions, /postLiveMessage/);
  assert.match(actions, /requireDealerPageSession/);
});
