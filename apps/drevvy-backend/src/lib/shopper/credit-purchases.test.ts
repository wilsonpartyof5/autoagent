import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { GET as getCreditBalance } from '../../app/api/consumer/credits/route';
import { handleCreditPurchase } from './credit-purchase';
import { handleCreditRestore } from './credit-restore';
import { POST as postRevenueCatWebhook } from '../../app/api/webhooks/revenuecat/route';
import { handleGetCreditBalance } from './credit-balance-handler';
import { handleRevenueCatWebhook } from './revenuecat-webhook-handler';
import {
  applyRevenueCatEvent,
  creditBalanceData,
  fetchRevenueCatSubscriber,
  findVerifiedPurchase,
  grantVerifiedPurchase,
  packForProductId,
  purchasesConfigured,
  webhookAuthorized,
} from './credit-purchases';
import { createCreditClaimLimiter } from './credit-claim-rate-limit';
import { consumeCredit, purchaseCredits, purchaseIdempotencyKey, reversePurchaseCredits } from './credits';
import { MemoryRateLimitStore } from '../public-discover/rate-limit';
import {
  createSandboxGrantCap,
  SANDBOX_GRANTS_PER_UTC_DAY,
  sandboxGrantUserIds,
} from './sandbox-grant-policy';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST_USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const sandboxAllowEnv = { DREVVY_SANDBOX_GRANT_USER_IDS: TEST_USER };
const roomySandboxCap = createSandboxGrantCap(1000);

test('product ids map to key packs and retired car packs do not', () => {
  assert.deepEqual(packForProductId('drevvy_keys_1'), { productId: 'drevvy_keys_1', size: 1, priceUsd: 4.99 });
  assert.deepEqual(packForProductId('keys_1'), { productId: 'drevvy_keys_1', size: 1, priceUsd: 4.99 });
  assert.deepEqual(packForProductId('keys_5'), { productId: 'drevvy_keys_5', size: 5, priceUsd: 19.99 });
  assert.deepEqual(packForProductId('keys_10'), { productId: 'drevvy_keys_10', size: 10, priceUsd: 34.99 });
  assert.deepEqual(packForProductId('drevvy_keys_5'), { productId: 'drevvy_keys_5', size: 5, priceUsd: 19.99 });
  assert.deepEqual(packForProductId('drevvy_keys_10'), { productId: 'drevvy_keys_10', size: 10, priceUsd: 34.99 });
  assert.deepEqual(packForProductId('drevvy_keys_25'), { productId: 'drevvy_keys_25', size: 25, priceUsd: 74.99 });
  assert.deepEqual(packForProductId('keys_25'), { productId: 'drevvy_keys_25', size: 25, priceUsd: 74.99 });
  assert.deepEqual(packForProductId('drevvy_key_1'), { productId: 'drevvy_keys_1', size: 1, priceUsd: 4.99 });
  assert.deepEqual(packForProductId('drevvy_key_10'), { productId: 'drevvy_keys_10', size: 10, priceUsd: 34.99 });
  assert.deepEqual(packForProductId('drevvy_key_25'), { productId: 'drevvy_keys_25', size: 25, priceUsd: 74.99 });
  assert.equal(packForProductId('drevvy_pack_1'), null);
  assert.equal(packForProductId('pack_1'), null);
  assert.equal(packForProductId('pack_3'), null);
  assert.equal(packForProductId('drevvy_pack_3'), null);
  assert.equal(packForProductId('drevvy_pack_5'), null);
  assert.equal(packForProductId('drevvy_pack_10'), null);
  assert.equal(packForProductId('drevvy_pack_99'), null);
  assert.equal(packForProductId('credits:100'), null);
});

test('the 1-key pack grants one key at $4.99 and a store refund reverses it', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const purchase = { id: 'rc_1', store_transaction_id: 'store_1', is_sandbox: true, store: 'app_store' };
  const verified = findVerifiedPurchase({
    non_subscriptions: {
      drevvy_keys_1: [purchase],
    },
  }, 'store_1', 'drevvy_keys_1');
  assert.equal(verified?.size, 1);
  assert.equal(verified?.priceUsd, 4.99);
  assert.equal(verified?.transactionId, 'store_1');

  const deps = sandboxApplyDeps('drevvy_keys_1', [purchase]);
  const granted = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_1',
    transaction_id: 'store_1',
    environment: 'SANDBOX',
  }, deps);
  assert.equal(granted.applied, 'granted');
  assert.equal(granted.credits?.balance, 1);
  assert.equal(granted.credits?.lifetimePurchased, 1);

  const again = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_1',
    transaction_id: 'store_1',
    environment: 'SANDBOX',
  }, deps);
  assert.equal(again.applied, 'granted');
  assert.equal(again.credits?.balance, 1);

  const refunded = await applyRevenueCatEvent(supabase, {
    type: 'REFUND',
    app_user_id: userId,
    product_id: 'drevvy_keys_1',
    transaction_id: 'store_1',
  }, lookupMissDeps());
  assert.equal(refunded.applied, 'reversed');
  assert.equal(refunded.credits?.balance, 0);
  assert.equal(refunded.credits?.lifetimeRefunded, 1);
});

test('verification uses the RevenueCat product, not a client key count', () => {
  const subscriber = {
    non_subscriptions: {
      drevvy_keys_5: [{ id: 'txn_5', store_transaction_id: 'store_5', is_sandbox: true }],
    },
  };
  const verified = findVerifiedPurchase(subscriber, 'store_5', 'drevvy_keys_5');
  assert.equal(verified?.size, 5);
  assert.equal(verified?.priceUsd, 19.99);
  assert.equal(findVerifiedPurchase(subscriber, 'store_5', 'drevvy_keys_10'), null);
  assert.equal(findVerifiedPurchase(subscriber, 'missing', 'drevvy_keys_5'), null);
  assert.equal(findVerifiedPurchase(subscriber, 'store_5', 'drevvy_pack_3'), null);
});

test('a client alias and the webhook share the store transaction id', () => {
  const subscriber = {
    non_subscriptions: {
      drevvy_keys_5: [{ id: 'rc_5', store_transaction_id: 'store_5', is_sandbox: true }],
    },
  };
  const byAlias = findVerifiedPurchase(subscriber, 'rc_5', 'drevvy_keys_5');
  const byStore = findVerifiedPurchase(subscriber, 'store_5', 'drevvy_keys_5');
  assert.equal(byAlias?.transactionId, 'store_5');
  assert.equal(byStore?.transactionId, 'store_5');
  assert.equal(byAlias?.size, 5);
  assert.equal(byAlias?.priceUsd, 19.99);
});

test('restore finds the pack from the transaction when the client sends no product', () => {
  const subscriber = {
    non_subscriptions: {
      drevvy_keys_10: [{ transaction_id: 'txn_10', is_sandbox: true }],
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
  const first = await purchaseCredits(supabase, userId, 10, 95, 'txn_10');
  const second = await purchaseCredits(supabase, userId, 10, 95, 'txn_10');
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

  const afterRefund = await purchaseCredits(supabase, userId, 10, 95, 'txn_10');
  assert.equal(afterRefund.credits.balance, 0);
});

test('a refund that arrives first blocks the later purchase', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const early = await reversePurchaseCredits(supabase, userId, 5, 'txn_5');
  assert.equal(early.reversed, false);
  const purchase = await purchaseCredits(supabase, userId, 5, 75, 'txn_5');
  assert.equal(purchase.credits.balance, 0);
  assert.equal(purchase.credits.lifetimePurchased, 0);
});

test('webhook grants NON_RENEWING_PURCHASE and refunds with the same transaction', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const purchase = { id: 'rc_5', store_transaction_id: 'txn_5', is_sandbox: true, store: 'app_store' };
  const deps = sandboxApplyDeps('drevvy_keys_5', [purchase]);
  const granted = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_5',
    environment: 'SANDBOX',
  }, deps);
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
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_5',
    environment: 'SANDBOX',
  }, deps);
  assert.equal(duplicate.credits?.balance, 5);

  const refunded = await applyRevenueCatEvent(supabase, {
    type: 'REFUND',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_5',
  }, lookupMissDeps());
  assert.equal(refunded.applied, 'reversed');
  assert.equal(refunded.credits?.balance, 0);

  const cancellation = await applyRevenueCatEvent(supabase, {
    type: 'CANCELLATION',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_5',
  });
  assert.equal(cancellation.applied, 'ignored');
  assert.equal(cancellation.credits, null);
  assert.equal((await readBalance(supabase, userId)).lifetimeRefunded, 5);
});

