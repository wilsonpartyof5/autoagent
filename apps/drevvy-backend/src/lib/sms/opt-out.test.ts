import assert from 'node:assert/strict';
import test from 'node:test';

import { ingestInboundSms } from './inbound';
import { detectSmsOptOut, normalizeSmsPhone } from './opt-out';
import { createMemorySmsStore } from './store';
import { sendSms } from './telnyx-send-gateway';

const KEYWORDS = ['STOP', 'stop', 'STOPALL', 'STOP ALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'Stop!', 'please stop'];

test('STOP-family keywords and do-not-text replies are opt-outs', () => {
  for (const text of KEYWORDS) {
    const detected = detectSmsOptOut(text);
    assert.equal(detected.optedOut, true, text);
  }
  for (const text of [
    "don't text me",
    'Don’t text me anymore',
    'do not text me',
    'dont text me',
    'please stop texting me',
    'no more texts',
    'take me off your list',
  ]) {
    assert.equal(detectSmsOptOut(text).optedOut, true, text);
  }
});

test('ordinary dealer replies are not opt-outs', () => {
  for (const text of [
    'The end of day price is 31480',
    'I can cancel the hold if the buyer waits',
    'Out the door is $28,400 including tax and title.',
    'Please call the main line',
  ]) {
    assert.equal(detectSmsOptOut(text).optedOut, false, text);
  }
  assert.equal(detectSmsOptOut('').optedOut, false);
  assert.equal(detectSmsOptOut(null).optedOut, false);
});

test('phone numbers normalize to E.164', () => {
  assert.equal(normalizeSmsPhone('(843) 555-0100'), '+18435550100');
  assert.equal(normalizeSmsPhone('18435550100'), '+18435550100');
  assert.equal(normalizeSmsPhone('+44 20 7946 0018'), '+442079460018');
  assert.equal(normalizeSmsPhone('555'), null);
});

test('an inbound opt-out immediately suppresses the number for every later thread', async () => {
  const store = createMemorySmsStore({ setting: { mode: 'never', silenceHours: null } });
  const posts: string[] = [];
  const deps = {
    store,
    fromNumber: '+18435550199',
    apiKey: 'test-key',
    now: () => new Date('2026-10-17T15:00:00.000Z'),
    tenDlcApproved: true,
    post: async (request: { text: string }) => {
      posts.push(request.text);
      return { ok: true as const, id: 'msg-1' };
    },
  };

  const first = await sendSms({ to: '+18435550100', body: 'What is the out-the-door price?', threadKey: 'deal-a' }, deps);
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.body.includes('Reply STOP to opt out'), false);

  const inbound = await ingestInboundSms(store, {
    from: '843-555-0100',
    text: 'STOP',
    vendorEventId: 'evt-1',
    occurredAt: '2026-10-17T15:05:00.000Z',
  });
  assert.equal(inbound.suppressed, true);
  assert.equal(inbound.reason, 'stop');
  assert.equal(await store.isSuppressed('+18435550100'), true);

  const sameThread = await sendSms({ to: '+18435550100', body: 'Following up.', threadKey: 'deal-a' }, deps);
  const otherThread = await sendSms({ to: '(843) 555-0100', body: 'Different car.', threadKey: 'deal-b', dealId: 'deal-b' }, deps);
  assert.deepEqual(sameThread, { ok: false, blocked: 'suppressed' });
  assert.deepEqual(otherThread, { ok: false, blocked: 'suppressed' });
  assert.equal(posts.length, 1);
});

test("a don't-text-me reply suppresses the number even when every text would include the line", async () => {
  const store = createMemorySmsStore({ setting: { mode: 'every_message', silenceHours: null } });
  let posted = 0;
  const deps = {
    store,
    fromNumber: '+18435550199',
    apiKey: 'test-key',
    post: async () => {
      posted += 1;
      return { ok: true as const, id: 'msg-2' };
    },
  };

  await ingestInboundSms(store, {
    from: '+18435550101',
    text: "Please don't text me",
    occurredAt: '2026-10-17T15:00:00.000Z',
    vendorEventId: 'evt-2',
  });

  const blocked = await sendSms({ to: '+18435550101', body: 'One more question.' }, deps);
  assert.deepEqual(blocked, { ok: false, blocked: 'suppressed' });
  assert.equal(posted, 0);
});

test('each STOP-family keyword suppresses that sender', async () => {
  for (const text of ['STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'do not text me']) {
    const store = createMemorySmsStore();
    const result = await ingestInboundSms(store, {
      from: '+18435550122',
      text,
      occurredAt: '2026-10-17T15:00:00.000Z',
    });
    assert.equal(result.suppressed, true, text);
    assert.equal(await store.isSuppressed('+18435550122'), true, text);
    const send = await sendSms(
      { to: '+18435550122', body: 'Hello' },
      {
        store,
        fromNumber: '+18435550199',
        apiKey: 'test-key',
        post: async () => {
          throw new Error('Telnyx must not be called');
        },
      },
    );
    assert.equal(send.ok, false, text);
  }
});
