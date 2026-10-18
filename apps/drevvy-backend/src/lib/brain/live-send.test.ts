import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { placeTexmlAiCall, sendOutboundEmail, sendOutboundSms, type CommunicationsStore } from './communications';
import { purchaseFlagVisible } from './identity';
import { readLivePurchaseFlag } from './identity-store';
import type { BrainVendorEvent } from './repository';

const HERE = dirname(fileURLToPath(import.meta.url));
const DAY = 24 * 60 * 60 * 1000;

test('the purchase flag is the low pool or a held live send', () => {
  assert.equal(purchaseFlagVisible({ low: true }, false), true);
  assert.equal(purchaseFlagVisible({ low: false }, true), true);
  assert.equal(purchaseFlagVisible({ low: false }, false), false);
  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261019120000_identity_purchase_flag.sql'), 'utf8');
  assert.match(sql, /purchase_needed boolean not null default false/);
  const page = readFileSync(join(HERE, '../../components/admin/conversation-identities.tsx'), 'utf8');
  assert.match(page, /admin\.purchaseFlag/);
  assert.match(page, /Purchase another Telnyx number/);
  assert.match(page, /row\.aliasDomain/);
});

test('the first live email and text keep one alias and one number', async () => {
  const db = memoryDb({
    deals: [deal('deal-1', 'shopper-1', 'SC')],
    profiles: [{ user_id: 'shopper-1', first_name: 'Maya' }],
    pool: [number('+18035550101', false)],
    voices: [{ state_code: 'SC', phone_e164: '+18035551000' }],
    settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 2, purchase_needed: false },
  });
  let draws = 0;
  const random = () => {
    draws += 1;
    if (draws > 8) throw new Error('a later send tried to assign a new alias');
    return 0.2;
  };
  const sent: Record<string, unknown>[] = [];
  const fetchImpl = capture(sent);
  const link = { dealId: 'deal-1', dealerId: 'dealer-a', touchpointId: 'D0-E1' };
  const assignment = { supabase: db.client, random };

  const email = await sendOutboundEmail(store(), {
    from: 'deals@drevvy.example',
    to: 'desk@dealer.example',
    subject: 'Price',
    text: 'What is the price?',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl,
    link,
    assignment,
  });
  assert.equal('messageId' in email, true);
  const alias = String(sent[0]?.reply_to);
  assert.match(alias, /^maya\.[a-z0-9]{4,6}@(offers|deals|quotes|buyers)\.drevvy\.com$/);
  assert.equal(String(sent[0]?.from), `"Maya" <${alias}>`);
  assert.equal(alias.includes('deal-1'), false);

  const sms = await sendOutboundSms(store(), {
    from: '+19995550100',
    to: '+18035550999',
    text: 'Please text this number.',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl,
    link: { ...link, touchpointId: 'D0-T1' },
    assignment,
  });
  assert.equal('messageId' in sms, true);
  assert.equal(sent[1]?.from, '+18035550101');
  assert.equal(db.rows('conversation_identities').length, 1);
  assert.equal(db.rows('conversation_identities')[0]?.email_alias, alias);
  assert.equal(db.rows('conversation_identities')[0]?.alias_domain, alias.split('@')[1]);
  assert.equal(db.rows('conversation_identities')[0]?.sms_number_e164, '+18035550101');
  assert.equal(db.rows('conversation_identities')[0]?.voice_number_e164, '+18035551000');
});