test('webhook ignores anonymous users and unknown products', async () => {
  const supabase = memoryCredits();
  const anonymous = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: '$RCAnonymousID:abc',
    product_id: 'drevvy_keys_1',
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

test('balance credits exactly once per purchase transaction id', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const subscriber = {
    non_subscriptions: {
      drevvy_keys_10: [{ id: 'rc_10', store_transaction_id: 'store_10', is_sandbox: true }],
    },
  };
  const verified = findVerifiedPurchase(subscriber, 'rc_10', 'drevvy_keys_10');
  assert.ok(verified);
  const clientGrant = await grantVerifiedPurchase(supabase, userId, verified);
  const webhookGrant = await applyRevenueCatEvent(supabase, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_10',
    transaction_id: 'store_10',
    environment: 'SANDBOX',
  }, sandboxApplyDeps('drevvy_keys_10', [{
    id: 'rc_10',
    store_transaction_id: 'store_10',
    is_sandbox: true,
    store: 'app_store',
  }]));
  const restoreAlias = await grantVerifiedPurchase(supabase, userId, verified);
  assert.equal(clientGrant.granted, true);
  assert.equal(clientGrant.credits.balance, 10);
  assert.equal(webhookGrant.applied, 'granted');
  assert.equal(webhookGrant.credits?.balance, 10);
  assert.equal(restoreAlias.alreadyGranted, true);
  assert.equal(restoreAlias.credits.balance, 10);
  assert.equal(restoreAlias.credits.lifetimePurchased, 10);
});

test('refunds deduct each key pack once and do not go below zero', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  await purchaseCredits(supabase, userId, 5, 19.99, 'txn_5pack');
  await consumeCredit(supabase, userId, '22222222-2222-4222-8222-222222222222');
  await consumeCredit(supabase, userId, '33333333-3333-4333-8333-333333333333');
  const refund = await applyRevenueCatEvent(supabase, {
    type: 'REFUND',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_5pack',
  }, lookupMissDeps());
  assert.equal(refund.applied, 'reversed');
  assert.equal(refund.credits?.balance, 0);
  assert.equal(refund.credits?.lifetimeRefunded, 5);

  const again = await applyRevenueCatEvent(supabase, {
    type: 'CANCELLATION',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_5pack',
  });
  assert.equal(again.applied, 'ignored');
  assert.equal((await readBalance(supabase, userId)).lifetimeRefunded, 5);

  await purchaseCredits(supabase, userId, 10, 34.99, 'txn_10');
  const pack10 = await reversePurchaseCredits(supabase, userId, 10, 'txn_10');
  assert.equal(pack10.reversed, true);
  assert.equal(pack10.credits.balance, 0);
  assert.equal(pack10.credits.lifetimeRefunded, 15);
  await purchaseCredits(supabase, userId, 25, 74.99, 'txn_25');
  const pack25 = await reversePurchaseCredits(supabase, userId, 25, 'txn_25');
  assert.equal(pack25.reversed, true);
  assert.equal(pack25.credits.balance, 0);
  const pack25Again = await reversePurchaseCredits(supabase, userId, 25, 'txn_25');
  assert.equal(pack25Again.alreadyReversed, true);
  assert.equal(pack25Again.credits.balance, 0);
  assert.equal(pack25Again.credits.lifetimeRefunded, 40);
});

test('GET /api/consumer/credits returns the key balance for the signed-in shopper', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  await purchaseCredits(supabase, userId, 5, 75, 'txn_balance');
  const response = await handleGetCreditBalance(new Request('http://localhost/api/consumer/credits'), {
    requireAuth: async () => ({ userId }),
    supabase: () => supabase,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      balance: 5,
      lifetimePurchased: 5,
      lifetimeUsed: 0,
      lifetimeRefunded: 0,
    },
  });

  const missing = await getCreditBalance(new Request('http://localhost/api/consumer/credits') as never);
  assert.equal(missing.status, 401);
  const body = await missing.json() as { error?: { code?: string } };
  assert.equal(body.error?.code, 'unauthorized');
});

test('the RevenueCat webhook credits once, deducts a refund, and retries a failed write', async () => {
  const supabase = memoryCredits();
  const userId = '11111111-1111-4111-8111-111111111111';
  const event = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_hook',
    environment: 'SANDBOX',
  };
  const hookDeps = sandboxHookDeps(supabase, 'drevvy_keys_5', [{
    id: 'rc_hook',
    store_transaction_id: 'txn_hook',
    is_sandbox: true,
    store: 'app_store',
  }]);
  const first = await handleRevenueCatWebhook(jsonRequest(event), hookDeps);
  const second = await handleRevenueCatWebhook(jsonRequest(event), hookDeps);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal((await readBalance(supabase, userId)).balance, 5);

  const refund = await handleRevenueCatWebhook(jsonRequest({
    type: 'REFUND',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'txn_hook',
  }), { secret: 'secret', supabase, ...lookupMissDeps() });
  assert.equal(refund.status, 200);
  assert.equal((await readBalance(supabase, userId)).balance, 0);

  const unauthorized = await postRevenueCatWebhook(jsonRequest(event) as never);
  assert.equal(unauthorized.status, 401);
  const invalid = await handleRevenueCatWebhook(new Request('http://localhost/api/webhooks/revenuecat', {
    method: 'POST',
    headers: { authorization: 'secret' },
    body: '{',
  }), { secret: 'secret', supabase });
  assert.equal(invalid.status, 400);

  const down = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: 'db down' } }),
        }),
      }),
    }),
    rpc: async () => ({ data: null, error: { message: 'db down' } }),
  } as unknown as SupabaseClient;
  const retry = await handleRevenueCatWebhook(jsonRequest(event), sandboxHookDeps(down, 'drevvy_keys_5', [{
    id: 'rc_hook',
    store_transaction_id: 'txn_hook',
    is_sandbox: true,
    store: 'app_store',
  }]));
  assert.equal(retry.status, 500);
});

test('a sandbox purchase grants once on credits, restore, and the webhook', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const purchase = { id: 'rc_sbx', store_transaction_id: 'store_sbx', is_sandbox: true };

  const creditsDb = memoryCredits();
  const firstPurchase = await handleCreditPurchase(
    creditPurchaseRequest('store_sbx'),
    creditRouteDeps(creditsDb, [purchase]),
  );
  const replayedPurchase = await handleCreditPurchase(
    creditPurchaseRequest('store_sbx'),
    creditRouteDeps(creditsDb, [purchase]),
  );
  assert.equal(firstPurchase.status, 200);
  assert.deepEqual(await firstPurchase.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
  assert.equal(replayedPurchase.status, 200);
  assert.deepEqual(await replayedPurchase.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });

  const restoreDb = memoryCredits();
  const firstRestore = await handleCreditRestore(
    creditRestoreRequest(['store_sbx']),
    creditRouteDeps(restoreDb, [purchase]),
  );
  const replayedRestore = await handleCreditRestore(
    creditRestoreRequest(['store_sbx']),
    creditRouteDeps(restoreDb, [purchase]),
  );
  assert.equal(firstRestore.status, 200);
  assert.deepEqual(await firstRestore.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
  assert.equal(replayedRestore.status, 200);
  assert.deepEqual(await replayedRestore.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });

  const webhookDb = memoryCredits();
  const event = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_sbx',
    environment: 'SANDBOX',
  };
  const firstHook = await handleRevenueCatWebhook(
    jsonRequest(event),
    sandboxHookDeps(webhookDb, 'drevvy_keys_5', [purchase]),
  );
  const replayedHook = await handleRevenueCatWebhook(
    jsonRequest(event),
    sandboxHookDeps(webhookDb, 'drevvy_keys_5', [purchase]),
  );
  assert.equal(firstHook.status, 200);
  assert.equal(replayedHook.status, 200);
  assert.deepEqual(await readBalance(webhookDb, userId), {
    balance: 5,
    lifetimePurchased: 5,
    lifetimeUsed: 0,
    lifetimeRefunded: 0,
  });
});

