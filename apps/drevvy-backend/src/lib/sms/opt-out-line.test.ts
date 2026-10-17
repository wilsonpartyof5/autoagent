import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SMS_OPT_OUT_LINE_SETTING,
  SMS_OPT_OUT_LINE,
  SMS_OPT_OUT_LINE_MODE_LABELS,
  parseSmsOptOutLineForm,
  settingFromRow,
  shouldAppendOptOutLine,
  withOptOutLine,
} from './opt-out-line';

const NOW = new Date('2026-10-17T15:00:00.000Z');

test('the safe default is the first text of a thread and the line is the required phrase', () => {
  assert.equal(DEFAULT_SMS_OPT_OUT_LINE_SETTING.mode, 'first_message_per_thread');
  assert.equal(DEFAULT_SMS_OPT_OUT_LINE_SETTING.silenceHours, null);
  assert.equal(SMS_OPT_OUT_LINE, 'Reply STOP to opt out');
  const copy = [SMS_OPT_OUT_LINE, ...Object.values(SMS_OPT_OUT_LINE_MODE_LABELS)].join(' ');
  assert.equal(/negotiat/i.test(copy), false);
});

test('a missing or unknown stored row stays on the safe default', () => {
  assert.deepEqual(settingFromRow(null), DEFAULT_SMS_OPT_OUT_LINE_SETTING);
  assert.deepEqual(settingFromRow({ opt_out_line_mode: 'sometimes' }), DEFAULT_SMS_OPT_OUT_LINE_SETTING);
  assert.deepEqual(
    settingFromRow({ opt_out_line_mode: 'never', opt_out_line_silence_hours: 48 }),
    { mode: 'never', silenceHours: 48 },
  );
  assert.equal(settingFromRow({ opt_out_line_mode: 'every_message', opt_out_line_silence_hours: 0 }).silenceHours, null);
});

test('the form accepts the three modes and an optional silence window', () => {
  assert.deepEqual(parseSmsOptOutLineForm({ mode: 'every_message', silenceHours: '' }), {
    ok: true,
    setting: { mode: 'every_message', silenceHours: null },
  });
  assert.deepEqual(parseSmsOptOutLineForm({ mode: 'first_message_per_thread', silenceHours: '24' }), {
    ok: true,
    setting: { mode: 'first_message_per_thread', silenceHours: 24 },
  });
  assert.equal(parseSmsOptOutLineForm({ mode: 'later', silenceHours: '' }).ok, false);
  assert.equal(parseSmsOptOutLineForm({ mode: 'never', silenceHours: '1.5' }).ok, false);
  assert.equal(parseSmsOptOutLineForm({ mode: 'never', silenceHours: '0' }).ok, false);
  assert.equal(parseSmsOptOutLineForm({ mode: 'never', silenceHours: '8761' }).ok, false);
  assert.equal(parseSmsOptOutLineForm({ mode: 'never', silenceHours: '8760' }).ok, true);
});

test('first text in a thread includes the line, and later texts wait for silence', () => {
  const setting = { mode: 'first_message_per_thread' as const, silenceHours: 24 };
  assert.equal(shouldAppendOptOutLine({
    setting,
    thread: { priorOutboundCount: 0, lastActivityAt: null },
    now: NOW,
  }), true);
  assert.equal(shouldAppendOptOutLine({
    setting,
    thread: { priorOutboundCount: 2, lastActivityAt: '2026-10-17T14:00:00.000Z' },
    now: NOW,
  }), false);
  assert.equal(shouldAppendOptOutLine({
    setting,
    thread: { priorOutboundCount: 2, lastActivityAt: '2026-10-16T15:00:00.000Z' },
    now: NOW,
  }), true);
  assert.equal(shouldAppendOptOutLine({
    setting: { mode: 'first_message_per_thread', silenceHours: null },
    thread: { priorOutboundCount: 2, lastActivityAt: '2026-10-01T15:00:00.000Z' },
    now: NOW,
  }), false);
});

test('every text includes the line and never leaves it off, including after silence', () => {
  const quiet = { priorOutboundCount: 3, lastActivityAt: '2026-01-01T00:00:00.000Z' };
  assert.equal(shouldAppendOptOutLine({
    setting: { mode: 'every_message', silenceHours: null },
    thread: quiet,
    now: NOW,
  }), true);
  assert.equal(shouldAppendOptOutLine({
    setting: { mode: 'never', silenceHours: 1 },
    thread: quiet,
    now: NOW,
  }), false);
  assert.equal(shouldAppendOptOutLine({
    setting: { mode: 'never', silenceHours: 1 },
    thread: { priorOutboundCount: 0, lastActivityAt: null },
    now: NOW,
  }), false);
});

test('the line is appended once and existing copy is left as written', () => {
  const added = withOptOutLine('What is the out-the-door price?', true);
  assert.equal(added.appended, true);
  assert.equal(added.body, 'What is the out-the-door price? Reply STOP to opt out');
  const again = withOptOutLine(added.body, true);
  assert.equal(again.appended, false);
  assert.equal(again.body, added.body);
  assert.equal(withOptOutLine('  Hello  ', false).body, 'Hello');
  assert.equal(/negotiat/i.test(added.body), false);
});
