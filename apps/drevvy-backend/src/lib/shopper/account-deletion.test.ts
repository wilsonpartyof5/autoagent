import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ConsumerAuthError } from '@/lib/consumer/auth';
import { MemoryRateLimitStore } from '@/lib/public-discover/rate-limit';

import {
  ACCOUNT_DELETION_PER_HOUR,
  ANONYMOUS_OPENER,
  DELETED_SHOPPER_ID,
  DELETED_SHOPPER_NAME,
  REDACTED_SHOPPER_MESSAGE,
  accountDeletionWindows,
  deleteConsumerAccount,
  handleConsumerProfileDelete,
  isDeletionSchemaPending,
  stripShopperNames,
  type DeletionAdmin,
  type DeletionFilter,
} from './account-deletion';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../../../../');
const USER = 'shopper-1';
const TOKEN = 'token-1';

type Row = Record<string, unknown>;

class MemoryAdmin {
  readonly log: string[] = [];
  readonly tables: Record<string, Row[]>;
  readonly missing = new Set<string>();
  blockNullUserId = false;
  identityLocked = false;
  signOutError: { message: string; code?: string } | null = null;
  deleteUserError: { message: string; code?: string; status?: number } | null = null;
  deletedUsers: string[] = [];

  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }

  from(table: string): DeletionFilter {
    return new MemoryQuery(this, table);
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
        this.deletedUsers.push(id);
        return { error: this.deleteUserError };
      },
    },
  };
}

class MemoryQuery implements DeletionFilter {
  private filters: Array<(row: Row) => boolean> = [];
  private operation: 'select' | 'update' | 'delete' = 'select';
  private patch: Row | null = null;
  private rangeFrom = 0;
  private rangeTo = Number.MAX_SAFE_INTEGER;
  private pending: Promise<{ data: Row[] | null; error: { message: string; code?: string } | null }> | null = null;

  constructor(
    private readonly admin: MemoryAdmin,
    private readonly table: string,
  ) {}

  select(): this {
    this.operation = 'select';
    return this;
  }