test('a production purchase grants once on claim, restore, and the webhook', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const purchase = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: false };
  const event = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  };

  assert.equal(findVerifiedPurchase({
    non_subscriptions: { drevvy_keys_5: [purchase] },
  }, 'store_prod', 'drevvy_keys_5')?.transactionId, 'store_prod');

  const creditsDb = memoryCredits();
  const firstPurchase = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(creditsDb, [purchase]),
  );
  const replayedPurchase = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(creditsDb, [purchase]),
  );
  assert.equal(firstPurchase.status, 200);
  assert.equal(replayedPurchase.status, 200);
  assert.deepEqual(await firstPurchase.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
  assert.deepEqual(await replayedPurchase.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });

  const restoreDb = memoryCredits();
  const firstRestore = await handleCreditRestore(
    creditRestoreRequest(['store_prod']),
    creditRouteDeps(restoreDb, [purchase]),
  );
  const replayedRestore = await handleCreditRestore(
    creditRestoreRequest(['store_prod']),
    creditRouteDeps(restoreDb, [purchase]),
  );
  assert.equal(firstRestore.status, 200);
  assert.equal(replayedRestore.status, 200);
  assert.deepEqual(await firstRestore.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
  assert.deepEqual(await replayedRestore.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });

  const webhookDb = memoryCredits();
  const firstHook = await handleRevenueCatWebhook(
    jsonRequest(event),
    productionHookDeps(webhookDb, [purchase]),
  );
  const replayedHook = await handleRevenueCatWebhook(
    jsonRequest(event),
    productionHookDeps(webhookDb, [purchase]),
  );
  assert.equal(firstHook.status, 200);
  assert.equal(replayedHook.status, 200);
  assert.deepEqual(await readBalance(webhookDb, userId), {
    balance: 5,
    lifetimePurchased: 5,
    lifetimeUsed: 0,
    lifetimeRefunded: 0,
  });
});

test('a production claim and webhook share one store transaction', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const purchase = {
    id: 'rc_prod',
    store_transaction_id: 'store_prod',
    transaction_id: 'apple_prod',
    is_sandbox: false,
  };
  const event = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'rc_prod',
    environment: 'PRODUCTION',
  };
  const expected = {
    balance: 5,
    lifetimePurchased: 5,
    lifetimeUsed: 0,
    lifetimeRefunded: 0,
  };

  const claimFirst = memoryCredits();
  const claimed = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(claimFirst, [purchase]),
  );
  assert.equal(claimed.status, 200);
  const hookAfterClaim = await handleRevenueCatWebhook(
    jsonRequest(event),
    productionHookDeps(claimFirst, [purchase]),
  );
  assert.equal(hookAfterClaim.status, 200);
  assert.deepEqual(await readBalance(claimFirst, userId), expected);

  const hookFirst = memoryCredits();
  const hooked = await handleRevenueCatWebhook(
    jsonRequest(event),
    productionHookDeps(hookFirst, [purchase]),
  );
  assert.equal(hooked.status, 200);
  const claimAfterHook = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(hookFirst, [purchase]),
  );
  assert.equal(claimAfterHook.status, 200);
  assert.deepEqual(await readBalance(hookFirst, userId), expected);
});

test('restore credits a production purchase a missed webhook left ungranted', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const purchase = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: false };
  const db = memoryCredits();
  const missed = await handleRevenueCatWebhook(jsonRequest({
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  }), {
    secret: 'secret',
    supabase: db,
    apiKey: 'secret',
    fetchImpl: (async () => new Response(JSON.stringify({
      subscriber: { non_subscriptions: {} },
    }), { status: 200 })) as typeof fetch,
  });
  assert.equal(missed.status, 200);
  assert.equal((await readBalance(db, userId)).balance, 0);

  const restored = await handleCreditRestore(
    creditRestoreRequest(['store_prod']),
    creditRouteDeps(db, [purchase]),
  );
  const again = await handleCreditRestore(
    creditRestoreRequest(['store_prod']),
    creditRouteDeps(db, [purchase]),
  );
  assert.equal(restored.status, 200);
  assert.equal(again.status, 200);
  assert.deepEqual(await restored.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
  assert.deepEqual(await again.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
});

