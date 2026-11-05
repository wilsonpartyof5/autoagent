import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, sign } from 'crypto';

import {
  verifyTelnyxSignature,
  parseClientState,
  encodeClientState,
  mapTelnyxEventToChannel,
  mapTelnyxEventToStatus,
  stripHtml,
  buildTexmlAiCallBody,
  buildOutboundCallBody,
  buildOutboundSmsBody,
  flagTestParties,
  seededTestNumbers,
  parseStructuredCallResult,
  normalizeTelnyxPayload,
  pickRecordingUrl,
  sanitizeTelnyxPayload,
  isSafeRecordingUrl,
  recordingObjectPath,
  safeRecordingPath,
  shouldFetchTranscript,
  shouldDownloadRecording,
  SEEDED_LABELED_NUMBERS,
} from './telnyx';

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

  it('maps email events to email', () => {
    assert.equal(mapTelnyxEventToChannel('email.delivered'), 'email');
    assert.equal(mapTelnyxEventToChannel('email.bounced'), 'email');
    assert.equal(mapTelnyxEventToChannel('email.received'), 'email');
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

  it('maps email.bounced to bounced with error', () => {
    const payload = {
      data: {
        id: 'test',
        event_type: 'email.bounced' as const,
        occurred_at: new Date().toISOString(),
        record_type: 'event' as const,
        payload: {
          id: 'email-1',
          direction: 'outbound' as const,
          bounce_type: 'hard',
          bounce_reason: 'Invalid recipient',
        },
      },
    };
    const result = mapTelnyxEventToStatus(payload);
    assert.equal(result.status, 'bounced');
    assert.equal(result.errorCode, 'hard');
    assert.equal(result.errorDetail, 'Invalid recipient');
  });

  it('maps email.delivered to delivered', () => {
    const payload = {
      data: {
        id: 'test',
        event_type: 'email.delivered' as const,
        occurred_at: new Date().toISOString(),
        record_type: 'event' as const,
        payload: {
          id: 'email-1',
          direction: 'outbound' as const,
        },
      },
    };
    const result = mapTelnyxEventToStatus(payload);
    assert.equal(result.status, 'delivered');
    assert.equal(result.errorCode, null);
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    const html = '<p>Hello <strong>World</strong></p>';
    const result = stripHtml(html);
    assert.equal(result, 'Hello World');
  });

  it('removes style tags and their contents', () => {
    const html = '<style>body { color: red; }</style><p>Content</p>';
    const result = stripHtml(html);
    assert.equal(result, 'Content');
  });

  it('removes script tags and their contents', () => {
    const html = '<script>alert("test");</script><p>Safe content</p>';
    const result = stripHtml(html);
    assert.equal(result, 'Safe content');
  });

  it('decodes HTML entities', () => {
    const html = 'Tom &amp; Jerry &lt;3 &gt; 2 &quot;quoted&quot; it&#39;s';
    const result = stripHtml(html);
    assert.equal(result, "Tom & Jerry <3 > 2 \"quoted\" it's");
  });

  it('converts nbsp to space', () => {
    const html = 'Hello&nbsp;World';
    const result = stripHtml(html);
    assert.equal(result, 'Hello World');
  });

  it('normalizes whitespace', () => {
    const html = '<p>Hello</p>   \n\n   <p>World</p>';
    const result = stripHtml(html);
    assert.equal(result, 'Hello World');
  });

  it('handles empty input', () => {
    const result = stripHtml('');
    assert.equal(result, '');
  });

  it('reads deal_id, dealer_id, and touchpoint_id from client state', () => {
    const encoded = encodeClientState({ dealId: 'deal-1', dealerId: 'dlr-2', touchpointId: 'D0-C1', variant: 'B' });
    assert.deepEqual(parseClientState(encoded), {
      dealId: 'deal-1',
      dealerId: 'dlr-2',
      touchpoint: 'D0-C1',
      variant: 'B',
    });
  });
});

