import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ingestTelnyxPayload, sendOutboundSms, storeOutboundEmail, type CommunicationsStore } from './communications';
import type { BrainVendorEvent } from './repository';
import { encodeClientState, seededTestNumbers } from './telnyx';

const HERE = dirname(fileURLToPath(import.meta.url));

test('migration labels the two test agents and keeps recordings private', () => {
  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261018190000_communications_and_test_labels.sql'), 'utf8');
  assert.match(sql, /\+18039878296/);
  assert.match(sql, /test agent 1/);
  assert.match(sql, /drevvy_caller/);
  assert.match(sql, /\+18392748197/);
  assert.match(sql, /test agent 2/);
  assert.match(sql, /kind text not null check \(kind in \('test', 'live'\)\)/);
  assert.match(sql, /ai_to_ai_test/);
  assert.match(sql, /call-recordings/);
  assert.match(sql, /public = false/);
  assert.match(sql, /revoke all on table public\.labeled_numbers from public, anon, authenticated/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /where is_test = false/);
  assert.equal(/negotiat/i.test(sql), false);
});

test('inbound text and email bodies are stored and test pairs are flagged', async () => {
  const memory = memoryStore(seededTestNumbers());
  const sms = await ingestTelnyxPayload({
    data: {
      id: 'evt-sms',
      event_type: 'message.received',
      occurred_at: '2026-10-17T15:00:00.000Z',
      payload: {
        direction: 'inbound',
        from: { phone_number: '+18039878296' },
        to: [{ phone_number: '+18392748197' }],
        text: 'Full inbound text from the test line.',
      },
    },
  }, { store: memory.store, apiKey: null });
  assert.equal(sms.httpStatus, 200);
  assert.equal(memory.saved[0]?.body, 'Full inbound text from the test line.');
  assert.equal(memory.saved[0]?.transcript, 'Full inbound text from the test line.');
  assert.equal(memory.saved[0]?.direction, 'inbound');
  assert.equal(memory.saved[0]?.is_test, true);
  assert.equal(memory.saved[0]?.conversation_type, 'ai_to_ai_test');

  const email = await ingestTelnyxPayload({
    data: {
      id: 'evt-email',
      event_type: 'email.received',
      occurred_at: '2026-10-17T15:05:00.000Z',
      payload: {
        direction: 'outbound',
        from: 'agent@drevvy.example',
        to: ['desk@dealer.example'],
        subject: 'Price check',
        body: { html: '<p>Full email body for the desk.</p>' },
        client_state: encodeClientState({ dealId: 'deal-email', dealerId: 'dlr-9', touchpointId: 'D0-E1' }),
      },
    },
  }, { store: memory.store, apiKey: null });
  assert.equal(email.httpStatus, 200);
  const storedEmail = memory.saved.find((row) => row.event_type === 'email.received');
  assert.match(storedEmail?.body ?? '', /Full email body for the desk/);
  assert.match(storedEmail?.body ?? '', /Price check/);
  assert.equal(storedEmail?.transcript, 'Subject: Price check Full email body for the desk.');
  assert.equal(storedEmail?.deal_id, 'deal-email');
  assert.equal(storedEmail?.is_test, false);
  assert.equal(JSON.stringify(storedEmail?.payload).includes('client_state'), false);
});