test('a reversed production transaction cannot be granted again', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const purchase = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: false };
  const db = memoryCredits();
  const granted = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(db, [purchase]),
  );
  assert.equal(granted.status, 200);

  const refunded = await applyRevenueCatEvent(db, {
    type: 'REFUND',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
  }, lookupMissDeps());
  assert.equal(refunded.applied, 'reversed');
  assert.equal(refunded.credits?.balance, 0);

  const claim = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(db, [purchase]),
  );
  assert.equal(claim.status, 200);
  assert.deepEqual(await claim.json(), {
    data: { balance: 0, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 5 },
  });

  const hook = await applyRevenueCatEvent(db, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  }, {
    apiKey: 'secret',
    fetchImpl: subscriberFetch([purchase]),
  });
  assert.equal(hook.retryable, false);
  assert.equal(hook.credits?.balance, 0);
  assert.equal(hook.credits?.lifetimePurchased, 5);
  assert.equal((await readBalance(db, userId)).balance, 0);

  const blocked = memoryCredits();
  const earlyRefund = await applyRevenueCatEvent(blocked, {
    type: 'REFUND',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
  }, lookupMissDeps());
  assert.equal(earlyRefund.applied, 'ignored');
  const afterRefund = await applyRevenueCatEvent(blocked, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  }, {
    apiKey: 'secret',
    fetchImpl: subscriberFetch([purchase]),
  });
  assert.equal(afterRefund.applied, 'ignored');
  assert.equal(afterRefund.retryable, false);
  assert.equal(afterRefund.credits?.balance, 0);
  assert.equal(afterRefund.credits?.lifetimePurchased, 0);
  const blockedClaim = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(blocked, [purchase]),
  );
  assert.equal(blockedClaim.status, 200);
  assert.deepEqual(await blockedClaim.json(), {
    data: { balance: 0, lifetimePurchased: 0, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
});

test('a sandbox webhook confirms the subscriber and does not grant without the allowlist', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  let called = false;
  const purchase = { id: 'rc_sbx', store_transaction_id: 'store_sbx', is_sandbox: true, store: 'app_store' };
  const granted = await applyRevenueCatEvent(memoryCredits(), {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_sbx',
    environment: 'SANDBOX',
  }, {
    apiKey: 'secret',
    env: {},
    sandboxCap: roomySandboxCap,
    fetchImpl: (async () => {
      called = true;
      return new Response(JSON.stringify({
        subscriber: { non_subscriptions: { drevvy_keys_5: [purchase] } },
      }), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(called, true);
  assert.equal(granted.applied, 'ignored');
  assert.equal(granted.retryable, false);
  assert.equal(granted.credits, null);
});

test('a production webhook retries when RevenueCat cannot confirm it', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const event = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  };
  const db = memoryCredits();
  const down = await handleRevenueCatWebhook(jsonRequest(event), {
    secret: 'secret',
    supabase: db,
    apiKey: 'secret',
    fetchImpl: (async () => new Response('no', { status: 503 })) as typeof fetch,
  });
  assert.equal(down.status, 500);
  const body = await down.json() as { error?: string };
  assert.equal(body.error, 'Credit update failed');
  assert.equal((await readBalance(db, userId)).balance, 0);

  const unconfigured = await applyRevenueCatEvent(db, event, { apiKey: '' });
  assert.equal(unconfigured.applied, 'ignored');
  assert.equal(unconfigured.retryable, true);
  assert.equal(unconfigured.credits, null);

  const invalidFlag = await applyRevenueCatEvent(db, event, {
    apiKey: 'secret',
    fetchImpl: subscriberFetch([{ id: 'rc_text', store_transaction_id: 'store_prod', is_sandbox: 'true' }]),
  });
  assert.equal(invalidFlag.applied, 'ignored');
  assert.equal(invalidFlag.retryable, false);
  assert.equal(invalidFlag.credits, null);
  assert.equal((await readBalance(db, userId)).balance, 0);
});

test('missing, invalid, and unverified purchases grant nothing', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const rejected = [
    { id: 'rc_missing', store_transaction_id: 'store_missing' },
    { id: 'rc_null', store_transaction_id: 'store_null', is_sandbox: null },
    { id: 'rc_text', store_transaction_id: 'store_text', is_sandbox: 'true' },
    { id: 'rc_num', store_transaction_id: 'store_num', is_sandbox: 1 },
  ];

  for (const purchase of rejected) {
    const transactionId = purchase.store_transaction_id;
    assert.equal(findVerifiedPurchase({
      non_subscriptions: { drevvy_keys_5: [purchase] },
    }, transactionId, 'drevvy_keys_5'), null);

    const creditsDb = memoryCredits();
    const purchaseResponse = await handleCreditPurchase(
      creditPurchaseRequest(transactionId),
      creditRouteDeps(creditsDb, [purchase]),
    );
    assert.equal(purchaseResponse.status, 402);
    const purchaseBody = await purchaseResponse.json() as { error?: { code?: string } };
    assert.equal(purchaseBody.error?.code, 'unverified_purchase');
    assert.equal((await readBalance(creditsDb, userId)).balance, 0);

    const restoreDb = memoryCredits();
    const restoreResponse = await handleCreditRestore(
      creditRestoreRequest([transactionId]),
      creditRouteDeps(restoreDb, [purchase]),
    );
    assert.equal(restoreResponse.status, 200);
    assert.deepEqual(await restoreResponse.json(), {
      data: { balance: 0, lifetimePurchased: 0, lifetimeUsed: 0, lifetimeRefunded: 0 },
    });
  }

  const sandbox = { id: 'rc_other', store_transaction_id: 'store_other', is_sandbox: true };
  const unknownDb = memoryCredits();
  const unknownPurchase = await handleCreditPurchase(
    creditPurchaseRequest('store_unknown'),
    creditRouteDeps(unknownDb, [sandbox]),
  );
  assert.equal(unknownPurchase.status, 402);
  assert.equal((await readBalance(unknownDb, userId)).balance, 0);
  const unknownRestore = await handleCreditRestore(
    creditRestoreRequest(['store_unknown']),
    creditRouteDeps(memoryCredits(), [sandbox]),
  );
  assert.deepEqual((await unknownRestore.json()).data.balance, 0);

  const environments: unknown[] = ['sandbox', 'Sandbox', '', null, true, 1];
  for (const environment of environments) {
    const webhookDb = memoryCredits();
    const event = {
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: userId,
      product_id: 'drevvy_keys_5',
      transaction_id: 'store_env',
      environment,
    };
    const applied = await applyRevenueCatEvent(webhookDb, event);
    assert.equal(applied.applied, 'ignored');
    assert.equal(applied.credits, null);
    const response = await handleRevenueCatWebhook(jsonRequest(event), { secret: 'secret', supabase: webhookDb });
    assert.equal(response.status, 200);
    assert.equal((await readBalance(webhookDb, userId)).balance, 0);
  }

  const missingEnvironment = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_no_env',
  };
  const missingDb = memoryCredits();
  const missingApplied = await applyRevenueCatEvent(missingDb, missingEnvironment);
  assert.equal(missingApplied.applied, 'ignored');
  const missingHook = await handleRevenueCatWebhook(jsonRequest(missingEnvironment), {
    secret: 'secret',
    supabase: missingDb,
  });
  assert.equal(missingHook.status, 200);
  assert.equal((await readBalance(missingDb, userId)).balance, 0);

  let lookedUp = false;
  const unknownProduct = await applyRevenueCatEvent(memoryCredits(), {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_pack_10',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  }, {
    apiKey: 'secret',
    fetchImpl: (async () => {
      lookedUp = true;
      throw new Error('unknown products are not confirmed');
    }) as typeof fetch,
  });
  assert.equal(lookedUp, false);
  assert.equal(unknownProduct.applied, 'ignored');
  assert.equal(unknownProduct.retryable, false);
  assert.equal(unknownProduct.credits, null);
});

test('credit routes require consumer auth and the purchase RPC is service-role only', () => {
  const creditsRoute = readFileSync(join(HERE, '../../app/api/consumer/credits/route.ts'), 'utf8');
  const restoreRoute = readFileSync(join(HERE, '../../app/api/consumer/credits/restore/route.ts'), 'utf8');
  const purchaseHandler = readFileSync(join(HERE, 'credit-purchase.ts'), 'utf8');
  const restoreHandler = readFileSync(join(HERE, 'credit-restore.ts'), 'utf8');
  const webhookRoute = readFileSync(join(HERE, '../../app/api/webhooks/revenuecat/route.ts'), 'utf8');
  assert.match(creditsRoute, /requireConsumerAuth/);
  assert.match(creditsRoute, /export async function GET/);
  assert.match(creditsRoute, /export async function POST/);
  assert.match(creditsRoute, /handleCreditPurchase/);
  assert.equal(creditsRoute.includes('export async function handleCreditPurchase'), false);
  assert.match(purchaseHandler, /requireConsumerAuth/);
  assert.match(purchaseHandler, /grantVerifiedPurchase/);
  assert.match(purchaseHandler, /purchases not configured/);
  assert.match(restoreRoute, /export async function POST/);
  assert.match(restoreRoute, /handleCreditRestore/);
  assert.equal(restoreRoute.includes('export async function handleCreditRestore'), false);
  assert.match(restoreHandler, /requireConsumerAuth/);
  assert.match(restoreHandler, /grantVerifiedPurchase/);
  assert.match(restoreHandler, /purchases not configured/);
  assert.match(webhookRoute, /REVENUECAT_WEBHOOK_SECRET/);
  assert.match(webhookRoute, /handleRevenueCatWebhook/);
  assert.equal(webhookRoute.includes('requireConsumerAuth'), false);
  assert.equal(webhookRoute.includes('export async function handle'), false);

  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261017000001_credit_purchase_atomic.sql'), 'utf8');
  assert.match(sql, /purchase_credits_atomic/);
  assert.match(sql, /reverse_purchase_atomic/);
  assert.match(sql, /p_reversal_key/);
  assert.match(sql, /greatest\(balance - p_amount, 0\)/);
  assert.match(sql, /revoke execute on function public.purchase_credits_atomic/);
  assert.match(sql, /to service_role/);

  const consumeSql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261018000001_consume_credit_atomic.sql'), 'utf8');
  assert.match(consumeSql, /consume_credit_atomic/);
  assert.match(consumeSql, /use:' \|\| p_deal_id::text/);
  assert.match(consumeSql, /for update/);
  assert.match(consumeSql, /balance - 1/);
  assert.match(consumeSql, /revoke execute on function public.consume_credit_atomic/);
  assert.match(consumeSql, /to service_role/);
});

test('sandbox rc_prod and store_prod grant once, refund by either id, and a prior reversal blocks the grant', async () => {
  const purchase = {
    id: 'rc_prod',
    store_transaction_id: 'store_prod',
    transaction_id: 'apple_prod',
    is_sandbox: true,
    store: 'app_store',
  };
  const expected = { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 };

  const once = memoryCredits();
  const claimed = await handleCreditPurchase(
    creditPurchaseRequest('rc_prod'),
    creditRouteDeps(once, [purchase]),
  );
  assert.equal(claimed.status, 200);
  const hooked = await handleRevenueCatWebhook(jsonRequest({
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'SANDBOX',
  }), sandboxHookDeps(once, 'drevvy_keys_5', [purchase]));
  assert.equal(hooked.status, 200);
  assert.deepEqual(await readBalance(once, TEST_USER), expected);

  const byAlias = memoryCredits();
  await handleCreditPurchase(creditPurchaseRequest('store_prod'), creditRouteDeps(byAlias, [purchase]));
  const aliasRefund = await applyRevenueCatEvent(byAlias, {
    type: 'REFUND',
    app_user_id: OTHER_USER,
    product_id: 'drevvy_keys_25',
    transaction_id: 'rc_prod',
  }, lookupMissDeps());
  assert.equal(aliasRefund.applied, 'reversed');
  assert.deepEqual(await readBalance(byAlias, TEST_USER), {
    balance: 0,
    lifetimePurchased: 5,
    lifetimeUsed: 0,
    lifetimeRefunded: 5,
  });
  assert.equal((await readBalance(byAlias, OTHER_USER)).balance, 0);

  const byStore = memoryCredits();
  await handleCreditPurchase(creditPurchaseRequest('store_prod'), creditRouteDeps(byStore, [purchase]));
  const storeRefund = await applyRevenueCatEvent(byStore, {
    type: 'REFUND',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
  }, lookupMissDeps());
  assert.equal(storeRefund.applied, 'reversed');
  assert.equal((await readBalance(byStore, TEST_USER)).lifetimeRefunded, 5);

  const blocked = memoryCredits();
  const early = await applyRevenueCatEvent(blocked, {
    type: 'REFUND',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'rc_prod',
  }, lookupMissDeps());
  assert.equal(early.applied, 'ignored');
  const lateClaim = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(blocked, [purchase]),
  );
  assert.equal(lateClaim.status, 200);
  assert.deepEqual(await lateClaim.json(), {
    data: { balance: 0, lifetimePurchased: 0, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });
  const lateHook = await applyRevenueCatEvent(blocked, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'SANDBOX',
  }, sandboxApplyDeps('drevvy_keys_5', [purchase]));
  assert.equal(lateHook.applied, 'ignored');
  assert.equal(lateHook.retryable, false);
  assert.equal((await readBalance(blocked, TEST_USER)).lifetimePurchased, 0);
});

test('a refund debits the stored pack, and a plain cancellation does not reverse', async () => {
  const purchase = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: false, store: 'app_store' };
  const db = memoryCredits();
  const granted = await handleCreditPurchase(creditPurchaseRequest('store_prod'), creditRouteDeps(db, [purchase]));
  assert.equal(granted.status, 200);

  const plain = await applyRevenueCatEvent(db, {
    type: 'CANCELLATION',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_25',
    transaction_id: 'store_prod',
    cancel_reason: 'BILLING_ERROR',
  });
  assert.equal(plain.applied, 'ignored');
  assert.equal((await readBalance(db, TEST_USER)).balance, 5);

  const refunded = await applyRevenueCatEvent(db, {
    type: 'REFUND',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_25',
    transaction_id: 'store_prod',
  }, {
    apiKey: 'secret',
    fetchImpl: productFetch('drevvy_keys_25', [{
      id: 'rc_prod',
      store_transaction_id: 'store_prod',
      is_sandbox: false,
      store: 'app_store',
    }]),
  });
  assert.equal(refunded.applied, 'reversed');
  assert.equal(refunded.credits?.balance, 0);
  assert.equal(refunded.credits?.lifetimeRefunded, 5);

  const supportDb = memoryCredits();
  await handleCreditPurchase(creditPurchaseRequest('store_prod'), creditRouteDeps(supportDb, [purchase]));
  const support = await applyRevenueCatEvent(supportDb, {
    type: 'CANCELLATION',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_25',
    transaction_id: 'store_prod',
    cancel_reason: 'CUSTOMER_SUPPORT',
  }, lookupMissDeps());
  assert.equal(support.applied, 'reversed');
  assert.equal((await readBalance(supportDb, TEST_USER)).lifetimeRefunded, 5);

  const reasonDb = memoryCredits();
  await handleCreditPurchase(creditPurchaseRequest('store_prod'), creditRouteDeps(reasonDb, [purchase]));
  const reason = await applyRevenueCatEvent(reasonDb, {
    type: 'CANCELLATION',
    app_user_id: OTHER_USER,
    product_id: 'drevvy_keys_25',
    transaction_id: 'rc_prod',
    cancel_reason: 'REFUND',
  }, lookupMissDeps());
  assert.equal(reason.applied, 'reversed');
  assert.equal((await readBalance(reasonDb, TEST_USER)).balance, 0);
  assert.equal((await readBalance(reasonDb, OTHER_USER)).balance, 0);
});

