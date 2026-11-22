import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import { MemoryRateLimitStore } from '@/lib/public-discover/rate-limit';

import { ShopperDealError } from './deals';
import { postShopperThreadMessage, readShopperThread } from './thread';
import {
  SHOPPER_MESSAGE_DAY_COPY,
  SHOPPER_MESSAGE_DEAL_PER_MINUTE,
  SHOPPER_MESSAGE_MINUTE_COPY,
  SHOPPER_MESSAGE_USER_PER_DAY,
  SHOPPER_MESSAGE_USER_PER_MINUTE,
  SHOPPER_READ_PER_MINUTE,
  shopperMessageLimitWindows,
  shopperReadLimitWindow,
} from './thread-rate-limit';

const USER = '11111111-1111-4111-8111-111111111111';
const DEAL = '22222222-2222-4222-8222-222222222222';

test('shopper thread round-trips on the message table and hides contact fields', async () => {
  const messages: Array<Record<string, unknown>> = [{
    id: 'opener-1',
    author: 'drevvy',
    kind: 'opener',
    body: 'Dana wants your best itemized out-the-door',
    sent_at: '2026-11-05T22:00:00.000Z',
  }];
  const client = {
    from(table: string) {
      if (table === 'shopper_dealer_conversations') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        deal_id: DEAL,
                        consumer_user_id: USER,
                        shopper_first_name: 'Dana Blake',
                        opener: 'Dana wants your best itemized out-the-door',
                        channel: 'in_app_message',
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      return {
        select() {
          return {
            eq() {
              return Promise.resolve({ data: messages.map((row) => ({ ...row })), error: null });
            },
          };
        },
        async insert(data: Record<string, unknown>) {
          assert.equal(table, 'shopper_dealer_messages');
          assert.equal(data.author, 'shopper');
          messages.push({ id: 'shopper-1', ...data });
          return { error: null };
        },
      };
    },
  };

  const posted = await postShopperThreadMessage(
    client as unknown as SupabaseClient,
    USER,
    DEAL,
    'Is the car still there?',
  );
  assert.equal(posted.shopperFirstName, 'Dana');
  assert.equal(posted.channel, 'in_app_message');
  assert.equal(posted.messages.some((message) => message.body === 'Is the car still there?'), true);
  assert.equal(JSON.stringify(posted).includes('Blake'), false);
  assert.equal(JSON.stringify(posted).includes('@'), false);

  messages.push({
    id: 'dealer-1',
    author: 'salesperson',
    kind: 'chat',
    body: 'Yes, it is here.',
    sent_at: '2026-11-05T22:05:00.000Z',
  });
  const read = await readShopperThread(client as unknown as SupabaseClient, USER, DEAL);
  assert.equal(read.messages.some((message) => message.author === 'salesperson' && message.body === 'Yes, it is here.'), true);
  assert.equal(Object.keys(read).some((key) => /phone|email|address|last/i.test(key)), false);
});

