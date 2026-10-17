import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ingestTelnyxPayload, type CommunicationsStore } from './communications';
import { emailInboxUsername, routeInbound, type RouteIdentity } from './identity';
import type { IdentityRouter } from './identity-store';
import type { BrainVendorEvent } from './repository';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALIAS = 'maya.ab12@offers.drevvy.com';

test('the offers runbook names the Telnyx domain, DNS records, and email.received webhook', () => {
  const doc = readFileSync(join(HERE, '../../../docs/offers-drevvy-com-telnyx.md'), 'utf8');
  assert.match(doc, /POST https:\/\/api\.telnyx\.com\/v2\/email_domains/);
  assert.match(doc, /"domain": "offers\.drevvy\.com"/);
  assert.match(doc, /"inbound_enabled": true/);
  assert.match(doc, /telnyx-domain-verification=<DOMAIN_ID>/);
  assert.match(doc, /v=spf1 include:spf\.telnyx\.com ~all/);
  assert.match(doc, /telnyx1\._domainkey\.offers\.drevvy\.com/);
  assert.match(doc, /v=DKIM1; k=rsa; p=/);
  assert.match(doc, /mx\.telnyx\.com/);
  assert.match(doc, /\| 10 \|/);
  assert.match(doc, /v=DMARC1; p=none; rua=mailto:dmarc@telnyx\.com/);
  assert.match(doc, /\/api\/webhooks\/telnyx/);
  assert.match(doc, /"events": \["email\.received"\]/);
  assert.equal(emailInboxUsername(ALIAS), 'maya.ab12');
  assert.equal(emailInboxUsername('Maya <maya.ab12@offers.drevvy.com>'), 'maya.ab12');
  assert.equal(emailInboxUsername('desk@dealer.example'), null);
});

test('a simulated email.received payload matches the alias and stores the body', async () => {
  const memory = memoryStore();
  const unmatched: unknown[] = [];
  const router = aliasRouter([liveIdentity()], unmatched);
  const payload = received({
    id: 'evt-alias',
    from: { email: 'desk@dealer.example', name: 'Desk' },
    to: { email: ALIAS, name: 'Maya', kind: 'to' },
    subject: 'Re: Price',
    text_body: 'Still available. Out the door is 18400.',
    headers: { 'In-Reply-To': '<msg.abc@offers.drevvy.com>' },
  });

  const result = await ingestTelnyxPayload(payload, { store: memory.store, apiKey: null, router });
  assert.equal(result.httpStatus, 200);
  const stored = memory.saved.find((row) => row.vendor_event_id === 'evt-alias');
  assert.equal(stored?.event_type, 'email.received');
  assert.equal(stored?.channel, 'email');
  assert.equal(stored?.direction, 'inbound');
  assert.equal(stored?.to_address, ALIAS);
  assert.equal(stored?.from_address, 'desk@dealer.example');
  assert.equal(stored?.conversation_identity_id, 'conv-live');
  assert.equal(stored?.deal_id, 'deal-1');
  assert.equal(stored?.dealer_id, 'dealer-a');
  assert.match(stored?.body ?? '', /Still available/);
  assert.match(stored?.body ?? '', /Re: Price/);
  assert.equal(unmatched.length, 0);

  const cc = await ingestTelnyxPayload(received({
    id: 'evt-cc',
    from: { email: 'desk@dealer.example', name: 'Desk' },
    cc: { email: `Maya <${ALIAS}>`, name: null, kind: 'cc' },
    subject: 'Looping Maya',
    text_body: 'Copying the alias.',
  }), { store: memory.store, apiKey: null, router });
  assert.equal(cc.httpStatus, 200);
  assert.equal(memory.saved.find((row) => row.vendor_event_id === 'evt-cc')?.conversation_identity_id, 'conv-live');

  const fetched: string[] = [];
  const urlResult = await ingestTelnyxPayload(received({
    id: 'evt-url',
    from: { email: 'desk@dealer.example', name: 'Desk' },
    to: { email: ALIAS, name: null, kind: 'to' },
    subject: 'Stored body',
    text_body_url: 'https://storage.telnyx.com/email/body.txt',
  }), {
    store: memory.store,
    apiKey: null,
    router,
    fetchImpl: async (input) => {
      fetched.push(String(input));
      return new Response('The unit is still on the lot.', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
  });
  assert.equal(urlResult.httpStatus, 200);
  assert.deepEqual(fetched, ['https://storage.telnyx.com/email/body.txt']);
  assert.match(memory.saved.find((row) => row.vendor_event_id === 'evt-url')?.body ?? '', /still on the lot/);

  const blocked: string[] = [];
  await ingestTelnyxPayload(received({
    id: 'evt-private',
    from: { email: 'desk@dealer.example', name: 'Desk' },
    to: { email: ALIAS, name: null, kind: 'to' },
    subject: 'Do not fetch',
    text_body_url: 'http://127.0.0.1/latest/meta-data',
  }), {
    store: memory.store,
    apiKey: null,
    router,
    fetchImpl: async (input) => {
      blocked.push(String(input));
      return new Response('secret', { status: 200 });
    },
  });
  assert.deepEqual(blocked, []);
  assert.equal(memory.saved.find((row) => row.vendor_event_id === 'evt-private')?.body ?? null, null);

  await ingestTelnyxPayload(received({
    id: 'evt-lost',
    from: { email: 'other@dealer.example', name: 'Other' },
    to: { email: 'unknown@offers.drevvy.com', name: null, kind: 'to' },
    subject: 'Who is this?',
    text_body: 'No alias here.',
  }), { store: memory.store, apiKey: null, router });
  assert.equal(unmatched.length, 1);

  const route = readFileSync(join(HERE, '../../app/api/webhooks/telnyx/route.ts'), 'utf8');
  assert.match(route, /supabaseIdentityRouter/);
  assert.match(route, /ingestTelnyxPayload/);
});

function liveIdentity(): RouteIdentity {
  return {
    id: 'conv-live',
    dealId: 'deal-1',
    dealerId: 'dealer-a',
    emailAlias: ALIAS,
    smsNumberE164: '+18035550101',
    endedAt: null,
  };
}

function aliasRouter(identities: RouteIdentity[], unmatched: unknown[]): IdentityRouter {
  return {
    async route(input) {
      return routeInbound({
        ...input,
        identities,
        parties: [],
        threads: [],
      });
    },
    async recordUnmatched(input) {
      unmatched.push(input);
    },
    async remember() {},
  };
}

function received(payload: Record<string, unknown> & { id: string }): unknown {
  const { id, ...inner } = payload;
  return {
    data: {
      event_type: 'email.received',
      canonical_event_type: 'email.received',
      id,
      occurred_at: '2026-10-17T18:00:00.000Z',
      record_type: 'event',
      payload: inner,
    },
    meta: { attempt: 1 },
  };
}

function memoryStore(): { store: CommunicationsStore; saved: BrainVendorEvent[] } {
  const saved: BrainVendorEvent[] = [];
  const store: CommunicationsStore = {
    async testNumbers() {
      return new Set<string>();
    },
    async findByVendorEvent(vendorEventId, eventType) {
      return saved.find((row) => row.vendor_event_id === vendorEventId && row.event_type === eventType) ?? null;
    },
    async findCallContext() {
      return null;
    },
    async save(event) {
      saved.push(event);
      return { id: `id-${saved.length}` };
    },
    async attach() {},
    async uploadRecording() {
      return true;
    },
  };
  return { store, saved };
}