test('production grants, and sandbox or test-store purchases do not unless allowed', async () => {
  const sandboxPurchase = { id: 'rc_sbx', store_transaction_id: 'store_sbx', is_sandbox: true, store: 'app_store' };
  const closed = memoryCredits();
  const denied = await handleCreditPurchase(creditPurchaseRequest('store_sbx'), {
    ...creditRouteDeps(closed, [sandboxPurchase]),
    env: {},
  });
  assert.equal(denied.status, 403);
  const deniedBody = await denied.json() as { error?: { code?: string } };
  assert.equal(deniedBody.error?.code, 'sandbox_not_allowed');
  assert.equal((await readBalance(closed, TEST_USER)).balance, 0);

  const testStore = { id: 'rc_ts', store_transaction_id: 'store_ts', is_sandbox: false, store: 'TEST_STORE' };
  const testDb = memoryCredits();
  const testClaim = await handleCreditPurchase(
    creditPurchaseRequest('store_ts'),
    creditRouteDeps(testDb, [testStore]),
  );
  assert.equal(testClaim.status, 402);
  assert.equal(((await testClaim.json()) as { error?: { code?: string } }).error?.code, 'purchase_not_eligible');
  const promotional = {
    id: 'rc_promo',
    store_transaction_id: 'store_promo',
    is_sandbox: false,
    store: 'app_store',
    period_type: 'PROMOTIONAL',
  };
  const promoHook = await applyRevenueCatEvent(testDb, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_promo',
    environment: 'PRODUCTION',
    period_type: 'PROMOTIONAL',
  }, {
    apiKey: 'secret',
    fetchImpl: productFetch('drevvy_keys_5', [promotional]),
  });
  assert.equal(promoHook.applied, 'ignored');
  assert.equal(promoHook.retryable, false);
  const testHook = await applyRevenueCatEvent(testDb, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_ts',
    environment: 'TEST_STORE',
    store: 'TEST_STORE',
  });
  assert.equal(testHook.applied, 'ignored');
  assert.equal((await readBalance(testDb, TEST_USER)).balance, 0);

  const sandboxReceipt = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: true, store: 'app_store' };
  const labeled = await applyRevenueCatEvent(memoryCredits(), {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  }, sandboxApplyDeps('drevvy_keys_5', [sandboxReceipt]));
  assert.equal(labeled.applied, 'ignored');
  assert.equal(labeled.retryable, false);
  assert.equal(labeled.credits, null);
});

test('sandbox grants stop at the daily cap, claim returns 429, and restore skips the capped purchase', async () => {
  const cap = createSandboxGrantCap(1);
  const first = { id: 'rc_a', store_transaction_id: 'store_a', is_sandbox: true, store: 'app_store' };
  const second = { id: 'rc_b', store_transaction_id: 'store_b', is_sandbox: true, store: 'app_store' };
  const db = memoryCredits();
  const deps = {
    ...creditRouteDeps(db, [first, second]),
    sandboxCap: cap,
    env: sandboxAllowEnv,
  };
  const granted = await handleCreditPurchase(creditPurchaseRequest('store_a'), deps);
  assert.equal(granted.status, 200);
  const capped = await handleCreditPurchase(creditPurchaseRequest('store_b'), deps);
  assert.equal(capped.status, 429);
  assert.equal(((await capped.json()) as { error?: { code?: string } }).error?.code, 'sandbox_daily_cap');
  const replay = await handleCreditPurchase(creditPurchaseRequest('store_a'), deps);
  assert.equal(replay.status, 200);
  assert.equal((await readBalance(db, TEST_USER)).balance, 5);
  const restore = await handleCreditRestore(creditRestoreRequest(['store_b']), deps);
  assert.equal(restore.status, 200);
  assert.equal((await readBalance(db, TEST_USER)).balance, 5);
  const hook = await applyRevenueCatEvent(db, {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_b',
    environment: 'SANDBOX',
  }, { ...sandboxApplyDeps('drevvy_keys_5', [first, second]), sandboxCap: cap });
  assert.equal(hook.applied, 'ignored');
  assert.equal(hook.retryable, false);
  assert.equal((await readBalance(db, TEST_USER)).lifetimePurchased, 5);
});

test('the same store transaction grants one shopper', async () => {
  const purchase = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: false, store: 'app_store' };
  const db = memoryCredits();
  const first = await handleCreditPurchase(creditPurchaseRequest('store_prod'), creditRouteDeps(db, [purchase]));
  assert.equal(first.status, 200);
  const second = await handleCreditPurchase(
    creditPurchaseRequest('rc_prod'),
    creditRouteDeps(db, [purchase], OTHER_USER),
  );
  assert.equal(second.status, 409);
  const body = await second.json() as { success?: boolean; data?: unknown; error?: { code?: string; message?: string } };
  assert.equal(body.success, false);
  assert.equal(body.error?.code, 'purchase_granted_elsewhere');
  assert.equal(body.data, undefined);
  assert.equal(JSON.stringify(body).includes('added'), false);
  assert.equal((await readBalance(db, OTHER_USER)).balance, 0);
  assert.equal((await readBalance(db, TEST_USER)).balance, 5);
  const alias = await purchaseCredits(
    db,
    TEST_USER,
    5,
    19.99,
    'rc_prod',
    'drevvy_keys_5',
    ['store_prod', 'rc_prod'],
  );
  assert.equal(alias.granted, false);
  assert.equal(alias.alreadyGranted, true);
  assert.equal(alias.alreadyGrantedElsewhere, false);
  assert.equal(alias.credits.balance, 5);
});

test('restore skips a purchase granted elsewhere or refused and keeps going', async () => {
  const cap = createSandboxGrantCap(1);
  const owned = { id: 'rc_owned', store_transaction_id: 'store_owned', is_sandbox: false, store: 'app_store' };
  const refused = { id: 'rc_refused', store_transaction_id: 'store_refused', is_sandbox: true, store: 'app_store' };
  const next = { id: 'rc_next', store_transaction_id: 'store_next', is_sandbox: false, store: 'app_store' };
  const db = memoryCredits();
  const ownerDeps = creditRouteDeps(db, [owned, refused, next]);
  assert.equal((await handleCreditPurchase(creditPurchaseRequest('store_owned'), ownerDeps)).status, 200);
  const restored = await handleCreditRestore(
    creditRestoreRequest(['store_owned', 'store_refused', 'store_next']),
    {
      ...creditRouteDeps(db, [owned, refused, next], OTHER_USER),
      sandboxCap: cap,
      env: sandboxAllowEnv,
    },
  );
  assert.equal(restored.status, 200);
  assert.equal((await restored.json() as { data: { balance: number } }).data.balance, 5);
  assert.equal((await readBalance(db, OTHER_USER)).balance, 5);
  assert.equal((await readBalance(db, TEST_USER)).balance, 5);
  assert.equal((await readBalance(db, OTHER_USER)).lifetimePurchased, 5);
});