  eq(column: string, value: string): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  contains(column: string, value: Record<string, unknown>): this {
    this.filters.push((row) => {
      const cell = row[column];
      if (!cell || typeof cell !== 'object' || Array.isArray(cell)) return false;
      return Object.entries(value).every(([key, expected]) => (cell as Row)[key] === expected);
    });
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.operation = 'update';
    this.patch = values;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  then<TResult1 = { data: Row[] | null; error: { message: string; code?: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: { message: string; code?: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    this.pending ??= Promise.resolve(this.exec());
    return this.pending.then(onfulfilled, onrejected);
  }

  private exec(): { data: Row[] | null; error: { message: string; code?: string } | null } {
    this.admin.log.push(`${this.operation}:${this.table}`);
    if (this.admin.missing.has(this.table)) {
      return {
        data: null,
        error: { code: 'PGRST205', message: `Could not find the table '${this.table}' in the schema cache` },
      };
    }
    const table = this.admin.tables[this.table] ?? (this.admin.tables[this.table] = []);
    const matched = table.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.operation === 'select') {
      return { data: matched.slice(this.rangeFrom, this.rangeTo + 1), error: null };
    }
    if (this.blocked(matched)) {
      const locked = this.table === 'conversation_identities' && this.admin.identityLocked;
      return {
        data: null,
        error: locked
          ? { code: 'P0001', message: 'conversation identity is locked' }
          : { code: '23502', message: 'null value in column "consumer_user_id" violates not-null constraint' },
      };
    }
    if (this.operation === 'delete') {
      this.admin.tables[this.table] = table.filter((row) => !matched.includes(row));
      return { data: null, error: null };
    }
    for (const row of matched) Object.assign(row, this.patch);
    return { data: null, error: null };
  }

  private blocked(matched: Row[]): boolean {
    if (matched.length === 0 || !this.patch) return false;
    if (this.table === 'conversation_identities' && this.admin.identityLocked) {
      return 'shopper_id' in this.patch || 'shopper_first_name' in this.patch;
    }
    if (!this.admin.blockNullUserId) return false;
    return Object.entries(this.patch).some(([key, value]) => (
      value === null && (key === 'user_id' || key === 'consumer_user_id')
    ));
  }
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
    shopper_credits: [{ user_id: USER, balance: 3 }],
    shopper_credit_events: [{ id: 'credit-1', user_id: USER, amount: 3, idempotency_key: 'starter_grant' }],
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
    app_events: [{
      id: 'app-event-1',
      flow_id: 'flow-1',
      payload: { consumer_user_id: USER, event_source: 'consumer_ios' },
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

test('name scrubbing replaces the shopper first name and leaves short tokens', () => {
  assert.equal(stripShopperNames('Maya asked Maya', ['Maya']), 'A shopper asked A shopper');
  assert.equal(stripShopperNames('Bo asked', ['Bo']), 'Bo asked');
  assert.equal(isDeletionSchemaPending({ code: '23502', message: 'null value' }), true);
  assert.equal(isDeletionSchemaPending({ code: 'P0001', message: 'conversation identity is locked' }), true);
  assert.equal(isDeletionSchemaPending({ code: '42501', message: 'permission denied' }), false);
  const windows = accountDeletionWindows(USER);
  assert.equal(windows.length, 2);
  assert.equal(windows[0].limit, ACCOUNT_DELETION_PER_HOUR);
  for (const window of windows) {
    assert.equal(window.bucket.length >= 8 && window.bucket.length <= 180, true);
    assert.equal(window.bucket.includes(USER), false);
  }
});

test('delete account anonymizes dealer and billing rows, deletes shopper rows, then the auth user', async () => {
  const admin = new MemoryAdmin(seed());
  const response = await handleConsumerProfileDelete(request(), {
    requireAuth: authed(),
    admin: admin as unknown as DeletionAdmin,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' },
    nowMs: 1_700_000_000_000,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });

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
  assert.equal(rows.shopper_dealer_messages[0].body, REDACTED_SHOPPER_MESSAGE);
  assert.equal(rows.shopper_dealer_messages[1].body, 'A shopper, the price is 20000');
  assert.equal(rows.shopper_outreach_messages[0].consumer_user_id, null);
  assert.equal(rows.shopper_outreach_messages[0].body, 'A shopper asked about the car');
  assert.equal(rows.shopper_outreach_messages[0].dealer_phone, '+18035550100');
  assert.equal(rows.shopper_offers[0].consumer_user_id, null);
  assert.equal(rows.shopper_offers[0].vehicle_price, 20000);
  assert.equal(rows.shopper_deal_events[0].consumer_user_id, null);
  assert.equal(rows.shopper_deal_events[0].detail, 'A shopper opened the deal');
  assert.equal(rows.shopper_deal_lifecycle[0].consumer_user_id, null);
  assert.equal(rows.shopper_deal_lifecycle[0].end_state, 'open');
  assert.equal(rows.shopper_credit_events[0].user_id, null);
  assert.equal(rows.shopper_credit_events[0].idempotency_key, 'starter_grant');
  assert.equal(rows.conversation_identities[0].shopper_id, DELETED_SHOPPER_ID);
  assert.equal(rows.conversation_identities[0].shopper_first_name, DELETED_SHOPPER_NAME);
  assert.equal(rows.conversation_identities[0].email_alias, 'maya.ab12@offers.drevvy.com');
  assert.deepEqual(rows.app_events[0].payload, { event_source: 'consumer_ios' });
  assert.equal(rows.app_sessions[0].search_location, null);
  assert.equal(rows.dealer_close_fees[0].amount_cents, 30000);
  assert.equal(rows.email_optouts[0].email, 'dealer@example.com');

  const signOutAt = admin.log.lastIndexOf('signOut');
  const deleteAt = admin.log.lastIndexOf('deleteUser');
  assert.equal(deleteAt, admin.log.length - 1);
  assert.equal(signOutAt, deleteAt - 1);
  assert.deepEqual(admin.deletedUsers, [USER]);

  admin.deleteUserError = { message: 'User not found', code: 'user_not_found', status: 404 };
  const again = await deleteConsumerAccount({ userId: USER, accessToken: TOKEN, admin: admin as unknown as DeletionAdmin });
  assert.deepEqual(again, { deleted: true });
  assert.deepEqual(admin.deletedUsers, [USER, USER]);
});

test('a dealer membership blocks deletion before any shopper row is removed', async () => {
  const tables = seed();
  tables.user_dealerships = [{ user_id: USER, dealership_id: 'roof-1' }];
  const admin = new MemoryAdmin(tables);
  const response = await handleConsumerProfileDelete(request(), {
    requireAuth: authed(),
    admin: admin as unknown as DeletionAdmin,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' },
    nowMs: 1_700_000_000_000,
  });
  assert.equal(response.status, 409);
  const body = await response.json() as { deleted: boolean; error: { code: string } };
  assert.equal(body.deleted, false);
  assert.equal(body.error.code, 'dealer_account');
  assert.equal(tables.saved_cars.length, 1);
  assert.equal(admin.log.includes('signOut'), false);
  assert.equal(admin.log.includes('deleteUser'), false);
});

test('schema that still rejects a null shopper id does not delete the auth user', async () => {
  const tables = seed();
  const admin = new MemoryAdmin(tables);
  admin.blockNullUserId = true;
  const response = await handleConsumerProfileDelete(request(), {
    requireAuth: authed(),
    admin: admin as unknown as DeletionAdmin,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' },
    nowMs: 1_700_000_000_000,
  });
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

test('a locked conversation identity stops deletion before shopper rows are removed', async () => {
  const tables = seed();
  const admin = new MemoryAdmin(tables);
  admin.identityLocked = true;
  const response = await handleConsumerProfileDelete(request(), {
    requireAuth: authed(),
    admin: admin as unknown as DeletionAdmin,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' },
    nowMs: 1_700_000_000_000,
  });
  assert.equal(response.status, 500);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, 'deletion_schema_pending');
  assert.equal(tables.conversation_identities[0].shopper_first_name, 'Maya');
  assert.equal(tables.saved_cars.length, 1);
  assert.equal(admin.deletedUsers.length, 0);
});

test('a missing saved-cars table and a failed sign-out still finish deletion', async () => {
  const admin = new MemoryAdmin(seed());
  admin.missing.add('saved_cars');
  admin.signOutError = { message: 'session missing', code: 'session_not_found' };
  const response = await handleConsumerProfileDelete(request(), {
    requireAuth: authed(),
    admin: admin as unknown as DeletionAdmin,
    store: new MemoryRateLimitStore(),
    env: { NODE_ENV: 'test' },
    nowMs: 1_700_000_000_000,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(admin.deletedUsers, [USER]);
  assert.equal(admin.tables.device_tokens.length, 0);
});

test('deletion is rate limited before any write', async () => {
  const admin = new MemoryAdmin(seed());
  const store = new MemoryRateLimitStore();
  const deps = {
    requireAuth: authed(),
    admin: admin as unknown as DeletionAdmin,
    store,
    env: { NODE_ENV: 'test' } as NodeJS.ProcessEnv,
    nowMs: 1_700_000_000_000,
  };
  for (let attempt = 0; attempt < ACCOUNT_DELETION_PER_HOUR; attempt += 1) {
    const response = await handleConsumerProfileDelete(request(), deps);
    assert.equal(response.status, 200);
  }
  const before = admin.log.length;
  const blocked = await handleConsumerProfileDelete(request(), deps);
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

test('the profile route delegates DELETE and the schema change stays out of migrations', () => {
  const route = readFileSync(join(HERE, '../../app/api/consumer/profile/route.ts'), 'utf8');
  assert.match(route, /export async function DELETE/);
  assert.match(route, /handleConsumerProfileDelete/);
  assert.match(route, /requireConsumerAuth/);
  assert.equal(route.toLowerCase().includes('password'), false);

  const held = readFileSync(join(REPO, 'supabase/held/consumer_account_deletion.sql'), 'utf8');
  assert.match(held, /DW approval/);
  assert.match(held, /on delete set null/i);
  assert.match(held, /shopper deal identity is immutable/);
  assert.match(held, /conversation identity is locked/);
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
