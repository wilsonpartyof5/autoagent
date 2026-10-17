import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemorySmsStore } from './store';
import { sendSms } from './telnyx-send-gateway';

test('the gateway appends the line from the setting and keeps a suppressed number dark', async () => {
  let now = new Date('2026-10-17T12:00:00.000Z');
  const store = createMemorySmsStore();
  const posts: string[] = [];
  const deps = {
    store,
    fromNumber: '+18435550199',
    apiKey: 'test-key',
    now: () => now,
    post: async (request: { text: string; to: string }) => {
      posts.push(`${request.to} ${request.text}`);
      return { ok: true as const, id: `id-${posts.length}` };
    },
  };

  const first = await sendSms({ to: '843-555-0100', body: 'Out-the-door price?', threadKey: 'deal-1' }, deps);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.optOutLineAppended, true);
    assert.equal(first.body.endsWith('Reply STOP to opt out'), true);
    assert.equal(/negotiat/i.test(first.body), false);
  }

  now = new Date('2026-10-17T13:00:00.000Z');
  const second = await sendSms({ to: '+18435550100', body: 'Still hoping for that price.', threadKey: 'deal-1' }, deps);
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.optOutLineAppended, false);

  store.setSetting({ mode: 'every_message', silenceHours: null });
  const every = await sendSms({ to: '+18435550100', body: 'Checking once more.', threadKey: 'deal-1' }, deps);
  assert.equal(every.ok, true);
  if (every.ok) assert.equal(every.body.endsWith('Reply STOP to opt out'), true);

  store.setSetting({ mode: 'first_message_per_thread', silenceHours: 6 });
  now = new Date('2026-10-17T20:00:00.000Z');
  const afterSilence = await sendSms({ to: '+18435550100', body: 'After a quiet stretch.', threadKey: 'deal-1' }, deps);
  assert.equal(afterSilence.ok, true);
  if (afterSilence.ok) assert.equal(afterSilence.optOutLineAppended, true);

  store.setSetting({ mode: 'never', silenceHours: 1 });
  const other = await sendSms({ to: '+18435550108', body: 'New thread.', threadKey: 'deal-2' }, deps);
  assert.equal(other.ok, true);
  if (other.ok) {
    assert.equal(other.optOutLineAppended, false);
    assert.equal(other.body, 'New thread.');
  }

  await store.suppress({ phone: '+18435550108', reason: 'stop', rawText: 'STOP' });
  const blocked = await sendSms({ to: '+18435550108', body: 'This must not send.', threadKey: 'deal-9' }, deps);
  assert.deepEqual(blocked, { ok: false, blocked: 'suppressed' });
  assert.equal(posts.some((line) => line.includes('This must not send')), false);
});

test('a send without a configured from-number does not call Telnyx', async () => {
  let called = false;
  const result = await sendSms(
    { to: '+18435550100', body: 'Hello' },
    {
      store: createMemorySmsStore(),
      fromNumber: null,
      apiKey: 'test-key',
      post: async () => {
        called = true;
        return { ok: true, id: 'nope' };
      },
    },
  );
  assert.deepEqual(result, { ok: false, blocked: 'not_configured' });
  assert.equal(called, false);
});

test('a number that cannot be checked is not texted', async () => {
  const store = createMemorySmsStore();
  store.isSuppressed = async () => {
    throw new Error('down');
  };
  let called = false;
  const result = await sendSms(
    { to: '+18435550100', body: 'Hello' },
    {
      store,
      fromNumber: '+18435550199',
      apiKey: 'test-key',
      post: async () => {
        called = true;
        return { ok: true, id: 'nope' };
      },
    },
  );
  assert.deepEqual(result, { ok: false, blocked: 'suppression_unavailable' });
  assert.equal(called, false);
});
