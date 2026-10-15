import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  applyRevenueCatEvent,
  creditBalanceData,
  fetchRevenueCatSubscriber,
  findVerifiedPurchase,
  packForProductId,
  purchasesConfigured,
  webhookAuthorized,
} from './credit-purchases';
import { purchaseCredits, purchaseIdempotencyKey, reversePurchaseCredits } from './credits';

const HERE = dirname(fileURLToPath(import.meta.url));

test('product ids map to packs and unknown ids do not', () => {
  assert.deepEqual(packForProductId('drevvy_pack_3'), { productId: 'drevvy_pack_3', size: 3, priceUsd: 47 });
  assert.deepEqual(packForProductId('drevvy_pack_5'), { productId: 'drevvy_pack_5', size: 5, priceUsd: 67 });
  assert.deepEqual(packForProductId('drevvy_pack_10'), { productId: 'drevvy_pack_10', size: 10, priceUsd: 97 });
  assert.equal(packForProductId('drevvy_pack_99'), null);
  assert.equal(packForProductId('credits:100'), null);
});

test('verification uses the RevenueCat product, not a client credit count', () => {
  const subscriber = {
    non_subscriptions: {
      drevvy_pack_3: [{ id: 'txn_3', store_transaction_id: 'store_3' }],
    },
  };
  const verified = findVerifiedPurchase(subscriber, 'store_3', 'drevvy_pack_3');
  assert.equal(verified?.size, 3);
  assert.equal(verified?.priceUsd, 47);
  assert.equal(findVerifiedPurchase(subscriber, 'store_3', 'drevvy_pack_10'), null);
  assert.equal(findVerifiedPurchase(subscriber, 'missing', 'drevvy_pack_3'), null);
});

test('restore finds the pack from the transaction when the client sends no product', () => {
  const subscriber = {
    non_subscriptions: {
      drevvy_pack_10: [{ transaction_id: 'txn_10' }],
      other_product: [{ id: 'txn_other' }],
    },
  };
  assert.equal(findVerifiedPurchase(subscriber, 'txn_10')?.size, 10);
  assert.equal(findVerifiedPurchase(subscriber, 'txn_other'), null);
});

test('purchases stay unconfigured until the RevenueCat secret is set', () => {
  assert.equal(purchasesConfigured(undefined), false);
  assert.equal(purchasesConfigured(''), false);
  assert.equal(purchasesConfigured('  '), false);
  assert.equal(purchasesConfigured('secret'), true);
});

test('webhook auth requires the configured secret', () => {
  assert.equal(webhookAuthorized('secret', undefined), false);
  assert.equal(webhookAuthorized(null, 'secret'), false);
  assert.equal(webhookAuthorized('nope', 'secret'), false);
  assert.equal(webhookAuthorized('secret', 'secret'), true);
  assert.equal(webhookAuthorized('Bearer secret', 'secret'), true);
});

test('subscriber lookup sends the secret and does not treat an error as a purchase', async () => {
  const calls: { url: string; authorization: string }[] = [];
  const ok = await fetchRevenueCatSubscriber('user-1', 'rc-secret', (async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(url), authorization: headers.get('authorization') ?? '' });
    return new Response(JSON.stringify({ subscriber: { non_subscriptions: {} } }), { status: 200 });
  }) as typeof fetch);
  assert.equal(ok.ok, true);
  assert.equal(calls[0]?.authorization, 'Bearer rc-secret');
  assert.match(calls[0]?.url ?? '', /subscribers\/user-1$/);

  const failed = await fetchRevenueCatSubscriber('user-1', 'rc-secret', (async () => {
    return new Response('no', { status: 401 });
  }) as typeof fetch);
  assert.equal(failed.ok, false);
});

test('purchase and reversal share one grant key and subtract once', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const first = await purchaseCredits(supabase, userId, 10, 97, 'txn_10');
  const second = await purchaseCredits(supabase, userId, 10, 97, 'txn_10');
  assert.equal(first.credits.balance, 10);
  assert.equal(first.credits.lifetimePurchased, 10);
  assert.equal(second.credits.balance, 10);
  assert.equal(purchaseIdempotencyKey('txn_10'), 'purchase:txn_10');

  const refund = await reversePurchaseCredits(supabase, userId, 10, 'txn_10');
  const again = await reversePurchaseCredits(supabase, userId, 10, 'txn_10');
  assert.equal(refund.reversed, true);
  assert.equal(refund.credits.balance, 0);
  assert.equal(refund.credits.lifetimeRefunded, 10);
  assert.equal(again.alreadyReversed, true);
  assert.equal(again.credits.balance, 0);

  const afterRefund = await purchaseCredits(supabase, userId, 10, 97, 'txn_10');
  assert.equal(afterRefund.credits.balance, 0);
});

test('a refund that arrives first blocks the later purchase', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const early = await reversePurchaseCredits(supabase, userId, 5, 'txn_5');
  assert.equal(early.reversed, false);
  const purchase = await purchaseCredits(supabase, userId, 5, 67, 'txn_5');
  assert.equal(purchase.credits.balance, 0);
  assert.equal(purchase.credits.lifetimePurchased, 0);
});

