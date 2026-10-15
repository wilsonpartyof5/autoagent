import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';

import {
  verifyElevenLabsSignature,
  parseElevenLabsDynamicVariables,
  formatTranscript,
  type ElevenLabsPostCallPayload,
} from './elevenlabs';

describe('verifyElevenLabsSignature', () => {
  const webhookSecret = 'test-secret-key';

  it('returns valid when signature is correct', () => {
    const payload = '{"type":"post_call_transcription"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
    const header = `t=${timestamp},v1=${signature}`;

    const result = verifyElevenLabsSignature(payload, header, webhookSecret);
    assert.equal(result.valid, true);
  });

  it('returns invalid when signature is wrong', () => {
    const payload = '{"type":"post_call_transcription"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const header = `t=${timestamp},v1=wrongsignature`;

    const result = verifyElevenLabsSignature(payload, header, webhookSecret);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('verification failed'));
  });

  it('returns invalid when timestamp is too old', () => {
    const payload = '{"type":"post_call_transcription"}';
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signedPayload = `${oldTimestamp}.${payload}`;
    const signature = createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
    const header = `t=${oldTimestamp},v1=${signature}`;

    const result = verifyElevenLabsSignature(payload, header, webhookSecret);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('tolerance'));
  });

  it('returns invalid when webhook secret is not configured', () => {
    const result = verifyElevenLabsSignature('{}', 't=123,v1=sig', null);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('not configured'));
  });

  it('returns invalid when signature header is missing', () => {
    const result = verifyElevenLabsSignature('{}', null, webhookSecret);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('Missing'));
  });

  it('returns invalid when header format is wrong', () => {
    const result = verifyElevenLabsSignature('{}', 'invalid-format', webhookSecret);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('Invalid'));
  });
});

describe('parseElevenLabsDynamicVariables', () => {
  it('parses dynamic variables from metadata', () => {
    const payload: ElevenLabsPostCallPayload = {
      type: 'post_call_transcription',
      event_timestamp: Date.now() / 1000,
      conversation_id: 'conv-123',
      agent_id: 'agent-456',
      status: 'done',
      metadata: {
        conversation_initiation_client_data: {
          dynamic_variables: {
            dealId: 'deal-123',
            dealerId: 'dlr-456',
            touchpoint: 'D0-C1',
            variant: 'A',
          },
        },
      },
    };

    const result = parseElevenLabsDynamicVariables(payload);
    assert.deepEqual(result, {
      dealId: 'deal-123',
      dealerId: 'dlr-456',
      touchpoint: 'D0-C1',
      variant: 'A',
    });
  });

  it('returns empty object when metadata is missing', () => {
    const payload: ElevenLabsPostCallPayload = {
      type: 'post_call_transcription',
      event_timestamp: Date.now() / 1000,
      conversation_id: 'conv-123',
      agent_id: 'agent-456',
      status: 'done',
    };

    const result = parseElevenLabsDynamicVariables(payload);
    assert.deepEqual(result, {});
  });
});

describe('formatTranscript', () => {
  it('returns transcript string if present', () => {
    const payload: ElevenLabsPostCallPayload = {
      type: 'post_call_transcription',
      event_timestamp: Date.now() / 1000,
      conversation_id: 'conv-123',
      agent_id: 'agent-456',
      status: 'done',
      transcript: 'Hello, this is a test transcript.',
    };

    const result = formatTranscript(payload);
    assert.equal(result, 'Hello, this is a test transcript.');
  });

  it('formats transcript_object into readable text', () => {
    const payload: ElevenLabsPostCallPayload = {
      type: 'post_call_transcription',
      event_timestamp: Date.now() / 1000,
      conversation_id: 'conv-123',
      agent_id: 'agent-456',
      status: 'done',
      transcript_object: [
        { role: 'agent', message: 'Hi, this is Drevvy.' },
        { role: 'user', message: 'Hello, I have a question.' },
        { role: 'agent', message: 'Sure, how can I help?' },
      ],
    };

    const result = formatTranscript(payload);
    assert.equal(result, 'Drevvy: Hi, this is Drevvy.\nDealer: Hello, I have a question.\nDrevvy: Sure, how can I help?');
  });

  it('returns null when no transcript data', () => {
    const payload: ElevenLabsPostCallPayload = {
      type: 'post_call_transcription',
      event_timestamp: Date.now() / 1000,
      conversation_id: 'conv-123',
      agent_id: 'agent-456',
      status: 'done',
    };

    const result = formatTranscript(payload);
    assert.equal(result, null);
  });
});
