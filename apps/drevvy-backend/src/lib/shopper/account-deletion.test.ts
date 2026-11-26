import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ConsumerAuthError } from '@/lib/consumer/auth';
import { MemoryRateLimitStore } from '@/lib/public-discover/rate-limit';

import { deleteExternalShopperRecords } from './account-deletion-vendors';
import {
  ACCOUNT_DELETION_PER_HOUR,
  ANONYMOUS_OPENER,
  DELETED_SHOPPER_ID,
  DELETED_SHOPPER_NAME,
  DELETE_CONSUMER_ACCOUNT_RPC,
  REDACTED_SHOPPER_MESSAGE,
  accountDeletionWindows,
  deleteConsumerAccount,
  handleConsumerProfileDelete,
  isDeletionSchemaPending,
  isMissingRelation,
  purchaseBlocksReplay,
  scrubShopperText,
  starterGrantBlocksReplay,
  stripShopperNames,
  stripShopperZip,
  type DeletionAdmin,
} from './account-deletion';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../../../../');
const USER = 'shopper-1';
const TOKEN = 'token-1';
const SENSITIVE_KEYS = ['consumer_user_id', 'email', 'phone', 'first_name', 'firstName', 'name', 'zip'];

type Row = Record<string, unknown>;

class MemoryAdmin {
  readonly log: string[] = [];
  readonly tables: Record<string, Row[]>;
  missingRelation = false;
  missingColumn = false;
  blockNullUserId = false;
  identityLocked = false;
  signOutError: { message: string; code?: string } | null = null;
  deleteUserError: { message: string; code?: string; status?: number } | null = null;
  deletedUsers: string[] = [];

  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }

  async rpc(fn: string, args: { p_user_id: string }): Promise<{ error: { message: string; code?: string } | null }> {
    this.log.push(`rpc:${fn}`);
    if (fn !== DELETE_CONSUMER_ACCOUNT_RPC) {
      return { error: { code: 'PGRST202', message: 'Could not find the function public.delete_consumer_account' } };
    }
    const dealers = this.tables.user_dealerships ?? [];
    if (dealers.some((row) => row.user_id === args.p_user_id)) {
      return { error: { code: 'P0001', message: 'dealer_account' } };
    }
    if (this.missingRelation) {
      return { error: { code: '42P01', message: 'relation "public.saved_cars" does not exist' } };
    }
    if (this.missingColumn) {
      return { error: { code: '42703', message: 'column "zip" does not exist' } };
    }
    if (this.identityLocked) {
      return { error: { code: 'P0001', message: 'conversation identity is locked' } };
    }
    if (this.blockNullUserId) {
      return { error: { code: '23502', message: 'null value in column "consumer_user_id" violates not-null constraint' } };
    }
    this.apply(args.p_user_id);
    return { error: null };
  }

  auth = {
    admin: {
      signOut: async (jwt: string) => {
        this.log.push('signOut');
        assert.equal(jwt, TOKEN);
        return { error: this.signOutError };
      },
      deleteUser: async (id: string) => {
        this.log.push('deleteUser');
        if (this.deleteUserError) return { error: this.deleteUserError };
        this.deletedUsers.push(id);
        return { error: null };
      },
    },
  };

  private apply(userId: string): void {
    const names = namesFor(this.tables, userId);
    const dealIds = new Set<string>();
    for (const row of this.tables.shopper_deals ?? []) {
      if (row.consumer_user_id === userId && typeof row.id === 'string') dealIds.add(row.id);
    }
    for (const row of this.tables.shopper_dealer_conversations ?? []) {
      if (row.consumer_user_id === userId && typeof row.deal_id === 'string') dealIds.add(row.deal_id);
    }

    const identityIds = new Set<string>();
    for (const row of this.tables.conversation_identities ?? []) {
      if (row.shopper_id !== userId) continue;
      if (typeof row.id === 'string') identityIds.add(row.id);
      row.shopper_id = DELETED_SHOPPER_ID;
      row.shopper_first_name = DELETED_SHOPPER_NAME;
    }
    for (const row of this.tables.shopper_deals ?? []) {
      if (row.consumer_user_id === userId) row.consumer_user_id = null;
    }
    for (const row of this.tables.shopper_dealer_conversations ?? []) {
      if (row.consumer_user_id !== userId) continue;
      row.consumer_user_id = null;
      row.shopper_first_name = null;
      row.opener = ANONYMOUS_OPENER;
    }
    for (const row of this.tables.shopper_outreach_messages ?? []) {
      if (row.consumer_user_id !== userId) continue;
      row.consumer_user_id = null;
      if (typeof row.body === 'string') row.body = scrubShopperText(row.body, names);
    }
    for (const row of this.tables.shopper_offers ?? []) {
      if (row.consumer_user_id === userId) row.consumer_user_id = null;
    }
    for (const row of this.tables.shopper_deal_events ?? []) {
      if (row.consumer_user_id !== userId) continue;
      row.consumer_user_id = null;
      if (typeof row.detail === 'string') row.detail = scrubShopperText(row.detail, names);
    }
    for (const row of this.tables.shopper_deal_lifecycle ?? []) {
      if (row.consumer_user_id === userId) row.consumer_user_id = null;
    }
    for (const row of this.tables.shopper_dealer_messages ?? []) {
      if (!dealIds.has(String(row.deal_id)) || typeof row.body !== 'string') continue;
      if (row.author === 'shopper') row.body = REDACTED_SHOPPER_MESSAGE;
      else if (row.kind === 'opener') row.body = ANONYMOUS_OPENER;
      else row.body = scrubShopperText(row.body, names);
    }
    for (const row of this.tables.dealer_otd_warnings ?? []) {
      if (!dealIds.has(String(row.deal_id)) || typeof row.body !== 'string') continue;
      row.body = scrubShopperText(row.body, names);
    }
    for (const row of this.tables.brain_vendor_events ?? []) {
      const linked = dealIds.has(String(row.deal_id))
        || identityIds.has(String(row.conversation_identity_id));
      if (!linked) continue;
      if (typeof row.transcript === 'string') row.transcript = scrubShopperText(row.transcript, names);
      if (typeof row.summary === 'string') row.summary = scrubShopperText(row.summary, names);
      row.payload = scrubPayload(row.payload, names, userId);
    }
    const flowIds = new Set<string>();
    for (const row of this.tables.app_events ?? []) {
      const payload = row.payload;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
      if ((payload as Row).consumer_user_id !== userId) continue;
      if (typeof row.flow_id === 'string') flowIds.add(row.flow_id);
      row.payload = scrubPayload(payload, names, userId);
    }
    for (const row of this.tables.app_sessions ?? []) {
      if (flowIds.has(String(row.id))) row.search_location = null;
    }
    for (const table of [
      'saved_cars',
      'device_tokens',
      'shopper_market_unlocks',
      'shopper_market_lookup_hits',
      'shopper_market_refund_slots',
      'shopper_market_upstream_attempts',
      'shopper_credits',
      'consumer_profile_status_events',
      'consumer_profiles',
    ]) {
      this.tables[table] = (this.tables[table] ?? []).filter((row) => row.user_id !== userId);
    }
    this.tables.off_network_otd_requests = (this.tables.off_network_otd_requests ?? [])
      .filter((row) => row.consumer_user_id !== userId);
  }
}