test('purchase and restore rate limits return 429 and do not grant', async () => {
  let fetches = 0;
  const purchase = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: false, store: 'app_store' };
  const db = memoryCredits();
  const denied = {
    ...creditRouteDeps(db, [purchase]),
    claimLimiter: { allow: async () => false },
    fetchImpl: (async () => {
      fetches += 1;
      throw new Error('rate limit must not fetch');
    }) as typeof fetch,
  };
  const claim = await handleCreditPurchase(creditPurchaseRequest('store_prod'), denied);
  const restore = await handleCreditRestore(creditRestoreRequest(['store_prod']), denied);
  assert.equal(claim.status, 429);
  assert.equal(restore.status, 429);
  assert.equal(((await claim.json()) as { error?: { code?: string } }).error?.code, 'rate_limited');
  assert.equal(fetches, 0);
  assert.equal((await readBalance(db, TEST_USER)).balance, 0);

  const limited = memoryCredits();
  const limiter = createCreditClaimLimiter(new MemoryRateLimitStore(), 2);
  const deps = { ...creditRouteDeps(limited, [purchase]), claimLimiter: limiter };
  assert.equal((await handleCreditPurchase(creditPurchaseRequest('store_prod'), deps)).status, 200);
  assert.equal((await handleCreditPurchase(creditPurchaseRequest('store_prod'), deps)).status, 200);
  const blocked = await handleCreditPurchase(creditPurchaseRequest('store_prod'), deps);
  assert.equal(blocked.status, 429);
  assert.equal((await readBalance(limited, TEST_USER)).balance, 5);
});

test('RevenueCat 408 and 429 are retryable on the webhook, claim, and restore', async () => {
  const event = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  };
  const errors: string[] = [];
  const original = console.error;
  console.error = (line?: unknown) => {
    errors.push(String(line));
  };
  try {
    for (const status of [408, 429]) {
      const db = memoryCredits();
      const fetchImpl = (async () => new Response('later', { status })) as typeof fetch;
      const claim = await handleCreditPurchase(
        creditPurchaseRequest('store_prod'),
        { ...creditRouteDeps(db, []), fetchImpl },
      );
      assert.equal(claim.status, 503);
      const claimBody = await claim.json() as { error?: { code?: string; message?: string } };
      assert.equal(claimBody.error?.code, 'verification_unavailable');
      assert.equal(claimBody.error?.message, 'purchases temporarily unavailable');
      const restore = await handleCreditRestore(
        creditRestoreRequest(['store_prod']),
        { ...creditRouteDeps(db, []), fetchImpl },
      );
      assert.equal(restore.status, 503);
      const hook = await handleRevenueCatWebhook(jsonRequest(event), {
        secret: 'secret',
        supabase: db,
        apiKey: 'secret',
        fetchImpl,
      });
      assert.equal(hook.status, 500);
      assert.equal((await readBalance(db, TEST_USER)).balance, 0);
    }
    const ignored = memoryCredits();
    const claim400 = await handleCreditPurchase(
      creditPurchaseRequest('store_prod'),
      { ...creditRouteDeps(ignored, []), fetchImpl: (async () => new Response('no', { status: 400 })) as typeof fetch },
    );
    assert.equal(claim400.status, 502);
    const hook400 = await applyRevenueCatEvent(ignored, event, {
      apiKey: 'secret',
      fetchImpl: (async () => new Response('no', { status: 400 })) as typeof fetch,
    });
    assert.equal(hook400.retryable, false);
    assert.equal((await readBalance(ignored, TEST_USER)).balance, 0);
  } finally {
    console.error = original;
  }
  const parsed = errors
    .filter((line) => line.includes('revenuecat_confirm_failed'))
    .map((line) => JSON.parse(line) as { reason: string; status: number | null });
  assert.equal(parsed.some((line) => line.reason === 'timeout' && line.status === 408), true);
  assert.equal(parsed.some((line) => line.reason === 'rate_limited' && line.status === 429), true);
  assert.equal(errors.join('\n').includes(TEST_USER), false);
});

test('a subscriber miss is ignored and lookup failures retry with a counted log', async () => {
  const userId = TEST_USER;
  const event = {
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: userId,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  };
  const db = memoryCredits();
  const missed = await handleRevenueCatWebhook(jsonRequest(event), {
    secret: 'secret',
    supabase: db,
    apiKey: 'secret',
    fetchImpl: (async () => new Response('missing', { status: 404 })) as typeof fetch,
  });
  assert.equal(missed.status, 200);
  assert.equal((await readBalance(db, userId)).balance, 0);

  const errors: string[] = [];
  const original = console.error;
  console.error = (line?: unknown) => {
    errors.push(String(line));
  };
  try {
    const missingKey = await applyRevenueCatEvent(db, event, { apiKey: '   ' });
    assert.equal(missingKey.retryable, true);
    const unauthorized = await handleRevenueCatWebhook(jsonRequest(event), {
      secret: 'secret',
      supabase: db,
      apiKey: 'rc-secret-value',
      fetchImpl: (async () => new Response('no', { status: 401 })) as typeof fetch,
    });
    assert.equal(unauthorized.status, 500);
    const upstream = await applyRevenueCatEvent(db, event, {
      apiKey: 'rc-secret-value',
      fetchImpl: (async () => new Response('no', { status: 503 })) as typeof fetch,
    });
    assert.equal(upstream.retryable, true);
    const transport = await applyRevenueCatEvent(db, event, {
      apiKey: 'rc-secret-value',
      fetchImpl: (async () => {
        throw new Error(`network down ${userId}`);
      }) as typeof fetch,
    });
    assert.equal(transport.retryable, true);
  } finally {
    console.error = original;
  }
  const lines = errors.filter((line) => line.includes('revenuecat_confirm_failed'));
  assert.ok(lines.length >= 4);
  const parsed = lines.map((line) => JSON.parse(line) as { reason: string; status: number | null; repeat: number });
  assert.equal(parsed[0]?.reason, 'missing_key');
  assert.equal(parsed[1]?.reason, 'unauthorized');
  assert.equal(parsed[1]?.status, 401);
  assert.equal(parsed[2]?.reason, 'upstream');
  assert.equal(parsed[2]?.status, 503);
  assert.equal(parsed[3]?.reason, 'transport');
  assert.ok(parsed[3]!.repeat > parsed[0]!.repeat);
  const blob = lines.join('\n');
  assert.equal(blob.includes('rc-secret-value'), false);
  assert.equal(blob.includes(userId), false);
  assert.equal(blob.includes('DREVVY_SANDBOX_GRANT_USER_IDS'), false);
});

test('TRANSFER does not move keys', async () => {
  const db = memoryCredits();
  await purchaseCredits(db, TEST_USER, 5, 19.99, 'keep');
  const logs: string[] = [];
  const original = console.log;
  console.log = (line?: unknown) => {
    logs.push(String(line));
  };
  try {
    const result = await applyRevenueCatEvent(db, { type: 'TRANSFER', app_user_id: TEST_USER });
    assert.equal(result.applied, 'ignored');
    assert.equal(result.retryable, false);
  } finally {
    console.log = original;
  }
  assert.equal((await readBalance(db, TEST_USER)).balance, 5);
  assert.equal((await readBalance(db, OTHER_USER)).balance, 0);
  assert.ok(logs.some((line) => line.includes('revenuecat_transfer_ignored')));
  assert.equal(logs.some((line) => line.includes(TEST_USER)), false);
});

