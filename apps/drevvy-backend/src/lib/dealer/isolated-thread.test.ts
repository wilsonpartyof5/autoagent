import assert from 'node:assert/strict';
import test from 'node:test';

import { POST as openFixture } from '../../app/api/consumer/fixture/threads/route';
import { GET as readShopperMessages, POST as postShopperMessages } from '../../app/api/consumer/deals/[id]/messages/route';
import { GET as dealerInbox } from '../../app/api/dealer/v1/inbox/route';
import { POST as dealerMessage } from '../../app/api/dealer/v1/leads/[leadId]/messages/route';
import { POST as dealerNumbers } from '../../app/api/dealer/v1/leads/[leadId]/numbers/route';
import { OTD_REMOVAL_NOTICE } from './otd-warnings';
import {
  FIXTURE_LABEL,
  isolatedRooftopRemoved,
  isolatedWarningCount,
  openIsolatedThread,
  postIsolatedDealerMessage,
  postIsolatedShopperMessage,
  resetIsolatedThreads,
  shareIsolatedItemized,
} from './isolated-thread';

const LINES = {
  vehiclePriceCents: 3_000_000,
  docFeeCents: 49_900,
  taxCents: 180_000,
  titleCents: 15_000,
  registrationCents: 21_000,
};

function walk(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.equal(
        ['phone', 'email', 'address', 'lastname', 'last_name', 'vin', 'consumeruserid'].includes(key.toLowerCase()),
        false,
        `${path}.${key}`,
      );
      walk(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string') {
    assert.equal(value.includes('@'), false, path);
    assert.equal(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(value), false, path);
    assert.equal(/Blake|555|street/i.test(value), false, path);
  }
}

test('isolated round trip, privacy, off-network fence, itemized OTD, and removal', { concurrency: false }, async () => {
  resetIsolatedThreads();
  const off = openIsolatedThread({
    firstName: 'Dana Blake',
    email: 'dana@example.com',
    phone: '555-010-1212',
    address: '1 Main Street',
    network: 'off_network',
  });
  assert.equal(off.ok, false);
  if (off.ok) return;
  assert.equal(off.error.code, 'not_chat');
  assert.equal(isolatedRooftopRemoved(), false);

  const opened = openIsolatedThread({
    firstName: 'Dana Blake',
    lastName: 'Blake',
    email: 'dana@example.com',
    phone: '555-010-1212',
    address: '1 Main Street',
    zip: '29730',
    financing: false,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.thread.source, 'test-owned');
  assert.equal(opened.thread.persistence, 'isolated-preview-file');
  assert.equal(opened.thread.liveSystems, false);
  assert.equal(opened.thread.fixtureLabel, FIXTURE_LABEL);
  assert.equal(opened.thread.shopperFirstName, 'Dana');
  assert.equal(opened.thread.opener, 'Dana wants your best itemized out-the-door');
  assert.equal(opened.thread.channel, 'in_app_message');
  walk(opened.thread, 'open');

  const financed = openIsolatedThread({
    firstName: 'Dana',
    financing: true,
    zip: '29730',
  });
  assert.equal(financed.ok, true);
  if (!financed.ok) return;
  assert.equal(financed.thread.opener, 'Dana wants your best itemized out-the-door. ZIP 29730');
  walk(financed.thread, 'zip');

  const shopper = postIsolatedShopperMessage(opened.thread.id, 'Is the CR-V still available?');
  assert.equal(shopper.ok, true);
  if (!shopper.ok) return;
  const dealer = postIsolatedDealerMessage(opened.thread.id, 'Yes, it is still here.');
  assert.equal(dealer.ok, true);
  if (!dealer.ok) return;
  assert.equal(dealer.data.otdWarningCount, 1);
  assert.match(dealer.data.messages.find((message) => message.body.startsWith('Warning '))?.body ?? '', /Warning 1 of 3: Dana asked/);
  const retry = postIsolatedDealerMessage(opened.thread.id, 'Yes, it is still here.');
  assert.equal(retry.ok, true);
  if (!retry.ok) return;
  assert.equal(isolatedWarningCount(opened.thread.id), 1);
  const seen = postIsolatedShopperMessage(opened.thread.id, 'Thanks');
  assert.equal(seen.ok, true);
  if (!seen.ok) return;
  const bodies = seen.thread.messages.map((message) => message.body);
  assert.equal(bodies.some((body) => body === 'Is the CR-V still available?'), true);
  assert.equal(bodies.some((body) => body === 'Yes, it is still here.'), true);
  walk(seen.thread, 'round');

  const keyed = postIsolatedDealerMessage(opened.thread.id, 'We can go over fees.', new Date(), 'strike-key');
  assert.equal(keyed.ok, true);
  if (!keyed.ok) return;
  assert.equal(keyed.data.otdWarningCount, 2);
  const keyedAgain = postIsolatedDealerMessage(opened.thread.id, 'Different words.', new Date(), 'strike-key');
  assert.equal(keyedAgain.ok, true);
  if (!keyedAgain.ok) return;
  assert.equal(keyedAgain.data.otdWarningCount, 2);

  const itemized = shareIsolatedItemized(financed.thread.id, LINES, '');
  assert.equal(itemized.ok, true);
  if (!itemized.ok) return;
  assert.equal(itemized.data.otdWarningCount ?? 0, 0);
  assert.equal(itemized.data.messages.some((message) => message.body.startsWith('Warning ')), false);
  assert.equal(itemized.data.stage, 'numbers_shared');

  const thirdHome = openIsolatedThread({ firstName: 'Sam' });
  assert.equal(thirdHome.ok, true);
  if (!thirdHome.ok) return;
  for (const body of ['Here.', 'Still here.', 'No worksheet yet.']) {
    const posted = postIsolatedDealerMessage(thirdHome.thread.id, body);
    assert.equal(posted.ok, true);
  }
  assert.equal(isolatedWarningCount(thirdHome.thread.id), 3);
  assert.equal(isolatedRooftopRemoved(), true);
  const removedThread = postIsolatedShopperMessage(thirdHome.thread.id, 'Hello again');
  assert.equal(removedThread.ok, true);
  if (!removedThread.ok) return;
  assert.equal(removedThread.thread.messages.some((message) => message.body === OTD_REMOVAL_NOTICE), true);
  assert.equal(removedThread.thread.networkRemoved, true);
  const blocked = openIsolatedThread({ firstName: 'Riley' });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.error.code, 'network_removed');
  walk(removedThread.thread, 'removed');
});

