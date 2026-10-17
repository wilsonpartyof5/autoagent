import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assembleLiveMonitor,
  demoMonitorRows,
  filterMonitorRows,
  MONITOR_CHANNELS,
  MONITOR_STATUSES,
  normalizeChannel,
  parseMonitorFilters,
  presentMonitor,
  replyRatesByChannel,
} from './outreach-monitor';
import { isMissingRelation, liveMonitorConfigured, loadOutreachMonitor } from './outreach-monitor-store';

const HERE = dirname(fileURLToPath(import.meta.url));

test('demo monitor covers every channel and status and attributes first replies', () => {
  const rows = demoMonitorRows();
  assert.equal(rows.length, 12);
  for (const channel of MONITOR_CHANNELS) {
    assert.equal(rows.some((row) => row.channels.includes(channel)), true, channel);
    assert.equal(rows.some((row) => row.firstReplyChannel === channel), true, `first ${channel}`);
  }
  for (const status of MONITOR_STATUSES) {
    assert.equal(rows.some((row) => row.status === status), true, status);
  }
  assert.equal(rows.every((row) => row.touches.length > 0 && row.cadenceDay != null), true);
  assert.equal(rows.filter((row) => row.status === 'replied').every((row) => row.dealerReplyText), true);

  const rates = replyRatesByChannel(rows);
  const rate = (channel: string) => rates.find((row) => row.channel === channel);
  assert.deepEqual(
    rates.map((row) => row.channel),
    ['widget', 'lead_form', 'email', 'text', 'call'],
  );
  assert.equal(rate('widget')?.replies, 2);
  assert.equal(rate('widget')?.attempts, 3);
  assert.equal(rate('lead_form')?.replyRate, 1 / 3);
  assert.equal(rate('email')?.replies, 2);
  assert.equal(rate('email')?.attempts, 8);
  assert.equal(rate('text')?.replyRate, 1 / 5);
  assert.equal(rate('call')?.replyRate, 0.5);
});

test('filters narrow dealer, channel, status, cadence day, and first reply', () => {
  const rows = demoMonitorRows();
  const piedmont = filterMonitorRows(rows, { ...parseMonitorFilters({}), dealer: 'dlr-piedmont' });
  assert.deepEqual(piedmont.map((row) => row.id), ['mon-001', 'mon-002']);

  const texts = filterMonitorRows(rows, { ...parseMonitorFilters({ channel: 'text' }) });
  assert.equal(texts.every((row) => row.channels.includes('text')), true);
  assert.equal(texts.length, 5);

  const dayOne = filterMonitorRows(rows, parseMonitorFilters({ day: '1' }));
  assert.equal(dayOne.every((row) => row.cadenceDay === 1), true);

  const waiting = filterMonitorRows(rows, parseMonitorFilters({ status: 'waiting', q: 'camry' }));
  assert.deepEqual(waiting.map((row) => row.id), ['mon-005']);

  const widgetFirst = filterMonitorRows(rows, parseMonitorFilters({ first: 'widget' }));
  assert.equal(widgetFirst.every((row) => row.firstReplyChannel === 'widget'), true);
  assert.equal(parseMonitorFilters({ day: 'nope' }).cadenceDay, null);
  assert.equal(normalizeChannel('SMS'), 'text');
  assert.equal(normalizeChannel('lead form'), 'lead_form');
  assert.equal(normalizeChannel('voice'), 'call');
});

test('first_reply_channel on widget_chat_attempts wins over an earlier outreach inbound', () => {
  const live = assembleLiveMonitor({
    widgetChatAttempts: [
      {
        deal_id: 'deal-9',
        dealer_id: 'dlr-1',
        dealer_name: 'Piedmont Auto Group',
        vehicle: '2024 RAV4',
        shopper_first: 'Maya',
        channels: ['widget', 'email'],
        first_reply_channel: 'widget',
        dealer_reply_text: 'Chatting the out-the-door price now.',
        cadence_day: 0,
        status: 'replied',
        widget_at: '2026-10-01T15:00:00.000Z',
        email_at: '2026-10-01T15:05:00.000Z',
      },
    ],
    outreachEvents: [
      {
        deal_id: 'deal-9',
        dealer_id: 'dlr-1',
        channel: 'email',
        direction: 'inbound',
        sent_at: '2026-09-30T12:00:00.000Z',
        touchpoint: 'D0-E1',
        body: 'Earlier email that should not become the first reply.',
        status: 'delivered',
      },
    ],
    outreachMessages: [],
    failed: false,
  });
  assert.ok(live);
  assert.equal(live.rows.length, 1);
  assert.equal(live.partial, false);
  assert.equal(live.rows[0]?.firstReplyChannel, 'widget');
  assert.equal(live.rows[0]?.dealerReplyText, 'Chatting the out-the-door price now.');
  assert.equal(live.rows[0]?.cadenceDay, 0);
  assert.deepEqual(live.rows[0]?.channels, ['widget', 'email']);
});