test('one dealer never has the same text number live twice', async () => {
  const db = memoryDb({
    deals: [deal('deal-1', 'shopper-1', 'SC'), deal('deal-2', 'shopper-2', 'SC'), deal('deal-3', 'shopper-3', 'SC')],
    profiles: [
      { user_id: 'shopper-1', first_name: 'Maya' },
      { user_id: 'shopper-2', first_name: 'Luis' },
      { user_id: 'shopper-3', first_name: 'Ana' },
    ],
    pool: [number('+18035550101', false), number('+18035550102', false, '2026-10-01T00:00:00.000Z')],
    settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 5, purchase_needed: false },
  });
  const sent: Record<string, unknown>[] = [];
  const first = await sendSms(db, 'deal-1', 'dealer-a', sent);
  const second = await sendSms(db, 'deal-2', 'dealer-a', sent);
  assert.equal('messageId' in first && 'messageId' in second, true);
  assert.notEqual(sent[0]?.from, sent[1]?.from);
  const live = db.rows('conversation_identities').filter((row) => row.ended_at == null && row.dealer_id === 'dealer-a');
  assert.equal(new Set(live.map((row) => row.sms_number_e164)).size, live.length);
  assert.equal(new Set(live.map((row) => row.alias_domain)).size, 1);

  const third = await sendSms(db, 'deal-3', 'dealer-a', sent);
  assert.equal('held' in third && third.held, true);
  assert.equal('purchaseFlag' in third && third.purchaseFlag, true);
  assert.equal(sent.length, 2);
  assert.equal(db.rows('conversation_identities').length, 2);
  assert.equal(db.rows('identity_settings')[0]?.purchase_needed, true);
  assert.equal(await readLivePurchaseFlag(db.client), true);

  const elsewhere = await sendSms(db, 'deal-1', 'dealer-b', sent);
  assert.equal('messageId' in elsewhere, true);
  const shared = sent.at(-1)?.from;
  assert.equal(shared === sent[0]?.from || shared === sent[1]?.from, true);
  const stillLiveAtA = db.rows('conversation_identities').some((row) => (
    row.dealer_id === 'dealer-a' && row.ended_at == null && row.sms_number_e164 === shared
  ));
  assert.equal(stillLiveAtA, true);
});

test('cooldown with nothing free holds the send and raises the purchase flag', async () => {
  const db = memoryDb({
    deals: [deal('deal-old', 'shopper-a', 'SC'), deal('deal-new', 'shopper-b', 'SC')],
    profiles: [
      { user_id: 'shopper-a', first_name: 'Maya' },
      { user_id: 'shopper-b', first_name: 'Luis' },
    ],
    pool: [number('+18035550101', false)],
    identities: [{
      id: 'conv-old',
      deal_id: 'deal-old',
      dealer_id: 'dealer-a',
      shopper_id: 'shopper-a',
      shopper_first_name: 'Maya',
      email_alias: 'maya.abcd@offers.drevvy.com',
      sms_number_e164: '+18035550101',
      voice_number_e164: '+18035551000',
      locked_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_test: false,
      ended_at: new Date(Date.now() - 10 * DAY).toISOString(),
    }],
    settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 0, purchase_needed: false },
  });
  const sent: Record<string, unknown>[] = [];
  const held = await sendSms(db, 'deal-new', 'dealer-a', sent);
  assert.deepEqual(held, {
    held: true,
    error: 'No text number is free for this dealer. Purchase another Telnyx number.',
    purchaseFlag: true,
  });
  assert.equal(sent.length, 0);
  assert.equal(db.rows('conversation_identities').length, 1);
  assert.equal(db.rows('conversation_identities')[0]?.sms_number_e164, '+18035550101');
  assert.equal(db.rows('conversation_identities')[0]?.shopper_id, 'shopper-a');
  assert.equal(db.rows('identity_settings')[0]?.purchase_needed, true);
  assert.equal(await readLivePurchaseFlag(db.client), true);
});

test('the same shopper can use a cooled number again, and an empty live pool never sends', async () => {
  const cooled = memoryDb({
    deals: [deal('deal-next', 'shopper-a', 'SC')],
    profiles: [{ user_id: 'shopper-a', first_name: 'Maya' }],
    pool: [number('+18035550101', false)],
    identities: [{
      id: 'conv-old',
      deal_id: 'deal-old',
      dealer_id: 'dealer-a',
      shopper_id: 'shopper-a',
      shopper_first_name: 'Maya',
      email_alias: 'maya.abcd@offers.drevvy.com',
      sms_number_e164: '+18035550101',
      voice_number_e164: null,
      locked_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_test: false,
      ended_at: new Date(Date.now() - 10 * DAY).toISOString(),
    }],
    settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 0, purchase_needed: false },
  });
  const sent: Record<string, unknown>[] = [];
  const again = await sendSms(cooled, 'deal-next', 'dealer-a', sent);
  assert.equal('messageId' in again, true);
  assert.equal(sent[0]?.from, '+18035550101');
  const next = cooled.rows('conversation_identities').find((row) => row.deal_id === 'deal-next');
  assert.equal(next?.alias_domain, 'offers.drevvy.com');
  assert.match(String(next?.email_alias), /@offers\.drevvy\.com$/);

  const empty = memoryDb({
    deals: [deal('deal-1', 'shopper-1', 'SC')],
    profiles: [{ user_id: 'shopper-1', first_name: 'Maya' }],
    pool: [number('+18039878296', true)],
    settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 2, purchase_needed: false },
  });
  const posts: Record<string, unknown>[] = [];
  const held = await sendOutboundEmail(store(), {
    from: 'deals@drevvy.example',
    to: 'desk@dealer.example',
    subject: 'Price',
    text: 'What is the price?',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl: capture(posts),
    link: { dealId: 'deal-1', dealerId: 'dealer-a', touchpointId: 'D0-E1' },
    assignment: { supabase: empty.client },
  });
  assert.equal('held' in held && held.held, true);
  assert.equal('purchaseFlag' in held && held.purchaseFlag, true);
  assert.equal(posts.length, 0);
  assert.equal(empty.rows('conversation_identities').length, 0);
  assert.equal(await readLivePurchaseFlag(empty.client), true);
});

