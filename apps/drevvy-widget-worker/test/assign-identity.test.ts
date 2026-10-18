import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AppConfig } from '../src/config';
import { execute, type CliDeps } from '../src/cli';
import { ensureConversationContact } from '../src/forms/assign-identity';
import { MemoryAttemptStore } from '../src/chat/memory-store';
import { MemoryDirectoryStore } from '../src/directory/memory-store';
import { FakeChatPage } from './fake-page';
import { readFixture } from './fixture';

const DAY = 24 * 60 * 60 * 1000;
const pageUrl = 'https://www.example-motors.test/inventory/civic';

describe('live widget assignment', () => {
  it('keeps the alias and number, and will not put one number live twice at a dealer', async () => {
    const db = memoryDb({
      deals: [deal('deal-1', 'shopper-1'), deal('deal-2', 'shopper-2'), deal('deal-3', 'shopper-3')],
      profiles: [
        { user_id: 'shopper-1', first_name: 'Maya' },
        { user_id: 'shopper-2', first_name: 'Luis' },
        { user_id: 'shopper-3', first_name: 'Ana' },
      ],
      pool: [number('+18035550101'), number('+18035550102', '2026-10-01T00:00:00.000Z')],
      voices: [{ state_code: 'SC', phone_e164: '+18035551000' }],
      settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 5, purchase_needed: false },
    });
    const first = await ensureConversationContact(db.client, { dealId: 'deal-1', dealerId: 'dealer-a', random: () => 0.2 });
    const again = await ensureConversationContact(db.client, { dealId: 'deal-1', dealerId: 'dealer-a', random: () => 0.9 });
    assert.equal('emailAlias' in first && 'emailAlias' in again && first.emailAlias === again.emailAlias, true);
    assert.equal('smsNumber' in first && 'smsNumber' in again && first.smsNumber === again.smsNumber, true);
    assert.equal(db.rows('conversation_identities').length, 1);
    assert.equal(db.rows('conversation_identities')[0]?.voice_number_e164, '+18035551000');
    assert.match(String(db.rows('conversation_identities')[0]?.alias_domain), /^(offers|deals|quotes|buyers)\.drevvy\.com$/);

    const second = await ensureConversationContact(db.client, { dealId: 'deal-2', dealerId: 'dealer-a', random: () => 0.2 });
    assert.equal('smsNumber' in first && 'smsNumber' in second && first.smsNumber !== second.smsNumber, true);
    const domains = new Set(db.rows('conversation_identities').map((row) => row.alias_domain));
    assert.equal(domains.size, 1);
    const third = await ensureConversationContact(db.client, { dealId: 'deal-3', dealerId: 'dealer-a', random: () => 0.2 });
    assert.equal('held' in third && third.held, true);
    assert.equal('purchaseFlag' in third && third.purchaseFlag, true);
    assert.equal(db.rows('conversation_identities').length, 2);
    assert.equal(db.rows('identity_settings')[0]?.purchase_needed, true);
    const liveNumbers = db.rows('conversation_identities')
      .filter((row) => row.dealer_id === 'dealer-a' && row.ended_at == null)
      .map((row) => row.sms_number_e164);
    assert.equal(new Set(liveNumbers).size, liveNumbers.length);
  });

  it('holds the send when cooldown leaves no number, and does not reuse it', async () => {
    const db = memoryDb({
      deals: [deal('deal-new', 'shopper-b')],
      profiles: [{ user_id: 'shopper-b', first_name: 'Luis' }],
      pool: [number('+18035550101')],
      identities: [{
        id: 'conv-old',
        deal_id: 'deal-old',
        dealer_id: 'dealer-a',
        shopper_id: 'shopper-a',
        shopper_first_name: 'Maya',
        email_alias: 'maya.abcd@offers.drevvy.com',
        sms_number_e164: '+18035550101',
        voice_number_e164: null,
        ended_at: new Date(Date.now() - 10 * DAY).toISOString(),
      }],
      settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 0, purchase_needed: false },
    });
    const held = await ensureConversationContact(db.client, { dealId: 'deal-new', dealerId: 'dealer-a', random: () => 0.2 });
    assert.deepEqual(held, {
      held: true,
      error: 'No text number is free for this dealer. Purchase another Telnyx number.',
      purchaseFlag: true,
    });
    assert.equal(db.rows('conversation_identities').length, 1);
    assert.equal(db.rows('conversation_identities')[0]?.shopper_id, 'shopper-a');
    assert.equal(db.rows('identity_settings')[0]?.purchase_needed, true);
  });

  it('keeps a dealer on its sending domain and rejects a brand-like first name', async () => {
    const db = memoryDb({
      deals: [deal('deal-new', 'shopper-b'), deal('deal-other', 'shopper-c')],
      profiles: [
        { user_id: 'shopper-b', first_name: 'Luis' },
        { user_id: 'shopper-c', first_name: 'Ana' },
      ],
      pool: [number('+18035550101'), number('+18035550102'), number('+18035550103')],
      identities: [{
        id: 'conv-old',
        deal_id: 'deal-old',
        dealer_id: 'dealer-a',
        shopper_id: 'shopper-a',
        shopper_first_name: 'Maya',
        email_alias: 'maya.abcd@quotes.drevvy.com',
        alias_domain: 'quotes.drevvy.com',
        sms_number_e164: '+18035550101',
        voice_number_e164: null,
        ended_at: null,
      }],
      settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 0, purchase_needed: false },
    });
    const sameDealer = await ensureConversationContact(db.client, { dealId: 'deal-new', dealerId: 'dealer-a', random: () => 0.2 });
    assert.equal('emailAlias' in sameDealer && sameDealer.emailAlias.endsWith('@quotes.drevvy.com'), true);
    const otherDealer = await ensureConversationContact(db.client, { dealId: 'deal-other', dealerId: 'dealer-b', random: () => 0.2 });
    assert.equal('emailAlias' in otherDealer && otherDealer.emailAlias.endsWith('@quotes.drevvy.com'), false);

    const branded = memoryDb({
      deals: [deal('deal-brand', 'shopper-d')],
      profiles: [{ user_id: 'shopper-d', first_name: 'Deals' }],
      pool: [number('+18035550101')],
      settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 0, purchase_needed: false },
    });
    const held = await ensureConversationContact(branded.client, { dealId: 'deal-brand', dealerId: 'dealer-c', random: () => 0.2 });
    assert.equal('held' in held && held.held, true);
    assert.equal(branded.rows('conversation_identities').length, 0);

    const spaced = memoryDb({
      deals: [deal('deal-spaced', 'shopper-e')],
      profiles: [{ user_id: 'shopper-e', first_name: 'De Als' }],
      pool: [number('+18035550101')],
      settings: { sms_cooldown_days: 90, sms_pool_low_watermark: 0, purchase_needed: false },
    });
    const spacedHeld = await ensureConversationContact(spaced.client, { dealId: 'deal-spaced', dealerId: 'dealer-d', random: () => 0.2 });
    assert.equal('held' in spacedHeld && spacedHeld.held, true);
    assert.equal(spaced.rows('conversation_identities').length, 0);
  });

  it('does not assign in test mode and holds a live lead before the page opens', async () => {
    let ensured = 0;
    let opened = 0;
    const testRun = await execute(['lead', pageUrl, '--deal', 'deal-1', '--dealer', 'dealer-a'], deps({
      testMode: true,
      ensureContact: async () => {
        ensured += 1;
        return { held: true, error: 'should not assign', purchaseFlag: true };
      },
      loadContact: async () => null,
      openPage: async () => {
        opened += 1;
        const page = new FakeChatPage(readFixture('gubagoo-vdp.html'));
        return { page, close: () => page.close() };
      },
    }));
    assert.equal(testRun.exitCode, 0, testRun.stderr);
    assert.equal(ensured, 0);
    assert.equal(opened, 1);

    opened = 0;
    const held = await execute(['lead', pageUrl, '--deal', 'deal-1', '--dealer', 'dealer-a'], deps({
      testMode: false,
      dryRun: false,
      allowlist: ['https://www.example-motors.test'],
      ensureContact: async () => ({
        held: true,
        error: 'No text number is free for this dealer. Purchase another Telnyx number.',
        purchaseFlag: true,
      }),
      openPage: async () => {
        opened += 1;
        const page = new FakeChatPage('<html></html>');
        return { page, close: () => page.close() };
      },
    }));
    assert.equal(held.exitCode, 1);
    assert.match(held.stderr, /Purchase another Telnyx number/);
    assert.equal(opened, 0);
  });
});