test('outreach events derive text replies and cadence day when first_reply_channel is absent', () => {
  const live = assembleLiveMonitor({
    widgetChatAttempts: null,
    outreachEvents: [
      {
        deal_id: 'deal-sms',
        dealer_id: 'dlr-2',
        channel: 'sms',
        direction: 'outbound',
        sent_at: '2026-10-02T15:00:00.000Z',
        touchpoint: 'D1-T2',
        body: 'Checking the out-the-door number.',
        status: 'delivered',
      },
      {
        deal_id: 'deal-sms',
        dealer_id: 'dlr-2',
        channel: 'sms',
        direction: 'inbound',
        sent_at: '2026-10-02T18:00:00.000Z',
        touchpoint: 'D1-T2',
        body: 'Out the door is $28,400.',
        status: 'delivered',
      },
    ],
    outreachMessages: [
      {
        shopper_deal_id: 'deal-stop',
        dealer_name: 'Lake Wylie Cars',
        channel: 'voice',
        direction: 'inbound',
        occurred_at: '2026-10-03T15:00:00.000Z',
        body: 'STOP',
        first_reply_channel: 'call',
      },
    ],
    failed: false,
  });
  assert.ok(live);
  assert.equal(live.partial, true);
  const sms = live.rows.find((row) => row.dealId === 'deal-sms');
  assert.equal(sms?.firstReplyChannel, 'text');
  assert.equal(sms?.cadenceDay, 1);
  assert.equal(sms?.status, 'replied');
  assert.equal(sms?.dealerReplyText, 'Out the door is $28,400.');
  const stopped = live.rows.find((row) => row.dealId === 'deal-stop');
  assert.equal(stopped?.firstReplyChannel, 'call');
  assert.equal(stopped?.status, 'opted_out');
});

test('empty or missing tables fall back to demo data and do not require a migration', async () => {
  const empty = await loadOutreachMonitor(parseMonitorFilters({}), async () => ({
    widgetChatAttempts: [],
    outreachEvents: [],
    outreachMessages: [],
    failed: false,
  }));
  assert.equal(empty.source, 'demo');
  assert.equal(empty.total, 12);
  assert.equal(assembleLiveMonitor({
    widgetChatAttempts: null,
    outreachEvents: null,
    outreachMessages: null,
    failed: false,
  }), null);

  const missing = await loadOutreachMonitor(parseMonitorFilters({ dealer: 'dlr-york' }), async () => ({
    widgetChatAttempts: null,
    outreachEvents: null,
    outreachMessages: [],
    failed: false,
  }));
  assert.equal(missing.source, 'demo');
  assert.equal(missing.rows.length, 2);

  assert.equal(isMissingRelation({ code: 'PGRST205', message: 'Could not find the table in the schema cache' }), true);
  assert.equal(isMissingRelation({ message: 'relation "widget_chat_attempts" does not exist' }), true);
  assert.equal(isMissingRelation({ code: '42501', message: 'permission denied' }), false);
  assert.equal(liveMonitorConfigured({}), false);

  const store = readFileSync(join(HERE, 'outreach-monitor-store.ts'), 'utf8');
  assert.match(store, /select\('\*'\)/);
  assert.doesNotMatch(store, /\.insert\(|\.update\(|\.delete\(|apply_migration|\.rpc\(/);
});

test('monitor page stays inside admin auth and names the columns operators need', () => {
  const page = readFileSync(join(HERE, '../../app/admin/outreach/monitor/page.tsx'), 'utf8');
  const layout = readFileSync(join(HERE, '../../app/admin/layout.tsx'), 'utf8');
  const shell = readFileSync(join(HERE, '../../components/admin/admin-shell.tsx'), 'utf8');
  const view = readFileSync(join(HERE, '../../components/admin/outreach-monitor.tsx'), 'utf8');
  assert.match(page, /loadOutreachMonitor/);
  assert.match(layout, /requireAdmin/);
  assert.match(shell, /\/admin\/outreach\/monitor/);
  assert.match(view, /Reply rate by channel/);
  assert.match(view, /First reply/);
  assert.match(view, /Cadence day/);
  assert.match(view, /Dealer reply/);
  assert.equal(/negotiat/i.test(view), false);
  const presented = presentMonitor(demoMonitorRows(), 'demo', false, parseMonitorFilters({}));
  assert.equal(presented.dealers.length >= 5, true);
  assert.equal(presented.replyRates.length, MONITOR_CHANNELS.length);
});