test('webhook grants NON_RENEWING_PURCHASE and refunds with the same transaction', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const granted = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_pack_5',
    transaction_id: 'txn_5',
  });
  assert.equal(granted.applied, 'granted');
  assert.deepEqual(creditBalanceData(granted.credits!), {
    balance: 5,
    lifetimePurchased: 5,
    lifetimeUsed: 0,
    lifetimeRefunded: 0,
  });

  const duplicate = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_pack_5',
    transaction_id: 'txn_5',
  });
  assert.equal(duplicate.credits?.balance, 5);

  const refunded = await applyRevenueCatEvent(supabase, {
    type: 'REFUND',
    app_user_id: userId,
    product_id: 'drevvy_pack_5',
    transaction_id: 'txn_5',
  });
  assert.equal(refunded.applied, 'reversed');
  assert.equal(refunded.credits?.balance, 0);

  const cancellation = await applyRevenueCatEvent(supabase, {
    type: 'CANCELLATION',
    app_user_id: userId,
    product_id: 'drevvy_pack_5',
    transaction_id: 'txn_5',
  });
  assert.equal(cancellation.credits?.balance, 0);
  assert.equal(cancellation.credits?.lifetimeRefunded, 5);
});

test('webhook ignores anonymous users and unknown products', async () => {
  const supabase = memoryCredits();
  const anonymous = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: '$RCAnonymousID:abc',
    product_id: 'drevvy_pack_3',
    transaction_id: 'txn_3',
  });
  assert.equal(anonymous.applied, 'ignored');
  const unknown = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: '11111111-1111-4111-8111-111111111111',
    product_id: 'some_subscription',
    transaction_id: 'txn_sub',
  });
  assert.equal(unknown.applied, 'ignored');
});

test('credit routes require consumer auth and the purchase RPC is service-role only', () => {
  const creditsRoute = readFileSync(join(HERE, '../../app/api/consumer/credits/route.ts'), 'utf8');
  const restoreRoute = readFileSync(join(HERE, '../../app/api/consumer/credits/restore/route.ts'), 'utf8');
  const webhookRoute = readFileSync(join(HERE, '../../app/api/webhooks/revenuecat/route.ts'), 'utf8');
  assert.match(creditsRoute, /requireConsumerAuth/);
  assert.match(restoreRoute, /requireConsumerAuth/);
  assert.match(creditsRoute, /purchases not configured/);
  assert.match(restoreRoute, /purchases not configured/);
  assert.match(webhookRoute, /REVENUECAT_WEBHOOK_SECRET/);
  assert.equal(webhookRoute.includes('requireConsumerAuth'), false);

  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261017000001_credit_purchase_atomic.sql'), 'utf8');
  assert.match(sql, /purchase_credits_atomic/);
  assert.match(sql, /reverse_purchase_atomic/);
  assert.match(sql, /p_reversal_key/);
  assert.match(sql, /greatest\(balance - p_amount, 0\)/);
  assert.match(sql, /revoke execute on function public.purchase_credits_atomic/);
  assert.match(sql, /to service_role/);
});

function memoryCredits(): SupabaseClient {
  const balances = new Map<string, { balance: number; lifetime_purchased: number; lifetime_used: number; lifetime_refunded: number }>();
  const events = new Map<string, Set<string>>();

  return {
    rpc: async (fnName: string, params: {
      p_user_id?: string;
      p_pack_size?: number;
      p_amount?: number;
      p_idempotency_key?: string;
      p_reversal_key?: string;
      p_purchase_key?: string;
    }) => {
      const userId = params.p_user_id ?? '';
      const row = balances.get(userId) ?? { balance: 0, lifetime_purchased: 0, lifetime_used: 0, lifetime_refunded: 0 };
      const keys = events.get(userId) ?? new Set<string>();
      events.set(userId, keys);
      balances.set(userId, row);

      if (fnName === 'purchase_credits_atomic') {
        const purchaseKey = params.p_idempotency_key ?? '';
        const reversalKey = params.p_reversal_key ?? '';
        if (keys.has(purchaseKey)) {
          return { data: [{ granted: false, already_granted: true, ...row }], error: null };
        }
        if (keys.has(reversalKey)) {
          return { data: [{ granted: false, already_granted: false, ...row }], error: null };
        }
        keys.add(purchaseKey);
        row.balance += params.p_pack_size ?? 0;
        row.lifetime_purchased += params.p_pack_size ?? 0;
        return { data: [{ granted: true, already_granted: false, ...row }], error: null };
      }

      if (fnName === 'reverse_purchase_atomic') {
        const purchaseKey = params.p_purchase_key ?? '';
        const reversalKey = params.p_reversal_key ?? '';
        const amount = params.p_amount ?? 0;
        if (keys.has(reversalKey)) {
          return { data: [{ reversed: false, already_reversed: true, ...row }], error: null };
        }
        const purchased = keys.has(purchaseKey);
        keys.add(reversalKey);
        if (!purchased) {
          return { data: [{ reversed: false, already_reversed: false, ...row }], error: null };
        }
        row.balance = Math.max(row.balance - amount, 0);
        row.lifetime_refunded += amount;
        return { data: [{ reversed: true, already_reversed: false, ...row }], error: null };
      }

      return { data: null, error: { message: 'unknown rpc' } };
    },
  } as unknown as SupabaseClient;
}
