import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  analyticsKeyKind,
  analyticsRefundReason,
  consumeCredit,
  dealerConversationIdempotencyKey,
  dealerConversationRefundKey,
  KEY_PACKS,
  marketSaveIdempotencyKey,
  refundCredit,
  spendMarketSaveKey,
  usdToCents,
} from './credits';
import { shouldRefundCredit, type QuotaEndState } from './quota';

const HERE = dirname(fileURLToPath(import.meta.url));
const STAMP_SQL = readFileSync(
  join(HERE, '../../../../../supabase/migrations/20261027233000_stamp_credit_event_key_fields.sql'),
  'utf8',
);

test('key packs are 1, 5, 10, and 25 at the published prices', () => {
  const packs = KEY_PACKS;
  assert.deepEqual(packs.map((pack) => [pack.size, pack.priceUsd, pack.recommended]), [
    [1, 4.99, false],
    [5, 19.99, false],
    [10, 34.99, true],
    [25, 74.99, false],
  ]);
  assert.deepEqual(packs.map((pack) => usdToCents(pack.priceUsd)), [499, 1999, 3499, 7499]);
  assert.equal(marketSaveIdempotencyKey('mc-listing-1'), 'use:market_save:mc-listing-1');
  assert.equal(dealerConversationIdempotencyKey('deal-1'), 'use:dealer_conversation:deal-1');
  assert.equal(dealerConversationRefundKey('deal-1'), 'refund:deal-1');
});

test('shouldRefundCredit returns only the dealer-conversation key', () => {
  assert.equal(shouldRefundCredit('dealer_declined'), true, 'dealer decline should refund the dealer key');
  assert.equal(shouldRefundCredit('sold'), true, 'a sold car should refund the dealer key');
  assert.equal(shouldRefundCredit('ended_no_response'), true, 'day 7 with no reply should refund the dealer key');
  assert.equal(shouldRefundCredit('open'), false, 'open should not refund');
  assert.equal(shouldRefundCredit('removed'), false, 'removing a deal should not refund, including the 30 minute window');
});

test('the stamp migration writes Analytics key_kind, vdp_match_id, and refund_reason', () => {
  assert.match(STAMP_SQL, /key_kind, vdp_match_id, idempotency_key/);
  assert.match(STAMP_SQL, /'dealer_conversation', 'conversation', p_vdp_match_id/);
  assert.match(STAMP_SQL, /'market_save', 'market_intel'/);
  assert.match(STAMP_SQL, /key_kind, refund_reason, idempotency_key/);
  assert.match(STAMP_SQL, /'conversation', v_reason/);
  assert.match(STAMP_SQL, /no_reply_7d/);
  assert.match(STAMP_SQL, /dealer_opted_out/);
  assert.match(STAMP_SQL, /p_vdp_match_id uuid default null/);
  assert.match(STAMP_SQL, /p_refund_reason text default null/);
});

test('Analytics key_kind and refund_reason match the applied prod checks', () => {
  assert.equal(analyticsKeyKind('market_save'), 'market_intel');
  assert.equal(analyticsKeyKind('dealer_conversation'), 'conversation');
  assert.equal(analyticsRefundReason('ended_no_response'), 'no_reply_7d');
  assert.equal(analyticsRefundReason('sold'), 'sold');
  assert.equal(analyticsRefundReason('dealer_declined'), 'dealer_declined');
  assert.equal(analyticsRefundReason('dealer_opted_out'), 'dealer_opted_out');
  assert.equal(analyticsRefundReason('admin'), 'admin');
});

test('spend and refund helpers stamp Analytics fields on the RPC', async () => {
  const calls: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const supabase = {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      calls.push({ fn, params });
      if (fn === 'consume_credit_atomic' || fn === 'consume_market_save_atomic') {
        return { data: [{ consumed: true, already_consumed: false, balance: 8 }], error: null };
      }
      return { data: [{ refunded: true, already_refunded: false, new_balance: 9 }], error: null };
    },
  } as unknown as import('@supabase/supabase-js').SupabaseClient;

  await consumeCredit(supabase, 'user-1', '22222222-2222-4222-8222-222222222222', {
    vdpMatchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  await spendMarketSaveKey(supabase, 'user-1', 'mc-listing-1');
  await refundCredit(supabase, 'user-1', '22222222-2222-4222-8222-222222222222', 'ended_no_response');
  await refundCredit(supabase, 'user-1', '22222222-2222-4222-8222-222222222222', 'sold');

  assert.deepEqual(calls.map((call) => [call.fn, call.params]), [
    ['consume_credit_atomic', {
      p_user_id: 'user-1',
      p_deal_id: '22222222-2222-4222-8222-222222222222',
      p_vdp_match_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }],
    ['consume_market_save_atomic', {
      p_user_id: 'user-1',
      p_listing_id: 'mc-listing-1',
    }],
    ['refund_credit_atomic', {
      p_user_id: 'user-1',
      p_deal_id: '22222222-2222-4222-8222-222222222222',
      p_idempotency_key: 'refund:22222222-2222-4222-8222-222222222222',
      p_refund_reason: 'no_reply_7d',
    }],
    ['refund_credit_atomic', {
      p_user_id: 'user-1',
      p_deal_id: '22222222-2222-4222-8222-222222222222',
      p_idempotency_key: 'refund:22222222-2222-4222-8222-222222222222',
      p_refund_reason: 'sold',
    }],
  ]);
});

test('all QuotaEndState values are handled by shouldRefundCredit', () => {
  const allStates: QuotaEndState[] = ['open', 'sold', 'ended_no_response', 'removed', 'dealer_declined'];
  for (const state of allStates) {
    const result = shouldRefundCredit(state);
    assert.equal(typeof result, 'boolean', `shouldRefundCredit should return boolean for ${state}`);
  }
});