function namesFor(tables: Record<string, Row[]>, userId: string): string[] {
  const names = new Set<string>();
  for (const row of tables.consumer_profiles ?? []) {
    if (row.user_id === userId && typeof row.first_name === 'string') names.add(row.first_name);
  }
  for (const row of tables.shopper_dealer_conversations ?? []) {
    if (row.consumer_user_id === userId && typeof row.shopper_first_name === 'string') {
      names.add(row.shopper_first_name);
    }
  }
  for (const row of tables.conversation_identities ?? []) {
    if (row.shopper_id === userId && typeof row.shopper_first_name === 'string') {
      names.add(row.shopper_first_name);
    }
  }
  return [...names];
}

function scrubPayload(payload: unknown, names: string[], userId: string): Row {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const next: Row = {};
  for (const [key, value] of Object.entries(payload as Row)) {
    if (SENSITIVE_KEYS.includes(key) || value === userId) continue;
    next[key] = typeof value === 'string' ? scrubShopperText(value, names) : value;
  }
  return next;
}

function seed(): Record<string, Row[]> {
  return {
    consumer_profiles: [{ user_id: USER, first_name: 'Maya', zip: '62701' }],
    consumer_profile_status_events: [{ id: 'status-1', user_id: USER, status: 'active' }],
    saved_cars: [{ user_id: USER, listing_id: 'listing-1' }],
    device_tokens: [{ user_id: USER, token: 'fcm-token' }],
    shopper_market_unlocks: [{ user_id: USER, listing_id: 'listing-1' }],
    shopper_market_lookup_hits: [{ id: 'hit-1', user_id: USER, ip_hash: 'a'.repeat(64) }],
    shopper_market_refund_slots: [{ user_id: USER, listing_id: 'listing-1' }],
    shopper_market_upstream_attempts: [{ user_id: USER, listing_id: 'listing-1' }],
    off_network_otd_requests: [{ id: 'otd-1', consumer_user_id: USER, listing_id: 'listing-1' }],
    shopper_credits: [{ user_id: USER, balance: 13 }],
    shopper_credit_events: [
      { id: 'credit-starter', user_id: USER, amount: 3, idempotency_key: 'starter_grant', event_type: 'starter_grant' },
      { id: 'credit-pack', user_id: USER, amount: 10, idempotency_key: 'purchase:txn-1', event_type: 'purchase' },
    ],
    shopper_deals: [{ id: 'deal-1', consumer_user_id: USER, listing_id: 'listing-1', status: 'negotiating' }],
    shopper_dealer_conversations: [{
      deal_id: 'deal-1',
      consumer_user_id: USER,
      shopper_first_name: 'Maya',
      opener: 'Maya wants your best itemized out-the-door. ZIP 62701',
    }],
    shopper_dealer_messages: [
      { id: 'msg-shopper', deal_id: 'deal-1', author: 'shopper', body: 'My phone is 555-1212' },
      { id: 'msg-dealer', deal_id: 'deal-1', author: 'salesperson', body: 'Maya, the price is 20000' },
      { id: 'msg-opener', deal_id: 'deal-1', author: 'drevvy', kind: 'opener', body: 'Maya wants your best itemized out-the-door. ZIP 62701' },
    ],
    shopper_outreach_messages: [{
      id: 'out-1',
      consumer_user_id: USER,
      body: 'Maya asked about the car',
      dealer_phone: '+18035550100',
    }],
    shopper_offers: [{ id: 'offer-1', consumer_user_id: USER, vehicle_price: 20000 }],
    shopper_deal_events: [{ id: 'event-1', consumer_user_id: USER, detail: 'Maya opened the deal' }],
    shopper_deal_lifecycle: [{ deal_id: 'deal-1', consumer_user_id: USER, end_state: 'open' }],
    conversation_identities: [{
      id: 'ident-1',
      shopper_id: USER,
      shopper_first_name: 'Maya',
      email_alias: 'maya.ab12@offers.drevvy.com',
    }],
    dealer_otd_warnings: [{
      id: 'warn-1',
      deal_id: 'deal-1',
      body: 'Maya withheld the price. ZIP 62701',
    }],
    brain_vendor_events: [{
      id: 'brain-1',
      deal_id: 'deal-1',
      transcript: 'Maya said hello. ZIP 62701',
      summary: 'Talked with Maya',
      payload: { note: 'Maya called', consumer_user_id: USER, zip: '62701' },
    }, {
      id: 'brain-by-identity',
      deal_id: 'other-deal',
      conversation_identity_id: 'ident-1',
      transcript: 'Maya on the open thread',
      summary: 'Maya called back',
      payload: { note: 'still Maya' },
    }, {
      id: 'brain-other',
      deal_id: 'someone-else',
      transcript: 'Maya stays because this is another shopper',
      summary: 'Leave Maya',
      payload: { note: 'Maya' },
    }],
    app_events: [{
      id: 'app-event-1',
      flow_id: 'flow-1',
      payload: { consumer_user_id: USER, event_source: 'consumer_ios', note: 'Maya looked' },
    }],
    app_sessions: [{ id: 'flow-1', search_location: '62701' }],
    dealer_close_fees: [{ deal_id: 'deal-1', amount_cents: 30000, status: 'due' }],
    email_optouts: [{ id: 'opt-1', email: 'dealer@example.com', reason: 'unsubscribed' }],
    user_dealerships: [],
  };
}