test('recording download is idempotent and transcript fetch does not keep the api key', async () => {
  const memory = memoryStore(seededTestNumbers());
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization')?.includes('super-secret-key') ?? false, url.includes('api.telnyx.com'));
    assert.equal(url.includes('super-secret-key'), false);
    if (url.includes('/messages')) {
      return jsonResponse({
        data: [
          { role: 'assistant', text: 'Hello from Drevvy.' },
          { role: 'user', text: 'Text me at 803-555-0199. Goal reached.' },
        ],
      });
    }
    if (url.includes('conversations-insights')) {
      return jsonResponse({ data: [{ conversation_insights: [{ result: 'Goal reached. Email desk@dealer.example.' }] }] });
    }
    return new Response(Uint8Array.from([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };

  const payload = {
    data: {
      id: 'evt-rec',
      event_type: 'call.recording.saved',
      occurred_at: '2026-10-17T16:00:00.000Z',
      payload: {
        call_control_id: 'v3_call_1',
        conversation_id: 'conv-12345678',
        recording_id: 'rec-12345678',
        from: '+15551212000',
        to: '+15551212999',
        channels: 'dual',
        duration_sec: 18,
        recording_urls: { mp3: 'https://recordings.example.com/dual.mp3?sig=do-not-store' },
        client_state: encodeClientState({ dealId: 'deal-call', dealerId: 'dlr-4', touchpointId: 'D0-C1' }),
      },
    },
  };

  const first = await ingestTelnyxPayload(payload, { store: memory.store, apiKey: 'super-secret-key', fetchImpl });
  assert.equal(first.httpStatus, 200);
  assert.equal(memory.uploads.length, 1);
  assert.equal(memory.uploads[0], 'calls/rec-12345678.mp3');
  const row = memory.saved[0];
  assert.match(row?.transcript ?? '', /Hello from Drevvy/);
  assert.match(row?.summary ?? '', /Goal reached/);
  assert.equal(row?.structured && typeof row.structured === 'object' && 'textableNumber' in row.structured
    ? (row.structured as { textableNumber: string }).textableNumber
    : null, '+18035550199');
  assert.equal(row?.duration_s, 18);
  assert.equal(row?.recording_path, 'calls/rec-12345678.mp3');
  assert.equal(row?.deal_id, 'deal-call');
  assert.equal(row?.touchpoint, 'D0-C1');
  assert.equal(JSON.stringify(row?.payload).includes('do-not-store'), false);
  assert.equal(JSON.stringify(row).includes('super-secret-key'), false);

  const second = await ingestTelnyxPayload(payload, { store: memory.store, apiKey: 'super-secret-key', fetchImpl });
  assert.equal(second.httpStatus, 200);
  assert.equal(memory.uploads.length, 1);
  assert.equal(memory.saved.length, 1);
});

test('outbound sms and email helpers store the full copy', async () => {
  const memory = memoryStore(seededTestNumbers());
  const fetchImpl: typeof fetch = async () => jsonResponse({ data: { id: 'msg-out-1' } });
  const sms = await sendOutboundSms(memory.store, {
    from: '+18039878296',
    to: '+18392748197',
    text: 'Outbound text that must be kept in full.',
    webhookUrl: 'https://app.example.com/api/webhooks/telnyx',
    link: { dealId: 'deal-sms', dealerId: 'dlr-1', touchpointId: 'D0-T1' },
    apiKey: 'secret',
    fetchImpl,
  });
  assert.equal('messageId' in sms ? sms.messageId : null, 'msg-out-1');
  assert.equal(memory.saved[0]?.body, 'Outbound text that must be kept in full.');
  assert.equal(memory.saved[0]?.is_test, true);

  const email = await storeOutboundEmail(memory.store, {
    from: 'agent@drevvy.example',
    to: 'desk@dealer.example',
    subject: 'Following up',
    text: 'Here is the full email.',
    vendorEventId: 'email-out-1',
    link: { dealId: 'deal-mail', dealerId: 'dlr-1', touchpointId: 'D1-E2' },
  });
  assert.equal('id' in email, true);
  const stored = memory.saved.find((row) => row.vendor_event_id === 'email-out-1');
  assert.match(stored?.body ?? '', /Here is the full email/);
  assert.equal(stored?.channel, 'email');
  assert.equal(stored?.direction, 'outbound');
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function memoryStore(numbers: Set<string>): { store: CommunicationsStore; saved: BrainVendorEvent[]; uploads: string[] } {
  const saved: BrainVendorEvent[] = [];
  const uploads: string[] = [];
  const store: CommunicationsStore = {
    async testNumbers() {
      return numbers;
    },
    async findByVendorEvent(vendorEventId, eventType) {
      return saved.find((row) => row.vendor_event_id === vendorEventId && row.event_type === eventType) ?? null;
    },
    async findCallContext() {
      return null;
    },
    async save(event) {
      const index = saved.findIndex((row) => row.vendor_event_id === event.vendor_event_id && row.event_type === event.event_type);
      if (index >= 0) saved[index] = event;
      else saved.push(event);
      return { id: `id-${saved.length}` };
    },
    async attach() {},
    async uploadRecording(path) {
      uploads.push(path);
      return true;
    },
  };
  return { store, saved, uploads };
}