test('another shopper and a non-chat channel cannot use the live thread', async () => {
  function client(channel: string) {
    return {
      from(table: string) {
        if (table !== 'shopper_dealer_conversations') {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          select(columns: string) {
            assert.equal(columns.includes('email'), false);
            assert.equal(columns.includes('phone'), false);
            assert.equal(columns.includes('last_name'), false);
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        deal_id: DEAL,
                        consumer_user_id: USER,
                        shopper_first_name: 'Dana Blake',
                        opener: 'Dana wants your best itemized out-the-door',
                        channel,
                        email: 'dana@example.com',
                        phone: '555-010-1212',
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  await assert.rejects(
    () => readShopperThread(client('in_app_message') as unknown as SupabaseClient, 'someone-else', DEAL),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'not_found',
  );
  await assert.rejects(
    () => readShopperThread(client('off_network') as unknown as SupabaseClient, USER, DEAL),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'not_chat',
  );
});

const USER_B = '33333333-3333-4333-8333-333333333333';
const DEAL_B = '44444444-4444-4444-8444-444444444444';
const DEAL_C = '55555555-5555-4555-8555-555555555555';
const MINUTE = Date.parse('2026-11-22T15:00:00.000Z');

function messageClient(owner: string) {
  const inserts: Array<Record<string, unknown>> = [];
  let reads = 0;
  const messages: Array<Record<string, unknown>> = [];
  return {
    inserts,
    reads: () => reads,
    from(table: string) {
      reads += 1;
      if (table === 'shopper_dealer_conversations') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        deal_id: DEAL,
                        consumer_user_id: owner,
                        shopper_first_name: 'Dana Blake',
                        opener: 'Dana wants your best itemized out-the-door',
                        channel: 'in_app_message',
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table !== 'shopper_dealer_messages') throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            eq() {
              return Promise.resolve({ data: messages.map((row) => ({ ...row })), error: null });
            },
          };
        },
        async insert(data: Record<string, unknown>) {
          inserts.push(data);
          messages.push({ id: `m-${inserts.length}`, ...data });
          return { error: null };
        },
      };
    },
  };
}

function post(
  client: ReturnType<typeof messageClient>,
  userId: string,
  dealId: string,
  store: MemoryRateLimitStore,
  nowMs: number,
  text = 'Is the car still there?',
) {
  return postShopperThreadMessage(
    client as unknown as SupabaseClient,
    userId,
    dealId,
    text,
    new Date(nowMs),
    { store, nowMs },
  );
}

test('shopper message limits are per user and per deal and do not insert when blocked', async () => {
  assert.equal(SHOPPER_MESSAGE_USER_PER_MINUTE, 20);
  assert.equal(SHOPPER_MESSAGE_USER_PER_DAY, 200);
  assert.equal(SHOPPER_MESSAGE_DEAL_PER_MINUTE, 10);
  for (const window of shopperMessageLimitWindows(USER, DEAL)) {
    assert.equal(window.bucket.length >= 8 && window.bucket.length <= 180, true);
  }
  const userWindows = shopperMessageLimitWindows(USER, DEAL_B);
  assert.equal(userWindows[0]?.bucket, shopperMessageLimitWindows(USER, DEAL)[0]?.bucket);
  assert.notEqual(userWindows[2]?.bucket, shopperMessageLimitWindows(USER, DEAL)[2]?.bucket);
  assert.notEqual(shopperMessageLimitWindows(USER_B, DEAL)[0]?.bucket, userWindows[0]?.bucket);

  const dana = messageClient(USER);
  const other = messageClient(USER_B);
  const posted = await post(dana, USER, DEAL, new MemoryRateLimitStore(), MINUTE);
  assert.equal(posted.messages.some((message) => message.body === 'Is the car still there?'), true);
  await assert.rejects(
    () => post(dana, USER, DEAL, new MemoryRateLimitStore(), MINUTE, '   '),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'empty_message',
  );

  const dealStore = new MemoryRateLimitStore();
  const dealDana = messageClient(USER);
  const dealOther = messageClient(USER_B);
  for (let i = 0; i < SHOPPER_MESSAGE_DEAL_PER_MINUTE; i += 1) {
    await post(dealDana, USER, DEAL, dealStore, MINUTE);
  }
  await assert.rejects(
    () => post(dealDana, USER, DEAL, dealStore, MINUTE),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 429
      && error.code === 'rate_limited'
      && error.message === SHOPPER_MESSAGE_MINUTE_COPY,
  );
  assert.equal(dealDana.inserts.length, SHOPPER_MESSAGE_DEAL_PER_MINUTE);
  await assert.rejects(
    () => post(dealOther, USER_B, DEAL, dealStore, MINUTE),
    (error: unknown) => error instanceof ShopperDealError && error.status === 429,
  );
  assert.equal(dealOther.inserts.length, 0);
  await post(dealDana, USER, DEAL_B, dealStore, MINUTE);
  assert.equal(dealDana.inserts.length, SHOPPER_MESSAGE_DEAL_PER_MINUTE + 1);

  const userStore = new MemoryRateLimitStore();
  const userDana = messageClient(USER);
  for (let i = 0; i < SHOPPER_MESSAGE_DEAL_PER_MINUTE; i += 1) {
    await post(userDana, USER, DEAL, userStore, MINUTE);
    await post(userDana, USER, DEAL_B, userStore, MINUTE);
  }
  await assert.rejects(
    () => post(userDana, USER, DEAL_C, userStore, MINUTE),
    (error: unknown) => error instanceof ShopperDealError && error.status === 429,
  );
  assert.equal(userDana.inserts.length, SHOPPER_MESSAGE_USER_PER_MINUTE);
  for (let i = 0; i < SHOPPER_MESSAGE_DEAL_PER_MINUTE; i += 1) {
    await post(other, USER_B, DEAL_C, userStore, MINUTE);
  }
  await post(other, USER_B, 'deal-other', userStore, MINUTE);
  assert.equal(other.inserts.length, SHOPPER_MESSAGE_DEAL_PER_MINUTE + 1);
});

test('a shopper message day limit stops the insert', async () => {
  const store = new MemoryRateLimitStore();
  const dana = messageClient(USER);
  let sent = 0;
  for (let minute = 0; minute < SHOPPER_MESSAGE_USER_PER_DAY / SHOPPER_MESSAGE_USER_PER_MINUTE; minute += 1) {
    for (let slot = 0; slot < SHOPPER_MESSAGE_USER_PER_MINUTE / SHOPPER_MESSAGE_DEAL_PER_MINUTE; slot += 1) {
      for (let n = 0; n < SHOPPER_MESSAGE_DEAL_PER_MINUTE; n += 1) {
        await post(dana, USER, `day-${minute}-${slot}`, store, MINUTE + minute * 60_000);
        sent += 1;
      }
    }
  }
  assert.equal(sent, SHOPPER_MESSAGE_USER_PER_DAY);
  await assert.rejects(
    () => post(dana, USER, 'day-final', store, MINUTE + 10 * 60_000),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 429
      && error.message === SHOPPER_MESSAGE_DAY_COPY,
  );
  assert.equal(dana.inserts.length, SHOPPER_MESSAGE_USER_PER_DAY);
});

test('reading a thread allows about fifteen polls a minute and then says to wait', async () => {
  assert.equal(SHOPPER_READ_PER_MINUTE, 60);
  const window = shopperReadLimitWindow(USER, 'messages');
  assert.equal(window.limit, 60);
  assert.equal(window.bucket.length >= 8 && window.bucket.length <= 180, true);
  assert.notEqual(shopperReadLimitWindow(USER, 'messages').bucket, shopperReadLimitWindow(USER, 'chips').bucket);

  const store = new MemoryRateLimitStore();
  const dana = messageClient(USER);
  const other = messageClient(USER_B);
  for (let i = 0; i < SHOPPER_READ_PER_MINUTE; i += 1) {
    const thread = await readShopperThread(dana as unknown as SupabaseClient, USER, DEAL, { store, nowMs: MINUTE });
    assert.equal(thread.id, DEAL);
  }
  const reads = dana.reads();
  await assert.rejects(
    () => readShopperThread(dana as unknown as SupabaseClient, USER, DEAL, { store, nowMs: MINUTE }),
    (error: unknown) => error instanceof ShopperDealError
      && error.status === 429
      && error.message === SHOPPER_MESSAGE_MINUTE_COPY,
  );
  assert.equal(dana.reads(), reads);
  const still = await readShopperThread(other as unknown as SupabaseClient, USER_B, DEAL, { store, nowMs: MINUTE });
  assert.equal(still.shopperFirstName, 'Dana');
});