test('the sandbox allowlist is trimmed and the daily cap resets on the UTC day', () => {
  assert.equal(sandboxGrantUserIds({}).size, 0);
  assert.equal(sandboxGrantUserIds({ DREVVY_SANDBOX_GRANT_USER_IDS: '   ' }).size, 0);
  const ids = sandboxGrantUserIds({
    DREVVY_SANDBOX_GRANT_USER_IDS: ` ${TEST_USER.toUpperCase()} , ${OTHER_USER} `,
  });
  assert.equal(ids.has(TEST_USER), true);
  assert.equal(ids.has(OTHER_USER), true);
  assert.equal(SANDBOX_GRANTS_PER_UTC_DAY, 5);
  const cap = createSandboxGrantCap(1);
  const day = new Date('2026-11-22T23:00:00.000Z');
  const next = new Date('2026-11-23T00:00:00.000Z');
  assert.equal(cap.allows(TEST_USER, 'a', day), true);
  cap.note(TEST_USER, 'a', day);
  assert.equal(cap.allows(TEST_USER, 'a', day), true);
  assert.equal(cap.allows(TEST_USER, 'b', day), false);
  assert.equal(cap.allows(TEST_USER, 'b', next), true);
  const policy = readFileSync(join(HERE, 'sandbox-grant-policy.ts'), 'utf8');
  assert.equal(policy.includes('console.'), false);
});

test('the old purchase RPC does not grant production, and the new RPC still does', async () => {
  const purchase = { id: 'rc_prod', store_transaction_id: 'store_prod', is_sandbox: false, store: 'app_store' };
  const legacy = legacyPurchaseRpc('PGRST202', 'Could not find the function purchase_credits_atomic');
  const logs: string[] = [];
  const original = console.error;
  console.error = (line?: unknown) => {
    logs.push(String(line));
  };
  let claimStatus = 0;
  let restoreStatus = 0;
  let claimBody: { success?: boolean; data?: unknown; error?: { code?: string; message?: string } } = {};
  try {
    const claim = await handleCreditPurchase(
      creditPurchaseRequest('store_prod'),
      creditRouteDeps(legacy.client, [purchase]),
    );
    claimStatus = claim.status;
    claimBody = await claim.json() as typeof claimBody;
    const restore = await handleCreditRestore(
      creditRestoreRequest(['store_prod']),
      creditRouteDeps(legacy.client, [purchase]),
    );
    restoreStatus = restore.status;
  } finally {
    console.error = original;
  }
  assert.equal(claimStatus, 503);
  assert.equal(claimBody.success, false);
  assert.equal(claimBody.data, undefined);
  assert.equal(claimBody.error?.code, 'purchases_unavailable');
  assert.equal(claimBody.error?.message, 'purchases temporarily unavailable');
  assert.equal(restoreStatus, 503);
  assert.equal(legacy.calls(), 2);
  assert.equal((await readBalance(legacy.client, TEST_USER)).balance, 0);
  const line = logs.find((entry) => entry.includes('store_transactions_not_applied'));
  assert.ok(line);
  const parsed = JSON.parse(line!) as { event: string; message: string };
  assert.equal(parsed.event, 'store_transactions_not_applied');
  assert.equal(parsed.message, 'store_transactions is not applied');
  assert.equal(line!.includes(TEST_USER), false);
  assert.equal(line!.includes('store_prod'), false);
  assert.equal(line!.includes('secret'), false);

  const schemaCache = legacyPurchaseRpc('PGRST204', 'purchase_credits_atomic was not found in the schema cache');
  const hook = await handleRevenueCatWebhook(jsonRequest({
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: TEST_USER,
    product_id: 'drevvy_keys_5',
    transaction_id: 'store_prod',
    environment: 'PRODUCTION',
  }), { ...productionHookDeps(schemaCache.client, [purchase]) });
  assert.equal(hook.status, 500);
  assert.equal(schemaCache.calls(), 1);
  assert.equal((await readBalance(schemaCache.client, TEST_USER)).balance, 0);

  const current = acceptingPurchaseRpc();
  const granted = await handleCreditPurchase(
    creditPurchaseRequest('store_prod'),
    creditRouteDeps(current.client, [purchase]),
  );
  assert.equal(granted.status, 200);
  assert.equal(current.calls(), 1);
  assert.deepEqual(await granted.json(), {
    data: { balance: 5, lifetimePurchased: 5, lifetimeUsed: 0, lifetimeRefunded: 0 },
  });

  const sandboxPurchase = { id: 'rc_sbx', store_transaction_id: 'store_sbx', is_sandbox: true, store: 'app_store' };
  const sandboxLegacy = legacyPurchaseRpc('PGRST202', 'Could not find the function purchase_credits_atomic');
  const sandboxClaim = await handleCreditPurchase(
    creditPurchaseRequest('store_sbx'),
    creditRouteDeps(sandboxLegacy.client, [sandboxPurchase]),
  );
  assert.equal(sandboxClaim.status, 200);
  assert.equal(sandboxLegacy.calls(), 2);
  assert.equal((await readBalance(sandboxLegacy.client, TEST_USER)).balance, 5);
});

test('held store-transaction sql stays out of supabase/migrations', () => {
  const migrations = readdirSync(join(HERE, '../../../../../supabase/migrations'));
  assert.equal(migrations.some((name) => name.includes('store_transaction')), false);
  const held = readFileSync(
    join(HERE, '../../../../../supabase/held/20261122210000_store_transaction_unique_grants.sql'),
    'utf8',
  );
  assert.match(held, /store_transaction_aliases/);
  assert.match(held, /using gin \(aliases\)/);
  assert.match(held, /already_granted_elsewhere/);
  assert.match(held, /revoke all on table public.store_transactions from anon, authenticated, public/);
  assert.match(held, /revoke all on table public.store_transaction_aliases from anon, authenticated, public/);
  assert.match(held, /revoke execute on function public.purchase_credits_atomic/);
  assert.match(held, /raise warning/);
  assert.match(held, /on conflict \(transaction_id\) do nothing/);
  assert.match(held, /do not delete/);
  assert.match(held, /Rollback/);
  assert.match(held, /p_aliases/);
  assert.match(held, /s\.pack_size/);
  assert.match(held, /^begin;/m);
  assert.match(held, /^commit;/m);
  assert.match(held, /rolname = 'drevvy_clickpipes'/);
  assert.match(held, /revoke all on table public\.store_transactions from drevvy_clickpipes/);
  assert.match(held, /revoke all on table public\.store_transaction_aliases from drevvy_clickpipes/);
  assert.match(held, /revoke all on function public\.purchase_credits_atomic/);
  assert.match(held, /revoke all on function public\.reverse_purchase_atomic/);
  assert.match(held, /supabase_realtime/);
  assert.match(held, /drevvy_clickhouse/);
  assert.match(held, /not added to any publication/);
  assert.match(held, /FOR ALL TABLES/);
  assert.equal(/alter publication/i.test(held), false);
  assert.equal(/create publication/i.test(held), false);
  const txCreate = held.indexOf('create table if not exists public.store_transactions');
  const txRevoke = held.indexOf('revoke all on table public.store_transactions from drevvy_clickpipes');
  const aliasCreate = held.indexOf('create table if not exists public.store_transaction_aliases');
  const aliasRevoke = held.indexOf('revoke all on table public.store_transaction_aliases from drevvy_clickpipes');
  assert.ok(txCreate >= 0 && txCreate < txRevoke && txRevoke < aliasCreate && aliasCreate < aliasRevoke);
});

function creditPurchaseRequest(transactionId: string) {
  return new Request('http://localhost/api/consumer/credits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'drevvy_keys_5', transactionId }),
  }) as never;
}

function creditRestoreRequest(transactionIds: string[]) {
  return new Request('http://localhost/api/consumer/credits/restore', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transactionIds }),
  }) as never;
}

function productFetch(productId: string, purchases: unknown[]): typeof fetch {
  return (async () => new Response(JSON.stringify({
    subscriber: { non_subscriptions: { [productId]: purchases } },
  }), { status: 200 })) as typeof fetch;
}

function subscriberFetch(purchases: unknown[]): typeof fetch {
  return productFetch('drevvy_keys_5', purchases);
}

function sandboxApplyDeps(productId: string, purchases: unknown[]) {
  return {
    apiKey: 'secret',
    fetchImpl: productFetch(productId, purchases),
    env: sandboxAllowEnv,
    sandboxCap: roomySandboxCap,
  };
}

function sandboxHookDeps(supabase: SupabaseClient, productId: string, purchases: unknown[]) {
  return { secret: 'secret', supabase, ...sandboxApplyDeps(productId, purchases) };
}

function lookupMissDeps() {
  return {
    apiKey: 'secret',
    fetchImpl: (async () => new Response(JSON.stringify({
      subscriber: { non_subscriptions: {} },
    }), { status: 200 })) as typeof fetch,
  };
}

function productionHookDeps(supabase: SupabaseClient, purchases: unknown[]) {
  return {
    secret: 'secret',
    supabase,
    apiKey: 'secret',
    fetchImpl: subscriberFetch(purchases),
  };
}

