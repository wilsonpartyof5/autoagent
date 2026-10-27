import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { dollarsToCents, CLOSE_FEE_CENTS } from './format';
import {
  allInboxItems,
  analyticsHttp,
  analyticsSummary,
  billingHttp,
  billingSnapshot,
  conversationHttp,
  inboxHttp,
  listInbox,
  markSold,
  postMessage,
  postMessageHttp,
  presentConversation,
  resetDealerDemo,
  shareNumbers,
  shareNumbersHttp,
  useInNetworkShopper,
} from './mock';
import { OTD_REMOVAL_NOTICE } from './otd-warnings';

const NOW = new Date('2026-10-24T15:00:00.000Z');
const HERE = dirname(fileURLToPath(import.meta.url));

function walk(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.equal(
        ['phone', 'email', 'address', 'vin', 'consumeruserid'].includes(
          key.toLowerCase()
        ),
        false,
        key
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

describe('dealer desk mock', { concurrency: false }, () => {
  test('inbox filters, anonymity, and the price flag', () => {
    resetDealerDemo(NOW);
    const needs = listInbox('needs_reply', NOW);
    assert.deepEqual(
      needs.map(item => item.id),
      ['conv_rav4', 'conv_f150']
    );
    assert.equal(needs[0]?.shopperFirstName, 'Jordan');
    assert.equal(needs[0]?.shopperRef, '#A7F2');
    assert.equal(needs[0]?.rooftopId, 'lakeside');
    assert.equal(needs[0]?.sla.label, '20m left');
    assert.equal(needs[1]?.shopperRef, '#B3C1');
    const opener = presentConversation('conv_rav4', NOW);
    assert.equal(opener?.messages[0]?.author, 'drevvy');
    assert.match(opener?.messages[0]?.body ?? '', /^Get Best Price/);
    assert.match(opener?.messages[0]?.body ?? '', /stock #R44118/);
    assert.equal(JSON.stringify(allInboxItems(NOW)).includes('Alex'), false);
    assert.equal(JSON.stringify(allInboxItems(NOW)).includes('Buyer via Drevvy'), false);
    const templates = opener?.replyTemplates ?? [];
    assert.deepEqual(
      templates.map(item => item.label),
      [
        'Share itemized OTD',
        'Still available',
        'Answer question',
        'Price & fees',
        'Vehicle details',
      ]
    );
    assert.equal(
      templates.every(item => !/come in|test-drive|visit us/i.test(item.text)),
      true
    );
    assert.equal(needs[1]?.sla.label, '12m over');
    assert.equal(
      needs.every(item => item.needsReply),
      true
    );
    assert.equal(
      needs.every(item => !('messages' in item)),
      true
    );

    const open = listInbox('all_open', NOW);
    assert.ok(open.some(item => item.stage === 'numbers_shared'));
    const tucson = open.find(item => item.id === 'conv_tucson');
    assert.equal(tucson?.priceDiffers, true);
    assert.equal(tucson?.sla.label, 'Replied in 35m');

    const closed = listInbox('closed', NOW);
    assert.deepEqual(
      closed.map(item => item.stage),
      ['car_sold', 'closed', 'no_reply']
    );
    assert.equal(
      closed.find(item => item.id === 'conv_tahoe')?.sla.label,
      'No reply yet'
    );

    walk(allInboxItems(NOW), 'inbox');
    walk(presentConversation('conv_tucson', NOW), 'detail');
  });

  test('a reply starts the conversation and share numbers is informational', () => {
    resetDealerDemo(NOW);
    const posted = postMessage(
      'conv_rav4',
      '  Yes, stock #R44118 is still here.  ',
      NOW
    );
    assert.equal(posted.ok, true);
    if (!posted.ok) return;
    assert.equal(posted.data.stage, 'in_conversation');
    assert.equal(posted.data.needsReply, false);
    assert.equal(posted.data.firstReplyAt, NOW.toISOString());
    assert.equal(posted.data.messages.at(-1)?.author, 'salesperson');
    assert.equal(posted.data.messages.at(-1)?.kind, 'chat');
    assert.equal(
      listInbox('needs_reply', NOW).some(item => item.id === 'conv_rav4'),
      false
    );

    const shared = shareNumbers(
      'conv_f150',
      {
        statedPriceCents: 4_050_000,
        writtenOtdCents: 4_420_000,
        note: 'Informational total only.',
      },
      NOW
    );
    assert.equal(shared.ok, true);
    if (!shared.ok) return;
    assert.equal(shared.data.stage, 'numbers_shared');
    assert.equal(shared.data.priceDiffers, true);
    assert.equal(shared.data.messages.at(-1)?.kind, 'numbers');
    assert.match(
      shared.data.messages.at(-1)?.body ?? '',
      /not a binding offer/
    );
    assert.equal(shared.data.writtenOtdCents, 4_420_000);

    const closed = shareNumbers(
      'conv_outback',
      { statedPriceCents: 2_844_000, writtenOtdCents: null, note: '' },
      NOW
    );
    assert.deepEqual(closed, { ok: false, error: 'conversation_closed' });
    assert.deepEqual(postMessage('missing', 'Hello', NOW), {
      ok: false,
      error: 'not_found',
    });
    assert.deepEqual(postMessage('conv_rav4', '   ', NOW), {
      ok: false,
      error: 'empty_message',
    });
    assert.equal(dollarsToCents('$35,400.50'), 3_540_050);
    assert.equal(dollarsToCents('0'), null);
  });

  test('marking a car sold records a placeholder close fee', () => {
    resetDealerDemo(NOW);
    const before = billingSnapshot(NOW);
    assert.equal(before.source, 'mock');
    assert.equal(before.role, 'owner_gm');
    assert.equal(before.dayToDay, 'free');
    assert.equal(before.closeFeeCents, CLOSE_FEE_CENTS);
    assert.equal(before.closeFeeLabel, '$300 per closed deal');
    assert.equal(before.paymentMethod.placeholder, true);
    assert.equal(before.charges[0]?.conversationId, 'conv_sportage');
    assert.equal(before.charges[0]?.amountCents, 30_000);

    const sold = markSold('conv_f150', NOW);
    assert.equal(sold.ok, true);
    if (!sold.ok) return;
    assert.equal(sold.data.stage, 'car_sold');
    const after = billingSnapshot(NOW);
    assert.equal(after.charges[0]?.conversationId, 'conv_f150');
    assert.equal(after.charges[0]?.shopperRef, '#B3C1');
    assert.equal(after.charges[0]?.amountCents, 30_000);
    assert.equal(after.charges[0]?.status, 'placeholder');
    assert.deepEqual(markSold('conv_f150', NOW), {
      ok: false,
      error: 'conversation_closed',
    });
    walk(after, 'billing');
    assert.equal(JSON.stringify(after).includes('stripe'), false);
  });

  test('analytics samples grow with the range and stay mock', () => {
    const week = analyticsSummary('7d');
    const month = analyticsSummary('30d');
    const quarter = analyticsSummary('90d');
    assert.equal(week.source, 'mock');
    assert.ok(week.conversationsStarted < month.conversationsStarted);
    assert.ok(month.conversationsStarted < quarter.conversationsStarted);
    assert.equal(week.replyRate > 0 && week.replyRate <= 1, true);
    assert.equal(typeof week.medianFirstReplyMinutes, 'number');
    assert.equal(typeof week.numbersShared, 'number');
    walk(week, 'analytics');
  });

  test('http helpers match the stub routes', () => {
    resetDealerDemo(NOW);
    const inbox = inboxHttp(
      'http://desk.local/api/dealer/v1/inbox?filter=needs_reply',
      NOW
    );
    assert.equal(inbox.status, 200);
    assert.equal(
      inboxHttp('http://desk.local/api/dealer/v1/inbox?filter=nope').status,
      400
    );

    const detail = conversationHttp('conv_rav4', NOW);
    assert.equal(detail.status, 200);
    assert.equal(conversationHttp('missing', NOW).status, 404);

    const posted = postMessageHttp(
      'conv_rav4',
      { body: 'Yes, it is here.' },
      NOW
    );
    assert.equal(posted.status, 200);
    assert.equal(postMessageHttp('conv_rav4', {}, NOW).status, 400);

    const numbers = shareNumbersHttp(
      'conv_f150',
      { statedPriceCents: 4_100_000, writtenOtdCents: null },
      NOW
    );
    assert.equal(numbers.status, 200);
    assert.equal(
      shareNumbersHttp('conv_sportage', { statedPriceCents: 3_129_000 }, NOW)
        .status,
      409
    );

    assert.equal(
      analyticsHttp('http://desk.local/api/dealer/v1/analytics?range=30d')
        .status,
      200
    );
    assert.equal(
      analyticsHttp('http://desk.local/api/dealer/v1/analytics?range=1y')
        .status,
      400
    );
    walk(detail.body, 'http-detail');
  });

  test('an in-network withhold warns on that thread and recommends removal at 3', () => {
    resetDealerDemo(NOW);
    assert.equal(useInNetworkShopper('conv_rav4', 'Dana Blake'), true);
    const opened = presentConversation('conv_rav4', NOW);
    assert.equal(opened?.messages[0]?.body, 'Dana wants your best itemized out-the-door');
    assert.equal(opened?.messages[0]?.body.includes('Blake'), false);

    const replies = [
      'Yes, stock #R44118 is still here.',
      'The advertised price is still $33,240.',
      'Come in and we can talk numbers.',
    ];
    let last = opened;
    for (const body of replies) {
      const posted = postMessage('conv_rav4', body, NOW);
      assert.equal(posted.ok, true);
      if (posted.ok) last = posted.data;
    }
    assert.equal(last?.otdWarningCount, 3);
    assert.equal(last?.otdRemovalRecommended, true);
    assert.equal(last?.comeInAdminFlag === true, false);
    const warnings = last?.messages.filter((message) => message.body.startsWith('Warning ')) ?? [];
    assert.equal(warnings.length, 3);
    assert.match(warnings[0]?.body ?? '', /^Warning 1 of 3: Dana asked for your best itemized out-the-door/);
    assert.match(warnings[2]?.body ?? '', /^Warning 3 of 3: Dana asked/);
    assert.equal(warnings.some((message) => message.body.includes('Blake')), false);
    assert.equal(last?.messages.at(-1)?.body, OTD_REMOVAL_NOTICE);

    const fourth = postMessage('conv_rav4', 'Please come in today.', NOW);
    assert.equal(fourth.ok, true);
    if (!fourth.ok) return;
    assert.equal(fourth.data.otdWarningCount, 3);
    assert.equal(fourth.data.messages.filter((message) => message.body.startsWith('Warning ')).length, 3);
    assert.equal(fourth.data.comeInAdminFlag, true);

    assert.equal(useInNetworkShopper('conv_f150', 'Sam'), true);
    const itemized = postMessage(
      'conv_f150',
      'Price $30,000, doc fee $499, tax $1,800, title $75, registration $210.',
      NOW,
    );
    assert.equal(itemized.ok, true);
    if (!itemized.ok) return;
    assert.equal(itemized.data.otdWarningCount ?? 0, 0);
    assert.equal(itemized.data.messages.some((message) => message.body.startsWith('Warning ')), false);
    assert.equal(/negotiat/i.test(JSON.stringify(itemized.data)), false);
  });

  test('dealer routes stay outside the admin guard', () => {
    const middleware = readFileSync(join(HERE, '../../middleware.ts'), 'utf8');
    const matcher = middleware.slice(middleware.indexOf('matcher'));
    assert.equal(matcher.includes('/dealer'), false);
    assert.equal(matcher.includes('/api/dealer'), false);

    const routeFiles = [
      '../../app/api/dealer/v1/inbox/route.ts',
      '../../app/api/dealer/v1/analytics/route.ts',
      '../../app/api/dealer/v1/leads/[leadId]/route.ts',
      '../../app/api/dealer/v1/leads/[leadId]/messages/route.ts',
      '../../app/api/dealer/v1/leads/[leadId]/numbers/route.ts',
      '../../app/api/dealer/v1/leads/[leadId]/sold/route.ts',
      '../../app/api/dealer/v1/billing/route.ts',
    ];
    for (const file of routeFiles) {
      const source = readFileSync(join(HERE, file), 'utf8');
      assert.equal(source.includes('requireAdmin'), false, file);
      assert.equal(source.includes('telnyx'), false, file);
    }
  });
});
