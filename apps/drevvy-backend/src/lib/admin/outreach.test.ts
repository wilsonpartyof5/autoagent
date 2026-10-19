import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildOutreachReport, wilson, withoutTestTraffic } from './outreach/analytics';
import { callOpener, emailCopy, smsCopy, voicemailScript } from './outreach/copy';
import { clearOutreachInsightCache, getOutreachInsight } from './outreach/insights';
import { getOutreachDeals } from './outreach/mock-source';
import { defaultOutreachRange } from './outreach/repository';
import { TOUCHPOINT_IDS, type TouchpointId } from './outreach/types';

const BANNED = /automated assistant/i;

test('cadence uses the spec touchpoint ids', () => {
  assert.deepEqual([...TOUCHPOINT_IDS], [
    'D0-E1', 'D0-C1', 'D0-T1', 'D0-TS', 'D0-C2', 'D1-E2', 'D1-T2', 'D2-C3', 'D2-T3', 'D4-E3', 'D4-T4', 'D5-E4', 'VM-1',
  ]);
  const seen = new Set(getOutreachDeals().flatMap((deal) => deal.events.map((event) => event.touchpoint)));
  for (const id of TOUCHPOINT_IDS) assert.equal(seen.has(id), true, id);
});

test('the first dealer message asks only if that vehicle is still available', () => {
  const ctx = {
    first: 'Maya',
    vehicle: '2024 Toyota RAV4 Hybrid XLE',
    vehicleShort: 'RAV4 Hybrid',
    stock: 'A1234',
    price: '$34,990',
    number: '843-555-0123',
    vin: '1HGBH41JXMN109186',
  };
  const ask = 'Is the 2024 Toyota RAV4 Hybrid XLE, stock #A1234, VIN 1HGBH41JXMN109186, still available?';
  for (const variant of ['A', 'B', 'C'] as const) {
    const email = emailCopy('D0-E1', variant, ctx);
    assert.ok(email);
    assert.equal(email.body.includes(ask), true, email.body);
    assert.equal(email.body.includes('$'), false, email.body);
    assert.equal(/out-the-door/i.test(email.body), false, email.body);
    const sms = smsCopy('D0-T1', variant, ctx);
    const salesperson = smsCopy('D0-TS', variant, ctx);
    assert.equal(sms?.includes(ask), true, sms ?? '');
    assert.equal(salesperson?.includes(ask), true, salesperson ?? '');
    assert.equal(sms?.includes('$'), false);
    assert.equal(/out-the-door/i.test(sms ?? ''), false);
    const call = callOpener('D0-C1', variant, ctx);
    assert.equal(call.includes(ask), true, call);
    assert.equal(call.includes('$'), false, call);
    assert.equal(call.includes('this call is recorded'), true);
  }
  const vm = voicemailScript(ctx);
  assert.equal(vm.includes(ask), true, vm);
  assert.equal(vm.includes('$'), false, vm);
});

test('openings are a short hello and do not lead with being an AI', () => {
  const ctx = { first: 'Maya', vehicle: '2024 Toyota RAV4 Hybrid XLE', vehicleShort: 'RAV4 Hybrid', stock: 'A1234', price: '$34,990', number: '843-555-0123' };
  const opener = 'Hi, this is Drevvy, working for Maya.';
  const leadsWithAi = /i'm an ai|i am an ai|i'm drevvy's ai|i am drevvy's ai/i;
  for (const touchpoint of ['D0-E1', 'D1-E2', 'D4-E3', 'D5-E4'] as const) {
    for (const variant of ['A', 'B', 'C'] as const) {
      const email = emailCopy(touchpoint, variant, ctx);
      assert.ok(email, `${touchpoint} ${variant}`);
      assert.equal(email.body.startsWith(opener), true, email.body);
      assert.equal(leadsWithAi.test(email.body), false, email.body);
      assert.equal(/negotiate/i.test(email.body), false, email.body);
      assert.equal(email.body.includes('@'), false, email.body);
    }
  }
  for (const touchpoint of ['D0-T1', 'D0-TS', 'D1-T2', 'D2-T3', 'D4-T4'] as const) {
    for (const variant of ['A', 'B', 'C'] as const) {
      const sms = smsCopy(touchpoint, variant, ctx);
      assert.ok(sms, `${touchpoint} ${variant}`);
      assert.equal(sms.startsWith(opener), true, sms);
      assert.equal(leadsWithAi.test(sms), false, sms);
      assert.equal(/negotiate/i.test(sms), false, sms);
    }
  }
  for (const touchpoint of ['D0-C1', 'D0-C2', 'D2-C3'] as const) {
    for (const variant of ['A', 'B', 'C'] as const) {
      const line = callOpener(touchpoint, variant, ctx);
      assert.equal(line.startsWith(opener), true, line);
      assert.equal(leadsWithAi.test(line), false, line);
      assert.equal(/negotiate/i.test(line), false, line);
    }
  }
  const vm = voicemailScript(ctx);
  assert.equal(vm.startsWith(opener), true, vm);
  assert.equal(leadsWithAi.test(vm), false);
  assert.equal(/negotiate/i.test(vm), false);
});

