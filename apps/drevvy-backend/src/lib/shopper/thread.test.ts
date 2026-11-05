import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import { postShopperThreadMessage, readShopperThread } from './thread';

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
