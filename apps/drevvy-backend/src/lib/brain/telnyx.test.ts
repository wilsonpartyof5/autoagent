import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, sign } from 'crypto';

import { verifyTelnyxSignature, parseClientState, mapTelnyxEventToChannel, mapTelnyxEventToStatus } from './telnyx';

describe('verifyTelnyxSignature', () => {
  let privateKey: ReturnType<typeof createPrivateKey>;
  let publicKeyBase64: string;

  beforeEach(() => {
    const { privateKey: privKey, publicKey: pubKey } = require('crypto').generateKeyPairSync('ed25519');
    privateKey = privKey;
    publicKeyBase64 = pubKey.export({ type: 'spki', format: 'der' }).toString('base64');
  });

  it('returns valid when signature is correct', () => {
    const payload = '{"data":{"id":"test"}}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signedPayload = `${timestamp}|${payload}`;
    const signature = sign(null, Buffer.from(signedPayload), privateKey).toString('base64');

    const result = verifyTelnyxSignature(payload, signature, timestamp, publicKeyBase64);
    assert.equal(result.valid, true);
  });

  it('returns invalid when signature is wrong', () => {
    const payload = '{"data":{"id":"test"}}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const wrongSignature = Buffer.from('wrong').toString('base64');

    const result = verifyTelnyxSignature(payload, wrongSignature, timestamp, publicKeyBase64);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('verification'));
  });

  it('returns invalid when timestamp is too old', () => {
    const payload = '{"data":{"id":"test"}}';
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signedPayload = `${oldTimestamp}|${payload}`;
    const signature = sign(null, Buffer.from(signedPayload), privateKey).toString('base64');

    const result = verifyTelnyxSignature(payload, signature, oldTimestamp, publicKeyBase64);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('tolerance'));
  });

  it('returns invalid when public key is not configured', () => {
    const result = verifyTelnyxSignature('{}', 'sig', '123', null);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('not configured'));
  });

  it('returns invalid when signature header is missing', () => {
    const result = verifyTelnyxSignature('{}', null, '123', publicKeyBase64);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('Missing'));
  });

  it('returns invalid when timestamp header is missing', () => {
    const result = verifyTelnyxSignature('{}', 'sig', null, publicKeyBase64);
    assert.equal(result.valid, false);
    assert.ok('reason' in result && result.reason.includes('Missing'));
  });
});

describe('parseClientState', () => {
  it('parses base64 encoded JSON with all fields', () => {
    const state = { dealId: 'deal-123', dealerId: 'dlr-456', touchpoint: 'D0-C1', variant: 'A' };
    const base64 = Buffer.from(JSON.stringify(state)).toString('base64');
    const result = parseClientState(base64);
    assert.deepEqual(result, state);
  });

  it('returns empty object for undefined input', () => {
    const result = parseClientState(undefined);
    assert.deepEqual(result, {});
  });

  it('returns empty object for invalid base64', () => {
    const result = parseClientState('not-valid-base64!!!');
    assert.deepEqual(result, {});
  });

  it('returns empty object for non-JSON content', () => {
    const base64 = Buffer.from('not json').toString('base64');
    const result = parseClientState(base64);
    assert.deepEqual(result, {});
  });
});

describe('mapTelnyxEventToChannel', () => {
  it('maps call events to call', () => {
    assert.equal(mapTelnyxEventToChannel('call.initiated'), 'call');
    assert.equal(mapTelnyxEventToChannel('call.answered'), 'call');
    assert.equal(mapTelnyxEventToChannel('call.hangup'), 'call');
  });

  it('maps message events to sms', () => {
    assert.equal(mapTelnyxEventToChannel('message.sent'), 'sms');
    assert.equal(mapTelnyxEventToChannel('message.finalized'), 'sms');
  });

  it('returns null for unknown events', () => {
    assert.equal(mapTelnyxEventToChannel('unknown.event'), null);
  });
});

describe('mapTelnyxEventToStatus', () => {
  it('maps call.hangup with normal_clearing to completed', () => {
    const payload = {
      data: {
        id: 'test',
        event_type: 'call.hangup' as const,
        occurred_at: new Date().toISOString(),
        record_type: 'event' as const,
        payload: { hangup_cause: 'normal_clearing' },
      },
    };
    const result = mapTelnyxEventToStatus(payload);
    assert.equal(result.status, 'completed');
    assert.equal(result.errorCode, null);
  });

  it('maps call.hangup with other cause to error', () => {
    const payload = {
      data: {
        id: 'test',
        event_type: 'call.hangup' as const,
        occurred_at: new Date().toISOString(),
        record_type: 'event' as const,
        payload: { hangup_cause: 'user_busy' },
      },
    };
    const result = mapTelnyxEventToStatus(payload);
    assert.equal(result.status, 'user_busy');
    assert.equal(result.errorCode, 'user_busy');
  });

  it('maps message.finalized with errors to failed', () => {
    const payload = {
      data: {
        id: 'test',
        event_type: 'message.finalized' as const,
        occurred_at: new Date().toISOString(),
        record_type: 'event' as const,
        payload: {
          id: 'msg-1',
          type: 'SMS' as const,
          direction: 'outbound' as const,
          from: { phone_number: '+1234567890' },
          to: [{ phone_number: '+0987654321', status: 'failed' }],
          errors: [{ code: '40001', title: 'Invalid number' }],
        },
      },
    };
    const result = mapTelnyxEventToStatus(payload);
    assert.equal(result.status, 'failed');
    assert.equal(result.errorCode, '40001');
  });
});