test('call scripts introduce Drevvy and never say automated assistant', () => {
  const ctx = { first: 'Maya', vehicle: '2024 Toyota RAV4 Hybrid XLE', vehicleShort: 'RAV4 Hybrid', stock: 'A1234', price: '$34,990', number: '843-555-0123' };
  for (const touchpoint of ['D0-C1', 'D0-C2', 'D2-C3'] as const) {
    for (const variant of ['A', 'B', 'C'] as const) {
      const line = callOpener(touchpoint, variant, ctx);
      assert.equal(BANNED.test(line), false, line);
      assert.equal(line.includes('Drevvy'), true);
      assert.equal(line.includes('Maya'), true);
    }
  }
  const vm = voicemailScript(ctx);
  assert.equal(BANNED.test(vm), false);
  assert.equal(vm.includes('Drevvy'), true);
  for (const deal of getOutreachDeals()) {
    for (const event of deal.events) {
      assert.equal(BANNED.test(event.body), false, event.id);
      assert.equal(BANNED.test(event.transcript ?? ''), false, event.id);
    }
  }
});

test('a reply stops later outbound touches and D0-TS follows a captured number', () => {
  const deals = getOutreachDeals();
  const replied = deals.filter((deal) => deal.stop === 'reply');
  assert.equal(replied.length > 0, true);
  for (const deal of replied) {
    const replyIndex = deal.events.findIndex((event) => event.direction === 'inbound');
    assert.equal(replyIndex > 0, true);
    assert.equal(deal.events.slice(replyIndex + 1).some((event) => event.direction === 'outbound'), false);
  }
  for (const deal of deals) {
    const text = deal.events.find((event) => event.touchpoint === 'D0-TS');
    if (!text) continue;
    const priorCapture = deal.events.some((event) => event.touchpoint === 'D0-C1' && event.callOutcome === 'number_captured' && event.sentAt <= text.sentAt);
    assert.equal(priorCapture, true, deal.id);
  }
  const firstTexts = deals.flatMap((deal) => deal.events.filter((event) => event.direction === 'outbound' && (event.touchpoint === 'D0-T1' || event.touchpoint === 'D0-TS') && event.status === 'delivered'));
  assert.equal(firstTexts.every((event) => event.body.includes('Reply STOP to opt out')), true);
});

test('outreach report rates stay in range and surface a guardrail', () => {
  const range = defaultOutreachRange();
  const report = buildOutreachReport(range.from, range.to);
  assert.equal(report.kpis.dealsContacted, getOutreachDeals().length);
  assert.equal(report.kpis.replyRateWithin5Days != null && report.kpis.replyRateWithin5Days > 0 && report.kpis.replyRateWithin5Days <= 1, true);
  assert.equal(report.stops.reduce((sum, row) => sum + row.count, 0), report.kpis.dealsContacted);
  assert.equal(report.variants.some((row) => row.guardrail), true);
  assert.equal(report.variants.some((row) => row.enoughData), true);
  const empty = buildOutreachReport('2020-01-01', '2020-01-02');
  assert.equal(empty.kpis.dealsContacted, 0);
  assert.equal(empty.kpis.replyRateWithin5Days, null);
  const interval = wilson(10, 40);
  assert.equal(interval != null && interval.low >= 0 && interval.high <= 1 && interval.low <= interval.high, true);
});

test('sample insights stay labeled and do not change the book', () => {
  clearOutreachInsightCache();
  const range = defaultOutreachRange();
  return getOutreachInsight(range, { apiKey: null }).then(async (first) => {
    assert.equal(first.source, 'sample');
    assert.match(first.label, /Sample insight/);
    assert.equal(BANNED.test(JSON.stringify(first)), false);
    assert.equal(/negotiate/i.test(JSON.stringify(first)), false);
    const touchpoints = new Set<TouchpointId>(TOUCHPOINT_IDS);
    assert.equal(first.proposedVariants.every((row) => touchpoints.has(row.touchpoint)), true);
    const second = await getOutreachInsight(range, { apiKey: null });
    assert.equal(second.generatedAt, first.generatedAt);
    const fresh = await getOutreachInsight(range, { apiKey: null, regenerate: true });
    assert.notEqual(fresh.generatedAt, first.generatedAt);
  });
});

test('outreach totals leave out test traffic', () => {
  const live = getOutreachDeals();
  const sample = live[0];
  const testDeal = {
    ...sample,
    id: 'ai-to-ai',
    isTest: true,
    events: sample.events.map((event) => ({ ...event, isTest: true, dealId: 'ai-to-ai' })),
  };
  const report = buildOutreachReport('2026-01-01', '2026-12-31', [...live, testDeal]);
  const baseline = buildOutreachReport('2026-01-01', '2026-12-31', live);
  assert.equal(report.kpis.dealsContacted, baseline.kpis.dealsContacted);
  assert.equal(withoutTestTraffic([testDeal]).length, 0);
});

test('outreach migration locks the log to the service role', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(here, '../../../../../supabase/migrations/20261012183255_outreach_events.sql'), 'utf8');
  for (const field of ['deal_id', 'touchpoint', 'variant', 'channel', 'sent_at', 'dealer_local_time', 'call_outcome', 'call_duration_s', 'captured_number', 'opt_out', 'transcript']) {
    assert.equal(sql.includes(field), true, field);
  }
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all on table public\.outreach_events from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.outreach_events to service_role/i);
  assert.equal(sql.includes('D0-T1') && sql.includes('VM-1'), true);
});