test('a voice call uses the state caller ID after the identity is assigned', async () => {
  const db = memoryDb({
    deals: [deal('deal-1', 'shopper-1', 'SC')],
    profiles: [{ user_id: 'shopper-1', first_name: 'Maya' }],
    pool: [number('+18035550101', false)],
    voices: [{ state_code: 'SC', phone_e164: '+18035551000' }],
    settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 2, purchase_needed: false },
  });
  const sent: Record<string, unknown>[] = [];
  const call = await placeTexmlAiCall(store(), {
    connectionId: 'conn',
    from: '+19995550100',
    to: '+18035550999',
    assistantId: 'assistant',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl: capture(sent),
    link: { dealId: 'deal-1', dealerId: 'dealer-a', touchpointId: 'D0-C1' },
    assignment: { supabase: db.client },
    script: 'Please text or email us.',
  });
  assert.equal('callSid' in call, true);
  assert.equal(sent[0]?.From, '+18035551000');
  assert.equal(db.rows('conversation_identities')[0]?.sms_number_e164, '+18035550101');
  assert.notEqual(sent[0]?.From, '+18035550101');
});

test('test mode sends the env number and does not assign an identity', async () => {
  let lookedUp = false;
  const supabase = {
    from() {
      lookedUp = true;
      throw new Error('test mode must not assign');
    },
  } as unknown as SupabaseClient;
  const sent: Record<string, unknown>[] = [];
  const sms = await sendOutboundSms(store(), {
    testMode: true,
    from: '803-987-8296',
    to: '+18392748197',
    text: 'Test line only.',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl: capture(sent),
    link: { dealId: 'deal-1', dealerId: 'dealer-a', touchpointId: 'D0-T1' },
    assignment: { supabase, shopperId: 'shopper-1' },
  });
  assert.equal('messageId' in sms, true);
  assert.equal(sent[0]?.from, '+18039878296');
  assert.equal(lookedUp, false);
});

function sendSms(
  db: MemoryDb,
  dealId: string,
  dealerId: string,
  sent: Record<string, unknown>[],
  shopperId?: string,
) {
  return sendOutboundSms(store(), {
    from: '+19995550100',
    to: '+18035550999',
    text: 'Is it still available?',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    apiKey: 'secret',
    fetchImpl: capture(sent),
    link: { dealId, dealerId, touchpointId: 'D0-T1' },
    assignment: { supabase: db.client, shopperId },
  });
}