function deps(overrides: {
  testMode: boolean;
  dryRun?: boolean;
  allowlist?: string[];
  ensureContact?: CliDeps['ensureContact'];
  loadContact?: CliDeps['loadContact'];
  openPage: CliDeps['openPage'];
}): CliDeps {
  const config: AppConfig = {
    aiBaseUrl: 'https://api.x.ai/v1',
    aiApiKey: 'test-key',
    aiModel: 'grok-4',
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service',
    dryRun: overrides.dryRun ?? true,
    allowlist: overrides.allowlist ?? [],
    drevvyTextNumber: '803-555-0148',
    drevvyEmail: 'deals@drevvy.test',
    shopperFirst: 'Maya',
    leadLastName: 'via Drevvy',
    leadZip: '29201',
    fetchTimeoutMs: 1000,
    maxTurns: 6,
    scanSettleMs: 0,
    scanConcurrency: 1,
    scanTimeoutMs: 25_000,
    marketcheckApiKey: null,
    marketcheckBaseUrl: 'https://api.marketcheck.com',
    seedIntervalMs: 1_000,
    testMode: overrides.testMode,
  };
  return {
    config,
    directory: new MemoryDirectoryStore(),
    attempts: new MemoryAttemptStore(),
    fetchPage: async (url) => ({ url, status: 200, html: '' }),
    ai: { async complete() { return '{}'; } },
    openPage: overrides.openPage,
    readFile: () => '',
    exists: () => false,
    loadContact: overrides.loadContact,
    ensureContact: overrides.ensureContact,
  };
}