function request(): Request {
  return new Request('https://api.drevvy.com/api/consumer/profile', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${TOKEN}` },
  });
}

function authed() {
  return async () => ({ userId: USER, token: TOKEN });
}

function deps(admin: MemoryAdmin, extra: Record<string, unknown> = {}) {
  return {
    requireAuth: authed(),
    admin: admin as unknown as DeletionAdmin,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' } as NodeJS.ProcessEnv,
    nowMs: 1_700_000_000_000,
    ...extra,
  };
}

test('name scrubbing is case-insensitive and keeps short names inside longer words', () => {
  assert.equal(stripShopperNames('Maya asked Maya', ['Maya']), 'A shopper asked A shopper');
  assert.equal(stripShopperNames('maya asked MAYA', ['Maya']), 'A shopper asked A shopper');
  assert.equal(stripShopperNames('Bo asked', ['Bo']), 'A shopper asked');
  assert.equal(stripShopperNames('Boston asked Bo.', ['Bo']), 'Boston asked A shopper.');
  assert.equal(stripShopperNames('Ann and Annie', ['Ann']), 'A shopper and Annie');
  assert.equal(stripShopperZip('A shopper wants your best itemized out-the-door. ZIP 62701'), 'A shopper wants your best itemized out-the-door');
  assert.equal(stripShopperZip('Noted. zip 62701-1234 today'), 'Noted today');
  assert.equal(scrubShopperText('Bo withheld the price. ZIP 62701', ['bo']), 'A shopper withheld the price');
  assert.equal(isMissingRelation({ code: '42P01', message: 'relation does not exist' }), true);
  assert.equal(isMissingRelation({ code: '42703', message: 'column "zip" does not exist' }), false);
  assert.equal(isMissingRelation({ code: 'PGRST205', message: 'Could not find the table in the schema cache' }), false);
  assert.equal(isDeletionSchemaPending({ code: '42703', message: 'column "zip" does not exist' }), true);
  assert.equal(isDeletionSchemaPending({ code: '42P01', message: 'relation does not exist' }), true);
  assert.equal(isDeletionSchemaPending({ code: '23502', message: 'null value' }), true);
  assert.equal(isDeletionSchemaPending({ code: 'P0001', message: 'conversation identity is locked' }), true);
  assert.equal(isDeletionSchemaPending({ code: 'P0001', message: 'dealer_account' }), false);
  assert.equal(isDeletionSchemaPending({ code: '42501', message: 'permission denied' }), false);
  const windows = accountDeletionWindows(USER);
  assert.equal(windows.length, 2);
  assert.equal(windows[0].limit, ACCOUNT_DELETION_PER_HOUR);
  for (const window of windows) {
    assert.equal(window.bucket.length >= 8 && window.bucket.length <= 180, true);
    assert.equal(window.bucket.includes(USER), false);
  }
});

test('delete account calls one rpc, then sign-out, then the auth user', async () => {
  const fetches: string[] = [];
  const admin = new MemoryAdmin(seed());
  const response = await handleConsumerProfileDelete(request(), deps(admin, {
    fetchImpl: async () => {
      fetches.push('called');
      return new Response(null, { status: 500 });
    },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.equal(fetches.length, 0);

  const rows = admin.tables;
  assert.deepEqual(rows.saved_cars, []);
  assert.deepEqual(rows.device_tokens, []);
  assert.deepEqual(rows.shopper_market_unlocks, []);
  assert.deepEqual(rows.shopper_market_lookup_hits, []);
  assert.deepEqual(rows.shopper_market_refund_slots, []);
  assert.deepEqual(rows.shopper_market_upstream_attempts, []);
  assert.deepEqual(rows.off_network_otd_requests, []);
  assert.deepEqual(rows.shopper_credits, []);
  assert.deepEqual(rows.consumer_profiles, []);
  assert.deepEqual(rows.consumer_profile_status_events, []);

  assert.equal(rows.shopper_deals[0].consumer_user_id, null);
  assert.equal(rows.shopper_deals[0].listing_id, 'listing-1');
  assert.equal(rows.shopper_dealer_conversations[0].consumer_user_id, null);
  assert.equal(rows.shopper_dealer_conversations[0].shopper_first_name, null);
  assert.equal(rows.shopper_dealer_conversations[0].opener, ANONYMOUS_OPENER);
  assert.equal(String(rows.shopper_dealer_conversations[0].opener).includes('62701'), false);
  assert.equal(rows.shopper_dealer_messages[0].body, REDACTED_SHOPPER_MESSAGE);
  assert.equal(rows.shopper_dealer_messages[1].body, 'A shopper, the price is 20000');
  assert.equal(rows.shopper_dealer_messages[2].body, ANONYMOUS_OPENER);
  assert.equal(rows.shopper_outreach_messages[0].consumer_user_id, null);
  assert.equal(rows.shopper_outreach_messages[0].body, 'A shopper asked about the car');
  assert.equal(rows.shopper_outreach_messages[0].dealer_phone, '+18035550100');
  assert.equal(rows.shopper_offers[0].consumer_user_id, null);
  assert.equal(rows.shopper_offers[0].vehicle_price, 20000);
  assert.equal(rows.shopper_deal_events[0].consumer_user_id, null);
  assert.equal(rows.shopper_deal_events[0].detail, 'A shopper opened the deal');
  assert.equal(rows.shopper_deal_lifecycle[0].consumer_user_id, null);
  assert.equal(rows.dealer_otd_warnings[0].body, 'A shopper withheld the price');
  assert.equal(rows.brain_vendor_events[0].transcript, 'A shopper said hello');
  assert.equal(rows.brain_vendor_events[0].summary, 'Talked with A shopper');
  assert.deepEqual(rows.brain_vendor_events[0].payload, { note: 'A shopper called' });
  assert.equal(rows.brain_vendor_events[1].transcript, 'A shopper on the open thread');
  assert.equal(rows.brain_vendor_events[1].summary, 'A shopper called back');
  assert.equal(rows.brain_vendor_events[2].transcript, 'Maya stays because this is another shopper');
  assert.equal(rows.brain_vendor_events[2].summary, 'Leave Maya');
  assert.equal(rows.shopper_credit_events[0].user_id, USER);
  assert.equal(rows.shopper_credit_events[1].user_id, USER);
  assert.equal(starterGrantBlocksReplay(ledger(rows), USER), true);
  assert.equal(purchaseBlocksReplay(ledger(rows), USER, 'txn-1'), true);
  assert.equal(rows.conversation_identities[0].shopper_id, DELETED_SHOPPER_ID);
  assert.equal(rows.conversation_identities[0].shopper_first_name, DELETED_SHOPPER_NAME);
  assert.equal(rows.conversation_identities[0].email_alias, 'maya.ab12@offers.drevvy.com');
  assert.deepEqual(rows.app_events[0].payload, { event_source: 'consumer_ios', note: 'A shopper looked' });
  assert.equal(rows.app_sessions[0].search_location, null);
  assert.equal(rows.dealer_close_fees[0].amount_cents, 30000);
  assert.equal(rows.email_optouts[0].email, 'dealer@example.com');

  assert.deepEqual(admin.log, [`rpc:${DELETE_CONSUMER_ACCOUNT_RPC}`, 'signOut', 'deleteUser']);
  assert.deepEqual(admin.deletedUsers, [USER]);

  admin.deleteUserError = { message: 'User not found', code: 'user_not_found', status: 404 };
  const again = await deleteConsumerAccount({
    userId: USER,
    accessToken: TOKEN,
    admin: admin as unknown as DeletionAdmin,
    env: { NODE_ENV: 'test' },
  });
  assert.deepEqual(again, { deleted: true });
  assert.equal(starterGrantBlocksReplay(ledger(rows), USER), true);
  assert.equal(purchaseBlocksReplay(ledger(rows), USER, 'txn-1'), true);
});

test('a failed deleteUser leaves starter and purchase keys attached so a retry cannot grant them again', async () => {
  const fetches: string[] = [];
  const admin = new MemoryAdmin(seed());
  admin.deleteUserError = { message: 'auth upstream failed', code: 'unexpected', status: 500 };
  const response = await handleConsumerProfileDelete(request(), deps(admin, {
    env: { NODE_ENV: 'test', REVENUECAT_SECRET_API_KEY: 'rc-secret-do-not-log' },
    fetchImpl: async (url: string | URL | Request) => {
      fetches.push(String(url));
      return new Response(null, { status: 200 });
    },
  }));
  assert.equal(response.status, 500);
  const body = await response.json() as { deleted: boolean; error: { code: string } };
  assert.equal(body.deleted, false);
  assert.equal(body.error.code, 'account_deletion_failed');
  assert.equal(fetches.length, 0);
  assert.equal(admin.deletedUsers.length, 0);
  const events = ledger(admin.tables);
  assert.equal(starterGrantBlocksReplay(events, USER), true);
  assert.equal(purchaseBlocksReplay(events, USER, 'txn-1'), true);
  assert.equal(starterGrantBlocksReplay(events.map((event) => ({ ...event, user_id: null })), USER), false);

  admin.deleteUserError = null;
  const retry = await handleConsumerProfileDelete(request(), deps(admin, {
    fetchImpl: async () => {
      fetches.push('retry');
      return new Response(null, { status: 200 });
    },
  }));
  assert.equal(retry.status, 200);
  assert.equal(starterGrantBlocksReplay(ledger(admin.tables), USER), true);
  assert.equal(purchaseBlocksReplay(ledger(admin.tables), USER, 'txn-1'), true);
  assert.equal(admin.tables.shopper_credit_events[0].user_id, USER);
  assert.equal(admin.tables.shopper_credit_events[1].user_id, USER);
});

test('a dealer membership blocks deletion before any shopper row is removed', async () => {
  const tables = seed();
  tables.user_dealerships = [{ user_id: USER, dealership_id: 'roof-1' }];
  const admin = new MemoryAdmin(tables);
  const response = await handleConsumerProfileDelete(request(), deps(admin));
  assert.equal(response.status, 409);
  const body = await response.json() as { deleted: boolean; error: { code: string } };
  assert.equal(body.deleted, false);
  assert.equal(body.error.code, 'dealer_account');
  assert.equal(tables.saved_cars.length, 1);
  assert.equal(tables.shopper_credit_events[0].user_id, USER);
  assert.equal(admin.log.includes('signOut'), false);
  assert.equal(admin.log.includes('deleteUser'), false);
});

test('schema that still rejects a null shopper id does not delete the auth user', async () => {
  const tables = seed();
  const admin = new MemoryAdmin(tables);
  admin.blockNullUserId = true;
  const response = await handleConsumerProfileDelete(request(), deps(admin));
  assert.equal(response.status, 500);
  const body = await response.json() as { deleted: boolean; error: { code: string } };
  assert.equal(body.deleted, false);
  assert.equal(body.error.code, 'deletion_schema_pending');
  assert.equal(tables.saved_cars.length, 1);
  assert.equal(tables.shopper_deals[0].consumer_user_id, USER);
  assert.equal(tables.consumer_profiles.length, 1);
  assert.equal(admin.log.includes('deleteUser'), false);
  assert.equal(admin.log.includes('signOut'), false);
});

test('a locked conversation identity rolls the deletion back', async () => {
  const tables = seed();
  const admin = new MemoryAdmin(tables);
  admin.identityLocked = true;
  const response = await handleConsumerProfileDelete(request(), deps(admin));
  assert.equal(response.status, 500);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, 'deletion_schema_pending');
  assert.equal(tables.conversation_identities[0].shopper_first_name, 'Maya');
  assert.equal(tables.saved_cars.length, 1);
  assert.equal(admin.deletedUsers.length, 0);
});

test('a missing relation or a missing column does not delete the auth user', async () => {
  const missingTable = new MemoryAdmin(seed());
  missingTable.missingRelation = true;
  const relation = await handleConsumerProfileDelete(request(), deps(missingTable));
  assert.equal(relation.status, 500);
  const relationBody = await relation.json() as { error: { code: string } };
  assert.equal(relationBody.error.code, 'deletion_schema_pending');
  assert.equal(missingTable.tables.saved_cars.length, 1);
  assert.equal(missingTable.deletedUsers.length, 0);

  const missingColumn = new MemoryAdmin(seed());
  missingColumn.missingColumn = true;
  missingColumn.signOutError = { message: 'session missing', code: 'session_not_found' };
  const column = await handleConsumerProfileDelete(request(), deps(missingColumn));
  assert.equal(column.status, 500);
  assert.equal(missingColumn.deletedUsers.length, 0);
  assert.equal(missingColumn.log.includes('signOut'), false);
});

test('a failed sign-out still deletes the auth user after the rpc commits', async () => {
  const admin = new MemoryAdmin(seed());
  admin.signOutError = { message: 'session missing', code: 'session_not_found' };
  const response = await handleConsumerProfileDelete(request(), deps(admin));
  assert.equal(response.status, 200);
  assert.deepEqual(admin.deletedUsers, [USER]);
  assert.equal(starterGrantBlocksReplay(ledger(admin.tables), USER), true);
});

test('deletion is rate limited before any write', async () => {
  const admin = new MemoryAdmin(seed());
  const store = new MemoryRateLimitStore();
  const shared = deps(admin, { store });
  for (let attempt = 0; attempt < ACCOUNT_DELETION_PER_HOUR; attempt += 1) {
    const response = await handleConsumerProfileDelete(request(), shared);
    assert.equal(response.status, 200);
  }
  const before = admin.log.length;
  const blocked = await handleConsumerProfileDelete(request(), shared);
  assert.equal(blocked.status, 429);
  const body = await blocked.json() as { deleted: boolean; error: { code: string } };
  assert.equal(body.deleted, false);
  assert.equal(body.error.code, 'rate_limited');
  assert.equal(admin.log.length, before);
});

test('a missing shopper token is a 401 and does not touch the admin client', async () => {
  const admin = new MemoryAdmin(seed());
  const response = await handleConsumerProfileDelete(request(), {
    requireAuth: async () => {
      throw new ConsumerAuthError('Sign in is required.', 401, 'unauthorized');
    },
    admin: admin as unknown as DeletionAdmin,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' },
  });
  assert.equal(response.status, 401);
  const body = await response.json() as { deleted: boolean; error: { code: string } };
  assert.equal(body.deleted, false);
  assert.equal(body.error.code, 'unauthorized');
  assert.deepEqual(admin.log, []);
});

test('RevenueCat is deleted with the server secret and PostHog stays a manual step', async () => {
  const calls: { url: string; method: string; authorization: string }[] = [];
  const logs: string[] = [];
  const original = console.error;
  console.error = (line?: unknown) => {
    logs.push(String(line));
  };
  try {
    const unconfigured = await deleteExternalShopperRecords({
      userId: USER,
      env: { NODE_ENV: 'test' },
      fetchImpl: async () => {
        throw new Error('fetch should not run');
      },
    });
    assert.deepEqual(unconfigured, { revenuecat: 'unconfigured', posthog: 'manual' });
    assert.equal(logs.some((line) => line.includes('rc-secret') || line.includes('phx_')), false);

    const done = await deleteExternalShopperRecords({
      userId: USER,
      env: {
        NODE_ENV: 'test',
        REVENUECAT_SECRET_API_KEY: 'rc-secret-do-not-log',
        POSTHOG_PERSONAL_API_KEY: 'phx_do-not-log',
        POSTHOG_PROJECT_ID: '123',
      },
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url: String(url),
          method: init?.method ?? 'GET',
          authorization: headers.get('authorization') ?? '',
        });
        return new Response(null, { status: url.toString().includes('revenuecat') ? 404 : 200 });
      },
    });
    assert.deepEqual(done, { revenuecat: 'deleted', posthog: 'deleted' });
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(calls[0].url, `https://api.revenuecat.com/v1/subscribers/${USER}`);
    assert.equal(calls[0].authorization, 'Bearer rc-secret-do-not-log');
    assert.equal(calls[1].method, 'POST');
    assert.match(calls[1].url, /\/api\/projects\/123\/persons\/bulk_delete\/$/);
    assert.equal(logs.some((line) => line.includes('rc-secret-do-not-log') || line.includes('phx_do-not-log')), false);
  } finally {
    console.error = original;
  }
});

