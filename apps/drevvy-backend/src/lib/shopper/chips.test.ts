import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

const ITEMIZED = 'Price $30,000, doc fee $499, tax $1,800, title $75, registration $210.';
const ITEMIZED_TOTAL = `${ITEMIZED} Out-the-door total: $32,584.`;
const CONFIRM_OTD = 'Just confirming: the out-the-door total you sent is $32,584, including all dealer fees, tax and registration. Is that correct?';
const CONFIRM_LEASE = 'And just confirming: total due at signing is $2,500?';
const WARM_STAY = 'Happy to come in once we have the numbers. Could you send the itemized out-the-door so Dana can plan the visit?';

test('T13 confirms a dealer itemized OTD total and stays hidden without one', () => {
  const shown = suggestShopperChips({
    messages: [
      { author: 'drevvy', body: 'Dana wants your best itemized out-the-door' },
      { author: 'salesperson', body: ITEMIZED_TOTAL },
    ],
  });
  assert.equal(shown.stage, 'after_itemized_otd');
  assert.equal(shown.autoSend, false);
  assert.equal(shown.chips[0]?.id, 'T13');
  assert.equal(shown.chips[0]?.label, 'Confirm OTD');
  assert.equal(shown.chips[0]?.message, CONFIRM_OTD);
  assert.equal(shown.chips[0]?.sendsAutomatically, false);
  assert.equal(shown.chips[0]?.label.length <= CHIP_LABEL_LIMIT, true);
  assert.equal(shown.chips[0]?.message.length <= CHIP_BODY_LIMIT, true);
  assert.equal(shown.chips.some((chip) => chip.id === 'T13b' || chip.id === 'STAY'), false);

  const linesOnly = suggestShopperChips({
    stage: 'after_itemized_otd',
    messages: [{ author: 'dealer', body: ITEMIZED }],
    intel: INTEL,
  });
  assert.equal(linesOnly.chips.some((chip) => chip.id === 'T13'), false);

  const bareTotal = suggestShopperChips({
    messages: [{ author: 'salesperson', body: 'Out-the-door total is $32,000.' }],
    intel: { otdTotal: 32000 },
  });
  assert.equal(bareTotal.stage, 'after_price');
  assert.equal(bareTotal.chips.some((chip) => chip.id === 'T13'), false);
});

test('T13b confirms lease due at signing and stays hidden otherwise', () => {
  const lease = suggestShopperChips({
    messages: [{
      author: 'salesperson',
      body: `${ITEMIZED_TOTAL} This is a lease. Total due at signing is $2,500.`,
    }],
  });
  assert.deepEqual(
    lease.chips.map((chip) => chip.id).slice(0, 2),
    ['T13', 'T13b'],
  );
  assert.equal(lease.chips.find((chip) => chip.id === 'T13b')?.label, 'Confirm lease due');
  assert.equal(lease.chips.find((chip) => chip.id === 'T13b')?.message, CONFIRM_LEASE);
  assert.equal(lease.chips.every((chip) => chip.sendsAutomatically === false), true);

  const cash = suggestShopperChips({
    stage: 'after_itemized_otd',
    intel: { ...INTEL, otdTotal: 32584, dueAtSigning: 2500, lease: false },
  });
  assert.equal(cash.chips.some((chip) => chip.id === 'T13'), true);
  assert.equal(cash.chips.some((chip) => chip.id === 'T13b'), false);

  const missingDue = suggestShopperChips({
    stage: 'after_itemized_otd',
    intel: { ...INTEL, otdTotal: 32584, lease: true },
  });
  assert.equal(missingDue.chips.some((chip) => chip.id === 'T13b'), false);
  assert.equal(missingDue.chips[0]?.id, 'T13');
  assert.equal(missingDue.chips[1]?.id, 'T7');
});

test('a come-in push offers the warm stay chip and does not send it', () => {
  const pushed = suggestShopperChips({
    messages: [
      { author: 'drevvy', body: 'Dana wants your best itemized out-the-door' },
      { author: 'salesperson', body: 'Please come in today.' },
    ],
  });
  assert.equal(pushed.chips[0]?.id, 'STAY');
  assert.equal(pushed.chips[0]?.label, 'Numbers first');
  assert.equal(pushed.chips[0]?.message, WARM_STAY);
  assert.equal(pushed.chips[0]?.sendsAutomatically, false);
  assert.equal(pushed.autoSend, false);
  assert.equal(pushed.chips[0]?.message.length <= CHIP_BODY_LIMIT, true);
  assert.equal(pushed.chips.some((chip) => chip.id === 'T6'), true);

  const unnamed = suggestShopperChips({
    messages: [{ author: 'dealer', body: 'Come on in and we will talk numbers.' }],
  });
  assert.equal(unnamed.chips.some((chip) => chip.id === 'STAY'), false);

  const afterNumbers = suggestShopperChips({
    messages: [
      { author: 'drevvy', body: 'Dana wants your best itemized out-the-door' },
      { author: 'salesperson', body: `${ITEMIZED_TOTAL} Please come in today.` },
    ],
  });
  assert.equal(afterNumbers.chips.some((chip) => chip.id === 'STAY'), false);
  assert.equal(afterNumbers.chips[0]?.id, 'T13');
});

test('held Wait-DW lines and scour copy are not in the shopper source', () => {
  const held = [
    ['mark which items', 'are optional'].join(' '),
    ['Hey Adam, is stock', '#17646'].join(' '),
    ['the car is', 'dying'].join(' '),
    ['shopping other', 'dealers'].join(' '),
    ["I'm shopping", 'other'].join(' '),
  ];
  const roots = [
    join(process.cwd(), 'src'),
    join(process.cwd(), '../drevvy-app/lib'),
    join(process.cwd(), '../drevvy-app/test'),
  ];
  const files: string[] = [];
  for (const root of roots) walkSource(root, files);
  assert.equal(files.length > 0, true);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const phrase of held) {
      assert.equal(text.toLowerCase().includes(phrase.toLowerCase()), false, `${file} contains ${phrase}`);
    }
  }
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

  const confirmed = await suggestDealChips('shopper-1', 'deal-1', {}, {
    deals,
    supabase: fakeConversation({
      deal_id: 'deal-1',
      otd_itemized_at: '2026-10-28T12:00:00.000Z',
      written_otd_cents: 3258400,
      shopper_first_name: 'Dana Blake',
      come_in_count: 2,
      opener: 'Dana wants your best itemized out-the-door',
    }, [
      { author: 'salesperson', body: `${ITEMIZED_TOTAL} Lease. Total due at signing: $2,500.` },
    ]) as unknown as SupabaseClient,
  });
  assert.equal(confirmed.autoSend, false);
  assert.equal(confirmed.stage, 'after_itemized_otd');
  assert.equal(confirmed.chips.find((chip) => chip.id === 'T13')?.message, CONFIRM_OTD);
  assert.equal(confirmed.chips.find((chip) => chip.id === 'T13b')?.message, CONFIRM_LEASE);
  assert.equal(confirmed.chips.some((chip) => chip.id === 'STAY'), false);
  assert.equal(confirmed.chips.every((chip) => chip.sendsAutomatically === false), true);
});

function walkSource(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.dart_tool' || name === 'build') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walkSource(path, out);
      continue;
    }
    if (/\.(ts|tsx|dart)$/.test(name)) out.push(path);
  }
}

function fakeConversation(row: Record<string, unknown> | null, messages: Array<Record<string, unknown>> = []) {
  return {
    from(table: string) {
      if (table === 'shopper_dealer_messages') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit() {
                        return Promise.resolve({ data: messages, error: null });
                      },
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
