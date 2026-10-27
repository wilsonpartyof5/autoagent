import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ShopperDealError, type ShopperDealRepository, type ShopperDealRow } from './deals';
import {
  CHIP_BODY_LIMIT,
  CHIP_LABEL_LIMIT,
  chipCopyAllowed,
  suggestDealChips,
  suggestShopperChips,
} from './chips';

const INTEL = {
  stockNumber: 'R44118',
  listedPrice: 33240,
  fairPrice: 31900,
  compsCount: 6,
  compsLowPrice: 30500,
  dom: 42,
  feature: 'heated seats',
  rep: 'Jordan Hale',
  visitDay: 'Saturday',
  visitTime: '2pm',
  itemizedOtdInThread: true,
};

test('after the opener the shopper sees T6 then T1, and nothing sends itself', () => {
  const set = suggestShopperChips({ stage: 'after_opener', intel: { ...INTEL, itemizedOtdInThread: false } });
  assert.equal(set.autoSend, false);
  assert.deepEqual(set.chips.map((chip) => chip.id), ['T6', 'T1']);
  assert.equal(set.chips[0]?.message, 'Could you share the itemized out-the-door price? Price, dealer fees, tax, title and reg.');
  assert.equal(set.chips[1]?.message, 'Hi Jordan, is stock #R44118 still available?');
  assert.equal(set.chips.every((chip) => chip.sendsAutomatically === false), true);
  assert.equal(set.chips.every((chip) => chip.label.length <= CHIP_LABEL_LIMIT && chip.message.length <= CHIP_BODY_LIMIT), true);
});

test('missing stock hides T1 and a missing rep drops the name', () => {
  const set = suggestShopperChips({
    stage: 'after_opener',
    intel: { stockNumber: null },
  });
  assert.deepEqual(set.chips.map((chip) => chip.id), ['T6']);
  const priced = suggestShopperChips({
    stage: 'after_availability',
    intel: { listedPrice: 32900 },
  });
  assert.equal(priced.chips.find((chip) => chip.id === 'T2')?.message, 'Thanks! Is it still listed at $32,900?');
  assert.equal(priced.chips.find((chip) => chip.id === 'T2')?.message.includes('Jordan'), false);
});

test('market chips use exact figures when present and the spec fallback when not', () => {
  const exact = suggestShopperChips({ stage: 'after_price', intel: { ...INTEL, itemizedOtdInThread: false } });
  assert.deepEqual(exact.chips.map((chip) => chip.id), ['T6', 'T4', 'T5', 'T7']);
  assert.equal(
    exact.chips.find((chip) => chip.id === 'T4')?.message,
    'I see 6 similar cars nearby from $30,500. What makes this one stand out?',
  );
  assert.equal(exact.chips.find((chip) => chip.id === 'T5')?.message, 'This one has been listed about 42 days. Is there any price update?');
  assert.equal(
    suggestShopperChips({ stage: 'after_price', intel: INTEL }).chips.some((chip) => chip.id === 'T6'),
    false,
  );

  const fallback = suggestShopperChips({ stage: 'after_price', intel: {} });
  assert.equal(fallback.chips.find((chip) => chip.id === 'T4')?.message, 'I see similar cars nearby. What makes this one stand out?');
  assert.equal(fallback.chips.find((chip) => chip.id === 'T5')?.message, 'This one has been listed a while. Is there any price update?');
  assert.equal(fallback.chips.some((chip) => chip.message.includes('$')), false);

  const partial = suggestShopperChips({
    stage: 'after_availability',
    intel: { listedPrice: 33240 },
  });
  assert.equal(
    partial.chips.find((chip) => chip.id === 'T3')?.message,
    'Similar cars seem to be priced lower. How was this price set?',
  );
  const both = suggestShopperChips({
    stage: 'after_availability',
    intel: { listedPrice: 33240, fairPrice: 31900 },
  });
  assert.equal(
    both.chips.find((chip) => chip.id === 'T3')?.message,
    'Market data shows a fair price near $31,900. How was the $33,240 price set?',
  );
});

test('itemized OTD unlocks thanks, questions, trade-in, and a visit, and blocks haggle copy', () => {
  const set = suggestShopperChips({ stage: 'after_itemized_otd', intel: INTEL });
  assert.deepEqual(set.chips.map((chip) => chip.id), ['T7', 'T8', 'T9', 'T10', 'T11', 'T12']);
  assert.equal(set.chips.find((chip) => chip.id === 'T7')?.message, 'Thanks Jordan, that helps!');
  assert.equal(set.chips.find((chip) => chip.id === 'T9')?.message, 'Quick question: does it have heated seats?');
  assert.equal(set.chips.find((chip) => chip.id === 'T12')?.message, "I'd like to see it. Is Saturday at 2pm open?");
  const hidden = suggestShopperChips({
    stage: 'after_itemized_otd',
    intel: { feature: 'let us negotiate', visitDay: 'Saturday' },
  });
  assert.equal(hidden.chips.some((chip) => chip.id === 'T9' || chip.id === 'T12'), false);
  assert.equal(chipCopyAllowed('We should negotiate the price.'), false);
  assert.equal(set.chips.some((chip) => /negotiat|haggl|bargain/i.test(chip.message)), false);
});

test('a price reply moves the stage, and off-network deals get no chips', async () => {
  const priced = suggestShopperChips({
    messages: [
      { author: 'drevvy', body: 'Dana wants your best itemized out-the-door' },
      { author: 'salesperson', body: 'Yes, it is still listed at $33,240.' },
    ],
    intel: { dom: 12, compsCount: 4, compsLowPrice: 31000 },
  });
  assert.equal(priced.stage, 'after_price');
  assert.equal(priced.chips[0]?.id, 'T6');

  const deals: Pick<ShopperDealRepository, 'get'> = {
    async get(): Promise<ShopperDealRow | null> {
      return null;
    },
  };
  await assert.rejects(
    () => suggestDealChips('shopper-1', 'deal-1', {}, {
      deals,
      supabase: fakeConversation(null) as unknown as SupabaseClient,
    }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'not_found',
  );
});

test('an in-network deal returns opener chips from the vehicle snapshot', async () => {
  const deals: Pick<ShopperDealRepository, 'get'> = {
    async get(userId, dealId): Promise<ShopperDealRow | null> {
      return {
        id: dealId,
        consumerUserId: userId,
        listingId: 'mc-listing-1',
        status: 'interested',
        outreachLockedUntilPaid: true,
        vehicle: { year: 2024, make: 'Honda', model: 'CR-V', price: 32900, daysOnMarket: 18 },
        createdAt: '2026-10-27T00:00:00.000Z',
        updatedAt: '2026-10-27T00:00:00.000Z',
      };
    },
  };
  await assert.rejects(
    () => suggestDealChips('shopper-1', 'deal-1', {}, {
      deals,
      supabase: fakeConversation(null) as unknown as SupabaseClient,
    }),
    (error: unknown) => error instanceof ShopperDealError && error.code === 'off_network',
  );

  const set = await suggestDealChips('shopper-1', 'deal-1', {
    intel: { stockNumber: 'H24118' },
  }, {
    deals,
    supabase: fakeConversation({ deal_id: 'deal-1', otd_itemized_at: null }) as unknown as SupabaseClient,
  });
  assert.equal(set.autoSend, false);
  assert.equal(set.stage, 'after_opener');
  assert.deepEqual(set.chips.map((chip) => chip.templateId), ['T6', 'T1']);
  assert.equal(set.chips[1]?.message, 'Hi, is stock #H24118 still available?');
});

function fakeConversation(row: Record<string, unknown> | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: row, error: null };
                    },
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