describe('call and message requests', () => {
  const link = { dealId: 'deal-9', dealerId: 'dlr-3', touchpointId: 'D0-C2' };
  const webhook = 'https://app.example.com/api/webhooks/telnyx';

  it('points TeXML AI calls at the status webhook with client state', () => {
    const body = buildTexmlAiCallBody({
      from: '+18039878296',
      to: '+18392748197',
      assistantId: 'assistant-1',
      webhookUrl: webhook,
      link,
    });
    assert.equal(body.StatusCallback, webhook);
    assert.equal(body.ConversationCallback, webhook);
    assert.equal(body.RecordingStatusCallback, webhook);
    assert.equal(body.StatusCallbackMethod, 'POST');
    assert.equal(body.RecordingChannels, 'dual');
    assert.equal(body.Record, true);
    const state = parseClientState(String(body.ClientState));
    assert.equal(state.dealId, 'deal-9');
    assert.equal(state.dealerId, 'dlr-3');
    assert.equal(state.touchpoint, 'D0-C2');
    assert.equal(String(body.StatusCallbackEvent).includes('analyzed'), true);
    assert.equal(body.AIAssistantDynamicVariables, undefined);
  });

  it('passes deal dynamic variables to the TeXML AI assistant', () => {
    const body = buildTexmlAiCallBody({
      from: '+18039878296',
      to: '+18392748197',
      assistantId: 'assistant-c9821868-8ec6-46d6-a5bc-f0c2340089f7',
      webhookUrl: webhook,
      link,
      dynamicVariables: {
        shopper_first_name: 'Maya',
        stock_number: '17646',
        reply_text_number: '+18035550148',
        reply_email: 'maya.ab12@offers.drevvy.com',
      },
    });
    assert.deepEqual(body.AIAssistantDynamicVariables, {
      shopper_first_name: 'Maya',
      stock_number: '17646',
      reply_text_number: '+18035550148',
      reply_email: 'maya.ab12@offers.drevvy.com',
    });
    assert.notEqual(
      (body.AIAssistantDynamicVariables as { reply_text_number: string }).reply_text_number,
      body.From,
    );
  });

  it('points outbound calls at the webhook with client state and a dual mp3', () => {
    const body = buildOutboundCallBody({
      connectionId: 'conn-1',
      from: '+18039878296',
      to: '+15551212',
      webhookUrl: webhook,
      link,
    });
    assert.equal(body.webhook_url, webhook);
    assert.equal(body.webhook_url_method, 'POST');
    assert.equal(body.record_channels, 'dual');
    assert.equal(body.record_format, 'mp3');
    assert.equal(parseClientState(String(body.client_state)).touchpoint, 'D0-C2');
  });

  it('sends the full SMS body to the same webhook', () => {
    const body = buildOutboundSmsBody({
      from: '+18039878296',
      to: '+15551212',
      text: 'Full text body that must be stored.',
      webhookUrl: webhook,
    });
    assert.equal(body.text, 'Full text body that must be stored.');
    assert.equal(body.webhook_url, webhook);
  });
});

describe('test numbers and structured call results', () => {
  it('flags a call or text only when both parties are labeled test numbers', () => {
    const numbers = seededTestNumbers();
    assert.deepEqual(
      flagTestParties('+1 (803) 987-8296', '839-274-8197', numbers),
      { isTest: true, conversationType: 'ai_to_ai_test' },
    );
    assert.deepEqual(
      flagTestParties('+18039878296', '+15551212000', numbers),
      { isTest: false, conversationType: null },
    );
    assert.equal(flagTestParties('dealer@example.com', 'shopper@example.com', numbers).isTest, false);
    assert.equal(SEEDED_LABELED_NUMBERS[0].label, 'test agent 1');
    assert.equal(SEEDED_LABELED_NUMBERS[1].label, 'test agent 2');
  });

  it('reads a textable number, email, goal, and voicemail from the conversation', () => {
    const result = parseStructuredCallResult({
      texts: [
        'The textable number is (803) 555-0199. Email: desk@dealer.example.',
        'Goal reached after the price was confirmed.',
      ],
      toolCalls: [{ name: 'capture_contact', arguments: '{"voicemail_left":false}' }],
      machine: 'human',
    });
    assert.equal(result.textableNumber, '+18035550199');
    assert.equal(result.email, 'desk@dealer.example');
    assert.equal(result.goalReached, true);
    assert.equal(result.voicemailLeft, false);

    const missed = parseStructuredCallResult({ texts: ['left a voicemail'], machine: 'machine' });
    assert.equal(missed.voicemailLeft, true);
    assert.equal(parseStructuredCallResult({ texts: ['goal not reached'] }).goalReached, false);
  });
});