type Row = Record<string, unknown>;

function deal(id: string, shopperId: string): Row {
  return {
    id,
    consumer_user_id: shopperId,
    vehicle_snapshot: { state: 'SC' },
  };
}

function number(phone: string, lastAssignedAt: string | null = null): Row {
  return { phone_e164: phone, status: 'active', is_test: false, last_assigned_at: lastAssignedAt };
}

function memoryDb(seed: {
  deals?: Row[];
  profiles?: Row[];
  pool?: Row[];
  voices?: Row[];
  identities?: Row[];
  settings: Row;
}): { client: SupabaseClient; rows: (table: string) => Row[] } {
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
    auth: { admin: { async getUserById() { return { data: { user: null } }; } } },
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

  select() { return this; }

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

  maybeSingle() { return Promise.resolve(this.one(false)); }
  single() { return Promise.resolve(this.one(true)); }

  then<T>(onfulfilled?: ((value: { data: Row[] | null; error: { message: string } | null }) => T) | null) {
    return Promise.resolve(this.many()).then(onfulfilled);
  }

  private matching(): Row[] {
    return (this.tables[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)));
  }

  private one(required: boolean): { data: Row | null; error: { message: string } | null } {
    if (this.operation === 'insert') return this.insertRow();
    const rows = this.matching();
    if (rows.length === 1) return { data: rows[0] ?? null, error: null };
    if (rows.length === 0 && !required) return { data: null, error: null };
    return { data: null, error: { message: 'expected one row' } };
  }

  private many(): { data: Row[] | null; error: { message: string } | null } {
    if (this.operation === 'update') {
      for (const row of this.matching()) Object.assign(row, this.payload);
      return { data: null, error: null };
    }
    return { data: this.matching(), error: null };
  }

  private insertRow(): { data: Row | null; error: { message: string } | null } {
    const payload = this.payload ?? {};
    const table = this.tables[this.table] ?? [];
    if (this.table === 'conversation_identities') {
      if (payload.ended_at == null && table.some((row) => (
        row.dealer_id === payload.dealer_id && row.sms_number_e164 === payload.sms_number_e164 && row.ended_at == null
      ))) {
        return { data: null, error: { message: 'duplicate key conversation_identities_live_sms_per_dealer' } };
      }
    }
    const row: Row = { ...payload, id: payload.id ?? this.nextId(), ended_at: payload.ended_at ?? null };
    table.push(row);
    this.tables[this.table] = table;
    return { data: row, error: null };
  }
}