test('fixture HTTP routes label test-owned data and stay closed without the flag', { concurrency: false }, async () => {
  resetIsolatedThreads();
  const hidden = await openFixture(new Request('http://desk.local/api/consumer/fixture/threads', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Dana' }),
  }));
  assert.equal(hidden.status, 404);
  const env = process.env as Record<string, string | undefined>;
  const previousFixture = env.DEALER_THREAD_FIXTURE;
  const previousNode = env.NODE_ENV;
  const previousPreview = env.DEALER_PREVIEW;
  env.NODE_ENV = 'test';
  env.DEALER_THREAD_FIXTURE = '1';
  env.DEALER_PREVIEW = '1';
  try {
    const closed = await openFixture(new Request('http://desk.local/api/consumer/fixture/threads', {
      method: 'POST',
      body: JSON.stringify({ firstName: 'Dana Blake', network: 'off_network', email: 'dana@example.com' }),
    }));
    assert.equal(closed.status, 409);

    const opened = await openFixture(new Request('http://desk.local/api/consumer/fixture/threads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Dana Blake',
        lastName: 'Blake',
        email: 'dana@example.com',
        phone: '555-010-1212',
        address: '1 Main Street',
      }),
    }));
    assert.equal(opened.status, 200);
    const openedBody = await opened.json() as { source: string; data: { id: string; opener: string; shopperFirstName: string } };
    assert.equal(openedBody.source, 'test-owned');
    assert.equal(openedBody.data.opener, 'Dana wants your best itemized out-the-door');
    assert.equal(openedBody.data.shopperFirstName, 'Dana');
    walk(openedBody, 'http-open');

    const sent = await postShopperMessages(new Request('http://desk.local/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-drevvy-fixture': 'isolated' },
      body: JSON.stringify({ body: 'Is it available?', email: 'dana@example.com' }),
    }), { params: Promise.resolve({ id: openedBody.data.id }) });
    assert.equal(sent.status, 200);

    const inbox = await dealerInbox(new Request('http://desk.local/api/dealer/v1/inbox?filter=all'));
    assert.equal(inbox.status, 200);
    const inboxBody = await inbox.json() as { items: Array<{ id: string; fixtureLabel?: string; shopperFirstName: string }> };
    const row = inboxBody.items.find((item) => item.id === openedBody.data.id);
    assert.equal(row?.shopperFirstName, 'Dana');
    assert.equal(row?.fixtureLabel, FIXTURE_LABEL);

    const reply = await dealerMessage(new Request('http://desk.local/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Yes, it is here.', idempotencyKey: 'http-1' }),
    }), { params: Promise.resolve({ leadId: openedBody.data.id }) });
    assert.equal(reply.status, 200);
    const replyAgain = await dealerMessage(new Request('http://desk.local/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Second try', idempotencyKey: 'http-1' }),
    }), { params: Promise.resolve({ leadId: openedBody.data.id }) });
    const againBody = await replyAgain.json() as { conversation: { otdWarningCount?: number; messages: Array<{ body: string }> } };
    assert.equal(againBody.conversation.otdWarningCount, 1);
    assert.equal(againBody.conversation.messages.some((message) => message.body === 'Second try'), false);

    const shopperView = await readShopperMessages(new Request('http://desk.local/messages', {
      headers: { 'x-drevvy-fixture': 'isolated' },
    }), { params: Promise.resolve({ id: openedBody.data.id }) });
    const shopperBody = await shopperView.json() as { source: string; data: { messages: Array<{ body: string }> } };
    assert.equal(shopperBody.source, 'test-owned');
    assert.equal(shopperBody.data.messages.some((message) => message.body === 'Is it available?'), true);
    assert.equal(shopperBody.data.messages.some((message) => message.body === 'Yes, it is here.'), true);
    walk(shopperBody, 'http-shopper');

    const numbers = await dealerNumbers(new Request('http://desk.local/numbers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: LINES, note: '' }),
    }), { params: Promise.resolve({ leadId: openedBody.data.id }) });
    assert.equal(numbers.status, 200);
    const numbersBody = await numbers.json() as { source: string; conversation: { messages: Array<{ body: string }> } };
    assert.equal(numbersBody.source, 'test-owned');
    assert.equal(numbersBody.conversation.messages.some((message) => message.body.includes('Vehicle price:')), true);
  } finally {
    if (previousFixture === undefined) delete env.DEALER_THREAD_FIXTURE;
    else env.DEALER_THREAD_FIXTURE = previousFixture;
    if (previousNode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNode;
    if (previousPreview === undefined) delete env.DEALER_PREVIEW;
    else env.DEALER_PREVIEW = previousPreview;
    resetIsolatedThreads();
  }
});