describe('telnyx payload normalization', () => {
  it('keeps the SMS body and strips signed media urls from storage', () => {
    const payload = {
      data: {
        id: 'evt-sms',
        event_type: 'message.received',
        occurred_at: '2026-10-17T12:00:00.000Z',
        record_type: 'event',
        payload: {
          id: 'msg-1',
          direction: 'inbound',
          from: { phone_number: '+18039878296' },
          to: [{ phone_number: '+18392748197', status: 'received' }],
          text: 'The full inbound text.',
          client_state: Buffer.from('{"deal_id":"deal-1"}').toString('base64'),
        },
      },
    };
    const normalized = normalizeTelnyxPayload(payload);
    assert.equal(normalized?.channel, 'sms');
    assert.equal(normalized?.body, 'The full inbound text.');
    assert.equal(normalized?.direction, 'inbound');
    assert.equal(normalized?.clientState.dealId, 'deal-1');
    const stored = sanitizeTelnyxPayload(payload);
    const inner = (stored.data as { payload: Record<string, unknown> }).payload;
    assert.equal('client_state' in inner, false);
    assert.equal(JSON.stringify(stored).includes('The full inbound text.'), true);
  });

  it('prefers the dual-channel mp3 and ignores private network urls', () => {
    const url = pickRecordingUrl({
      channels: 'single',
      recording_urls: { mp3: 'https://cdn.example.com/mono.mp3?X-Amz-Signature=secret' },
      public_recording_urls: { mp3: 'https://cdn.example.com/dual.mp3' },
      nested: { channels: 'dual', recording_urls: { mp3: 'https://cdn.example.com/stereo.mp3?sig=1' } },
    });
    assert.equal(url, 'https://cdn.example.com/stereo.mp3?sig=1');
    assert.equal(isSafeRecordingUrl('http://cdn.example.com/a.mp3'), false);
    assert.equal(isSafeRecordingUrl('https://169.254.169.254/latest'), false);
    const stored = sanitizeTelnyxPayload({ data: { payload: { recording_urls: { mp3: 'https://cdn.example.com/a.mp3?sig=1' } } } });
    assert.equal(JSON.stringify(stored).includes('sig'), false);
    assert.equal(JSON.stringify(stored).includes('recording_urls'), false);
    const path = recordingObjectPath('v3:abc', null);
    assert.equal(safeRecordingPath(path), path);
    assert.equal(safeRecordingPath('../calls/a.mp3'), null);
    assert.equal(shouldFetchTranscript('call.conversation.ended'), true);
    assert.equal(shouldFetchTranscript('call.initiated'), false);
    assert.equal(shouldDownloadRecording('call.recording.saved'), true);
  });
});

describe('stripHtml extra', () => {
  it('handles plain text without HTML', () => {
    const text = 'Just plain text';
    const result = stripHtml(text);
    assert.equal(result, 'Just plain text');
  });

  it('handles complex email HTML', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>body { font-family: Arial; }</style>
        </head>
        <body>
          <div style="padding: 20px;">
            <p>Hi there,</p>
            <p>Here is your <strong>quote</strong>:</p>
            <table>
              <tr><td>Price:</td><td>$30,000</td></tr>
            </table>
          </div>
        </body>
      </html>
    `;
    const result = stripHtml(html);
    assert.ok(result.includes('Hi there'));
    assert.ok(result.includes('quote'));
    assert.ok(result.includes('$30,000'));
    assert.ok(!result.includes('<'));
    assert.ok(!result.includes('font-family'));
  });
});