function creditRouteDeps(supabase: SupabaseClient, purchases: unknown[], userId = TEST_USER) {
  return {
    requireAuth: async () => ({ userId }),
    supabase,
    apiKey: 'secret',
    env: sandboxAllowEnv,
    claimLimiter: { allow: async () => true },
    sandboxCap: roomySandboxCap,
    fetchImpl: subscriberFetch(purchases),
  };
}

function jsonRequest(event: Record<string, unknown>): Request {
  return new Request('http://localhost/api/webhooks/revenuecat', {
    method: 'POST',
    headers: { authorization: 'secret', 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  });
}

async function readBalance(supabase: SupabaseClient, userId: string) {
  const response = await handleGetCreditBalance(new Request('http://localhost/api/consumer/credits'), {
    requireAuth: async () => ({ userId }),
    supabase: () => supabase,
  });
  const body = await response.json() as {
    data: { balance: number; lifetimePurchased: number; lifetimeUsed: number; lifetimeRefunded: number };
  };
  return body.data;
}

function legacyPurchaseRpc(code: string, message: string) {
  let calls = 0;
  let balance = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: balance === 0 ? null : {
              user_id: TEST_USER,
              balance,
              lifetime_purchased: balance,
              lifetime_used: 0,
              lifetime_refunded: 0,
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (name: string, params: { p_aliases?: string[] | null; p_product_id?: string | null; p_pack_size?: number }) => {
      if (name !== 'purchase_credits_atomic') return { data: null, error: { message: 'unknown rpc' } };
      calls += 1;
      if (params.p_aliases != null || params.p_product_id != null) {
        return { data: null, error: { code, message } };
      }
      balance += params.p_pack_size ?? 0;
      return {
        data: [{
          granted: true,
          already_granted: false,
          balance,
          lifetime_purchased: balance,
          lifetime_used: 0,
          lifetime_refunded: 0,
        }],
        error: null,
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls: () => calls };
}

function acceptingPurchaseRpc() {
  let calls = 0;
  let balance = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: balance === 0 ? null : {
              user_id: TEST_USER,
              balance,
              lifetime_purchased: balance,
              lifetime_used: 0,
              lifetime_refunded: 0,
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (name: string, params: { p_pack_size?: number }) => {
      if (name !== 'purchase_credits_atomic') return { data: null, error: { message: 'unknown rpc' } };
      calls += 1;
      balance += params.p_pack_size ?? 0;
      return {
        data: [{
          granted: true,
          already_granted: false,
          balance,
          lifetime_purchased: balance,
          lifetime_used: 0,
          lifetime_refunded: 0,
        }],
        error: null,
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls: () => calls };
}

function memoryCredits(): SupabaseClient {
  type Balance = { balance: number; lifetime_purchased: number; lifetime_used: number; lifetime_refunded: number };
  type StoreRow = { canonical: string; userId: string; packSize: number; reversed: boolean };
  const balances = new Map<string, Balance>();
  const events = new Map<string, Set<string>>();
  const store = new Map<string, StoreRow>();
  const aliasIndex = new Map<string, string>();

  function account(userId: string) {
    const row = balances.get(userId) ?? {
      balance: 0,
      lifetime_purchased: 0,
      lifetime_used: 0,
      lifetime_refunded: 0,
    };
    balances.set(userId, row);
    const keys = events.get(userId) ?? new Set<string>();
    events.set(userId, keys);
    return { row, keys };
  }

  function aliasList(canonical: string, raw: unknown): string[] {
    const ids: string[] = [];
    const push = (value: unknown) => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed || ids.includes(trimmed)) return;
      ids.push(trimmed);
    };
    push(canonical);
    if (Array.isArray(raw)) for (const value of raw) push(value);
    return ids;
  }

  function findRow(aliases: string[]): StoreRow | null {
    for (const alias of aliases) {
      const canonical = aliasIndex.get(alias);
      if (!canonical) continue;
      const row = store.get(canonical);
      if (row) return row;
    }
    return null;
  }

  function snapshot(row: Balance, extra: Record<string, boolean>) {
    return {
      data: [{
        ...extra,
        balance: row.balance,
        lifetime_purchased: row.lifetime_purchased,
        lifetime_used: row.lifetime_used,
        lifetime_refunded: row.lifetime_refunded,
      }],
      error: null,
    };
  }

  const client = {
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: (_col: string, userId: string) => ({
          maybeSingle: async () => {
            if (table !== 'shopper_credits') return { data: null, error: null };
            const row = balances.get(userId);
            return { data: row ? { ...row, user_id: userId } : null, error: null };
          },
        }),
      }),
    }),
    rpc: async (fnName: string, params: {
      p_user_id?: string;
      p_pack_size?: number;
      p_amount?: number;
      p_deal_id?: string;
      p_idempotency_key?: string;
      p_reversal_key?: string;
      p_purchase_key?: string;
      p_aliases?: string[] | null;
    }) => {
      const userId = params.p_user_id ?? '';
      const { row, keys } = account(userId);

      if (fnName === 'purchase_credits_atomic') {
        const purchaseKey = params.p_idempotency_key ?? '';
        const reversalKey = params.p_reversal_key ?? '';
        const canonical = purchaseKey.startsWith('purchase:') ? purchaseKey.slice('purchase:'.length) : '';
        if (keys.has(purchaseKey)) {
          return snapshot(row, { granted: false, already_granted: true, already_granted_elsewhere: false });
        }
        if (keys.has(reversalKey)) {
          return snapshot(row, { granted: false, already_granted: false, already_granted_elsewhere: false });
        }
        const aliases = aliasList(canonical, params.p_aliases);
        const existing = findRow(aliases);
        if (existing?.reversed) {
          return snapshot(row, { granted: false, already_granted: false, already_granted_elsewhere: false });
        }
        if (existing && existing.userId === userId) {
          return snapshot(row, { granted: false, already_granted: true, already_granted_elsewhere: false });
        }
        if (existing && existing.userId !== userId) {
          return snapshot(row, { granted: false, already_granted: false, already_granted_elsewhere: true });
        }
        const packSize = params.p_pack_size ?? 0;
        store.set(canonical, { canonical, userId, packSize, reversed: false });
        for (const alias of aliases) aliasIndex.set(alias, canonical);
        keys.add(purchaseKey);
        row.balance += packSize;
        row.lifetime_purchased += packSize;
        return snapshot(row, { granted: true, already_granted: false, already_granted_elsewhere: false });
      }

      if (fnName === 'reverse_purchase_atomic') {
        const purchaseKey = params.p_purchase_key ?? '';
        const eventId = purchaseKey.startsWith('purchase:') ? purchaseKey.slice('purchase:'.length) : '';
        const existing = findRow(aliasList(eventId, null));
        if (!existing) {
          const tombstone: StoreRow = {
            canonical: eventId,
            userId,
            packSize: params.p_amount ?? 1,
            reversed: true,
          };
          store.set(eventId, tombstone);
          aliasIndex.set(eventId, eventId);
          keys.add(`purchase_reversal:${eventId}`);
          return snapshot(row, { reversed: false, already_reversed: false });
        }
        const target = account(existing.userId);
        const reversalKey = `purchase_reversal:${existing.canonical}`;
        const ownedPurchase = `purchase:${existing.canonical}`;
        if (target.keys.has(reversalKey)) {
          return snapshot(target.row, { reversed: false, already_reversed: true });
        }
        const purchased = target.keys.has(ownedPurchase);
        target.keys.add(reversalKey);
        existing.reversed = true;
        if (!aliasIndex.has(eventId)) aliasIndex.set(eventId, existing.canonical);
        if (!purchased) return snapshot(target.row, { reversed: false, already_reversed: false });
        target.row.balance = Math.max(target.row.balance - existing.packSize, 0);
        target.row.lifetime_refunded += existing.packSize;
        return snapshot(target.row, { reversed: true, already_reversed: false });
      }

      if (fnName === 'consume_credit_atomic') {
        const key = `use:dealer_conversation:${params.p_deal_id ?? ''}`;
        if (keys.has(key)) {
          return { data: [{ consumed: true, already_consumed: true, ...row }], error: null };
        }
        if (row.balance <= 0) {
          return { data: [{ consumed: false, already_consumed: false, ...row }], error: null };
        }
        keys.add(key);
        row.balance -= 1;
        row.lifetime_used += 1;
        return { data: [{ consumed: true, already_consumed: false, ...row }], error: null };
      }

      return { data: null, error: { message: 'unknown rpc' } };
    },
  };
  return client as unknown as SupabaseClient;
}
