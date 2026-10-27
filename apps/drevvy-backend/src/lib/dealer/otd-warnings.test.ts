import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  OTD_REMOVAL_NOTICE,
  evaluateOtdWithhold,
  messageHasItemizedOtd,
  otdWarningMessage,
  recordLiveDealerReply,
} from './otd-warnings';

const OPENER = 'Dana wants your best itemized out-the-door';
const ITEMIZED = 'Price $30,000, doc fee $499, tax $1,800, title $75, registration $210.';

test('a single total is not an itemized best OTD', () => {
  assert.equal(messageHasItemizedOtd('Out-the-door is $32,000.'), false);
  assert.equal(messageHasItemizedOtd('The advertised price is $33,240.'), false);
  assert.equal(messageHasItemizedOtd(ITEMIZED), true);
});

test('withhold warnings use the spec copy and stop at 3 with a removal recommendation', () => {
  const messages = [{ author: 'drevvy', body: OPENER }];
  const first = evaluateOtdWithhold({
    shopperFirstName: 'Dana Blake',
    messages,
    dealerReply: 'Yes, it is still available.',
    warningCount: 0,
  });
  assert.equal(first.warningCount, 1);
  assert.equal(first.warning, otdWarningMessage(1, 'Dana Blake'));
  assert.match(first.warning ?? '', /^Warning 1 of 3: Dana asked for your best itemized out-the-door/);
  assert.equal(/Blake|@/.test(first.warning ?? ''), false);
  assert.equal(first.removalNotice, null);
  assert.equal(first.recommendRemoval, false);

  const second = evaluateOtdWithhold({
    shopperFirstName: 'Dana',
    messages,
    dealerReply: 'Come in and we will talk.',
    warningCount: 1,
    priorComeInCount: 0,
  });
  assert.equal(second.warningCount, 2);
  assert.equal(second.comeInAdminFlag, false);

  const third = evaluateOtdWithhold({
    shopperFirstName: 'Dana',
    messages,
    dealerReply: 'Please come in today.',
    warningCount: 2,
    priorComeInCount: 1,
  });
  assert.equal(third.warningCount, 3);
  assert.equal(third.recommendRemoval, true);
  assert.equal(third.removalNotice, OTD_REMOVAL_NOTICE);
  assert.equal(third.comeInAdminFlag, true);
  assert.match(third.warning ?? '', /Warning 3 of 3: Dana asked/);

  const fourth = evaluateOtdWithhold({
    shopperFirstName: 'Dana',
    messages,
    dealerReply: 'Still no worksheet.',
    warningCount: 3,
    removalRecommended: true,
  });
  assert.equal(fourth.warning, null);
  assert.equal(fourth.warningCount, 3);
  assert.equal(fourth.recommendRemoval, true);
});

test('an itemized reply does not warn, and a demo opener is not an ask', () => {
  const itemized = evaluateOtdWithhold({
    shopperFirstName: 'Sam',
    messages: [{ author: 'drevvy', body: OPENER }],
    dealerReply: ITEMIZED,
    warningCount: 1,
  });
  assert.equal(itemized.replyItemized, true);
  assert.equal(itemized.warning, null);
  assert.equal(itemized.warningCount, 1);

  const demo = evaluateOtdWithhold({
    shopperFirstName: null,
    messages: [{ author: 'drevvy', body: 'Get Best Price\nAn anonymous shopper tapped Get Best Price.' }],
    dealerReply: 'Yes, it is here.',
    warningCount: 0,
  });
  assert.equal(demo.asked, false);
  assert.equal(demo.warning, null);
});

test('a live reply persists the third warning and recommends removal without deleting the store', async () => {
  const stored = memoryRow();
  const result = await recordLiveDealerReply(stored.client as unknown as SupabaseClient, 'deal-1', 'It is here. Come on in.');
  assert.equal(result?.warningCount, 3);
  assert.equal(result?.recommendRemoval, true);
  assert.equal(stored.row.otd_warning_count, 3);
  assert.equal(typeof stored.row.otd_removal_recommended_at, 'string');
  assert.equal(stored.warnings[0]?.warning_number, 3);
  assert.equal(stored.warnings[0]?.removal_notice, OTD_REMOVAL_NOTICE);
  assert.equal(stored.deleted, false);
});

function memoryRow() {
  const row: Record<string, unknown> = {
    opener: OPENER,
    shopper_first_name: 'Dana Blake',
    otd_warning_count: 2,
    otd_itemized_at: null,
    otd_removal_recommended_at: null,
    come_in_count: 1,
    come_in_admin_flag: false,
  };
  const warnings: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: { ...row }, error: null };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq() {
              assert.equal(table, 'shopper_dealer_conversations');
              Object.assign(row, patch);
              return { error: null };
            },
          };
        },
        async upsert(data: Record<string, unknown>) {
          assert.equal(table, 'dealer_otd_warnings');
          warnings.push(data);
          return { error: null };
        },
      };
    },
  };
  return { client, row, warnings, deleted: false };
}