function capture(sent: Record<string, unknown>[]): typeof fetch {
  return async (_input, init) => {
    sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ data: { id: `id-${sent.length}` }, call_sid: `CA${sent.length}` }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function store(): CommunicationsStore {
  return {
    async testNumbers() {
      return new Set<string>();
    },
    async findByVendorEvent() {
      return null;
    },
    async findCallContext() {
      return null;
    },
    async save(event: BrainVendorEvent) {
      return { id: event.vendor_event_id };
    },
    async attach() {},
    async uploadRecording() {
      return true;
    },
  };
}

type Row = Record<string, unknown>;

type MemoryDb = {
  client: SupabaseClient;
  rows: (table: string) => Row[];
};

function deal(id: string, shopperId: string, state: string): Row {
  return {
    id,
    consumer_user_id: shopperId,
    vehicle_snapshot: { year: 2024, make: 'Toyota', model: 'RAV4', price: 30000, state },
  };
}

function number(phone: string, isTest: boolean, lastAssignedAt: string | null = null): Row {
  return { phone_e164: phone, status: 'active', is_test: isTest, last_assigned_at: lastAssignedAt, label: phone };
}

function memoryDb(seed: {
  deals?: Row[];
  profiles?: Row[];
  pool?: Row[];
  voices?: Row[];
  identities?: Row[];
  settings: Row;
}): MemoryDb {
  const tables: Record<string, Row[]> = {
    shopper_deals: [...(seed.deals ?? [])],
    consumer_profiles: [...(seed.profiles ?? [])],
    sms_number_pool: [...(seed.pool ?? [])],
    voice_numbers: [...(seed.voices ?? [])],
    conversation_identities: [...(seed.identities ?? [])],
    identity_settings: [{ id: 1, ...seed.settings }],
  };
  let sequence = 0;
  const client = {
    auth: {
      admin: {
        async getUserById() {
          return { data: { user: null } };
        },
      },
    },
    from(table: string) {
      return new Query(tables, table, () => {
        sequence += 1;
        return `conv-${sequence}`;
      });
    },
  };
  return { client: client as unknown as SupabaseClient, rows: (table) => tables[table] ?? [] };
}

class Query {
  private filters: ((row: Row) => boolean)[] = [];
  private operation: 'select' | 'insert' | 'update' = 'select';
  private payload: Row | null = null;

  constructor(
    private readonly tables: Record<string, Row[]>,
    private readonly table: string,
    private readonly nextId: () => string,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => (value === null ? row[column] == null : row[column] === value));
    return this;
  }

  insert(payload: Row) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.one(false));
  }

  single() {
    return Promise.resolve(this.one(true));
  }

  then<T>(onfulfilled?: ((value: { data: Row[] | null; error: { message: string } | null }) => T) | null) {
    return Promise.resolve(this.many()).then(onfulfilled);
  }

  private rows(): Row[] {
    return (this.tables[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)));
  }

  private one(required: boolean): { data: Row | null; error: { message: string } | null } {
    if (this.operation === 'insert') return this.insertRow();
    const rows = this.rows();
    if (rows.length === 1) return { data: rows[0] ?? null, error: null };
    if (rows.length === 0 && !required) return { data: null, error: null };
    return { data: null, error: { message: 'expected one row' } };
  }

  private many(): { data: Row[] | null; error: { message: string } | null } {
    if (this.operation === 'insert') {
      const inserted = this.insertRow();
      return { data: inserted.data ? [inserted.data] : null, error: inserted.error };
    }
    if (this.operation === 'update') {
      for (const row of this.rows()) Object.assign(row, this.payload);
      return { data: null, error: null };
    }
    return { data: this.rows(), error: null };
  }

  private insertRow(): { data: Row | null; error: { message: string } | null } {
    const payload = this.payload ?? {};
    const table = this.tables[this.table] ?? [];
    if (this.table === 'conversation_identities') {
      if (table.some((row) => row.deal_id === payload.deal_id && row.dealer_id === payload.dealer_id)) {
        return { data: null, error: { message: 'duplicate key conversation_identities_deal_dealer_unique' } };
      }
      if (table.some((row) => row.email_alias === payload.email_alias)) {
        return { data: null, error: { message: 'duplicate key email_alias' } };
      }
      if (payload.ended_at == null && table.some((row) => (
        row.dealer_id === payload.dealer_id && row.sms_number_e164 === payload.sms_number_e164 && row.ended_at == null
      ))) {
        return { data: null, error: { message: 'duplicate key conversation_identities_live_sms_per_dealer' } };
      }
    }
    const row: Row = {
      ...payload,
      id: payload.id ?? this.nextId(),
      locked_at: payload.locked_at ?? new Date().toISOString(),
      created_at: payload.created_at ?? new Date().toISOString(),
      ended_at: payload.ended_at ?? null,
    };
    table.push(row);
    this.tables[this.table] = table;
    if (this.table === 'conversation_identities') {
      const pool = this.tables.sms_number_pool?.find((item) => item.phone_e164 === row.sms_number_e164);
      if (pool) pool.last_assigned_at = new Date().toISOString();
    }
    return { data: row, error: null };
  }
}