test('the profile route delegates DELETE and the schema change stays out of migrations', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/profile/route.ts'), 'utf8');
  assert.match(route, /export async function DELETE/);
  assert.match(route, /handleConsumerProfileDelete/);
  assert.match(route, /requireConsumerAuth/);
  assert.equal(route.toLowerCase().includes('password'), false);

  const source = readFileSync(join(HERE, 'account-deletion.ts'), 'utf8');
  assert.match(source, /rpc\(DELETE_CONSUMER_ACCOUNT_RPC/);
  assert.equal(source.includes('.from('), false);
  assert.equal(/\.update\(\{/.test(source), false);
  assert.equal(/\.delete\(\)/.test(source), false);
  assert.match(source, /residual identifier/i);

  const held = readFileSync(join(REPO, 'supabase/held/consumer_account_deletion.sql'), 'utf8');
  assert.match(held, /DW approval/);
  assert.match(held, /on delete set null/i);
  assert.match(held, /shopper deal identity is immutable/);
  assert.match(held, /conversation identity is locked/);
  assert.match(held, /create or replace function public\.delete_consumer_account\(p_user_id uuid\)/);
  assert.match(held, /security definer/);
  assert.match(held, /revoke all on function public\.delete_consumer_account\(uuid\) from public, anon, authenticated/);
  assert.match(held, /grant execute on function public\.delete_consumer_account\(uuid\) to service_role/);
  assert.match(held, /residual identifier/i);
  assert.match(held, /dealer_otd_warnings/);
  assert.match(held, /brain_vendor_events/);
  assert.match(held, /\\\. ZIP \[0-9\]\{5\}/);
  const guardStart = held.indexOf('function private.guard_conversation_identity');
  const guardEnd = held.indexOf('revoke all on function private.guard_conversation_identity');
  const guard = held.slice(guardStart, guardEnd);
  assert.match(guard, /set search_path = ''/);
  assert.equal(guard.includes('set search_path = public'), false);
  const fnStart = held.indexOf('function public.delete_consumer_account');
  const fn = held.slice(fnStart);
  assert.equal(/update\s+public\.shopper_credit_events/i.test(fn), false);
  assert.equal(/delete\s+from\s+public\.shopper_credit_events/i.test(fn), false);
  const migrations = readdirSync(join(REPO, 'supabase/migrations'));
  assert.equal(migrations.some((name) => name.includes('account_deletion')), false);
  assert.equal(existsSync(join(REPO, 'supabase/migrations/consumer_account_deletion.sql')), false);

  const legal = readFileSync(join(HERE, '../legal-constants.ts'), 'utf8');
  const privacy = readFileSync(join(HERE, '../../app/(public)/privacy/page.tsx'), 'utf8');
  const deletionPage = readFileSync(join(HERE, '../../app/(public)/delete-account/page.tsx'), 'utf8');
  assert.match(legal, /TODO\(DW and counsel\)/);
  assert.match(legal, /export const LEGAL_DRAFT_DO_NOT_SHIP = '\[BUSINESS ADDRESS\]'/);
  assert.match(legal, /BUSINESS_ADDRESS: LEGAL_DRAFT_DO_NOT_SHIP/);
  assert.equal(privacy.includes('within 30 days'), false);
  for (const name of [
    'DRAFT_PRIVACY_POSTHOG',
    'DRAFT_PRIVACY_SUPERWALL',
    'DRAFT_PRIVACY_FIREBASE',
    'DRAFT_PRIVACY_RETENTION',
    'DRAFT_DELETE_ACCOUNT_IN_APP',
    'DRAFT_DELETE_ACCOUNT_DELETED',
    'DRAFT_DELETE_ACCOUNT_KEPT',
  ]) {
    assert.match(privacy, new RegExp(name));
  }
  assert.match(deletionPage, /DRAFT_DELETE_ACCOUNT_IN_APP/);
  assert.match(deletionPage, /LEGAL\.PRIVACY_EMAIL/);
  assert.equal(deletionPage.toLowerCase().includes('password'), false);
  assert.equal(deletionPage.includes('<form'), false);
  assert.equal(deletionPage.includes('<input'), false);
});

function ledger(tables: Record<string, Row[]>): { user_id: string | null; idempotency_key: string }[] {
  return (tables.shopper_credit_events ?? []).map((row) => ({
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    idempotency_key: String(row.idempotency_key),
  }));
}
