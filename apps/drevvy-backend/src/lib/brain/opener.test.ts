import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SHADOW_MODE } from './config';
import {
  advanceDealerOpening,
  openingAvailabilityLine,
  openingEnablesFindSimilar,
  openingPriceLine,
  persistOpeningTurn,
  startDealerOpening,
  type OpeningVehicle,
} from './opener';
import { REPLY_DECISION_PROMPT, runReplyDecision, type ReplyDecisionInput } from './reply-decision';
import { runGuardrails } from './guardrails';
import { blankLifecycle, canFindSimilar } from '../shopper/lifecycle';
import { createMemoryLifecycleRepository } from '../shopper/lifecycle-store';
import type { ShopperDeal } from '../shopper/deals';

const AT = '2026-10-19T15:00:00.000Z';
const LATER = '2026-10-19T16:00:00.000Z';

const deal: ShopperDeal = {
  id: 'deal-123',
  listingId: 'mc-listing-9',
  status: 'interested',
  outreachLockedUntilPaid: true,
  vehicle: { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'XLE', price: 34990, vin: '1HGBH41JXMN109186' },
  createdAt: AT,
  updatedAt: AT,
};

const vehicle: OpeningVehicle = {
  year: 2024,
  make: 'Toyota',
  model: 'RAV4',
  trim: 'XLE',
  stock: 'A1234',
  vin: '1HGBH41JXMN109186',
  listedPrice: 34990,
  listingId: 'mc-listing-9',
  daysOnMarket: 12,
};

function started() {
  return startDealerOpening({
    record: blankLifecycle(deal, 'shopper-1'),
    vehicle,
    shopperFirst: 'Maya',
    channel: 'email',
    at: AT,
  });
}

test('the first message asks only about this vehicle and keeps the short intro', () => {
  const turn = started();
  const line = 'Hi, this is Drevvy, working for Maya. Is the 2024 Toyota RAV4 XLE, stock #A1234, VIN 1HGBH41JXMN109186, still available?';
  assert.equal(turn.draft, line);
  assert.equal(openingAvailabilityLine('Maya', vehicle, 'email'), line);
  assert.equal(turn.draft?.includes('$'), false);
  assert.equal(/out-the-door|negotiat/i.test(turn.draft ?? ''), false);
  assert.equal(turn.record.opening?.marketcheckListingId, 'mc-listing-9');
  assert.equal(turn.record.opening?.listedPrice, 34990);
  assert.equal(turn.record.opening?.listedPriceCopiedAt, AT);
  assert.equal(turn.record.opening?.listedPriceIncludedAt, null);
  assert.equal(turn.record.opening?.phase, 'awaiting_availability');
  assert.equal(turn.shadowMode, SHADOW_MODE);
  assert.equal(turn.guardrailResult.blocked, false);
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'opener.ts'), 'utf8');
  assert.equal(source.includes('marketcheck/cache'), false);
  assert.equal(source.includes('loadMarketCheck'), false);
});

test('a yes sends the listed price next, and a stale or changed price uses the current-price wording', () => {
  const fresh = advanceDealerOpening({
    record: started().record,
    vehicle,
    dealerMessage: 'Yes, that one is still available.',
    shopperFirst: 'Maya',
    channel: 'email',
    at: LATER,
    hasOptedInToText: true,
    hasTextedBefore: true,
  });
  assert.equal(fresh.draft, 'Is it still listed at $34,990?');
  assert.equal(fresh.kind, 'ask_price');
  assert.equal(fresh.record.opening?.availability, 'available');
  assert.equal(fresh.record.opening?.availabilityAt, LATER);
  assert.equal(fresh.record.opening?.listedPriceIncludedAt, null);

  const committed = {
    ...fresh.record,
    opening: {
      ...fresh.record.opening!,
      listedPriceIncludedAt: LATER,
      history: [
        ...fresh.record.opening!.history,
        { at: LATER, direction: 'outbound' as const, body: fresh.draft!, listedPrice: 34990 },
      ],
    },
  };
  assert.equal(committed.opening.history.some((item) => item.listedPrice === 34990 && item.body.includes('$34,990')), true);

  const old = advanceDealerOpening({
    record: started().record,
    vehicle: { ...vehicle, daysOnMarket: 60 },
    dealerMessage: 'Yes, we still have it.',
    shopperFirst: 'Maya',
    channel: 'email',
    at: LATER,
    hasOptedInToText: true,
    hasTextedBefore: true,
  });
  assert.equal(old.draft, 'We see $34,990 listed. Is that still current?');
  assert.equal(openingPriceLine({ ...vehicle, daysOnMarket: 4, priceChangedRecently: true }), old.draft);
  assert.equal(/negotiat/i.test(old.draft ?? ''), false);
  assert.equal(old.guardrailResult.checks.noShopperContactInfo, true);
});

test('one reply that answers both skips the price question and stores the stated price', async () => {
  const lifecycle = createMemoryLifecycleRepository();
  const turn = advanceDealerOpening({
    record: started().record,
    vehicle,
    dealerMessage: 'Yes it is available, still listed at $32,500.',
    shopperFirst: 'Maya',
    channel: 'email',
    at: LATER,
    hasOptedInToText: true,
    hasTextedBefore: true,
  });
  assert.equal(turn.draft, null);
  assert.equal(turn.kind, 'done');
  assert.equal(turn.record.opening?.availability, 'available');
  assert.equal(turn.record.opening?.statedPrice, 32500);
  assert.equal(turn.record.opening?.statedPriceAt, LATER);
  assert.equal(turn.record.opening?.listedPriceIncludedAt, null);
  assert.equal(turn.record.opening?.phase, 'complete');
  assert.equal(turn.record.opening?.history.some((item) => item.direction === 'outbound' && item.listedPrice != null), false);

  const saved = await persistOpeningTurn(turn, { lifecycle, at: LATER });
  const loaded = await lifecycle.get('shopper-1', 'deal-123');
  assert.equal(loaded?.opening?.statedPrice, 32500);
  assert.equal(loaded?.opening?.marketcheckListingId, 'mc-listing-9');
  assert.equal(saved.opening?.availabilityAt, LATER);
  assert.equal(saved.endState, 'open');
});

test('an unavailable vehicle follows the sold path so find similar is available', async () => {
  const lifecycle = createMemoryLifecycleRepository();
  const turn = advanceDealerOpening({
    record: started().record,
    vehicle,
    dealerMessage: 'Sorry, that RAV4 sold this morning.',
    shopperFirst: 'Maya',
    channel: 'email',
    at: LATER,
    hasOptedInToText: true,
    hasTextedBefore: true,
  });
  assert.equal(turn.followSold, true);
  assert.equal(turn.draft, null);
  assert.equal(turn.record.opening?.availability, 'unavailable');
  const saved = await persistOpeningTurn(turn, { lifecycle, at: LATER });
  assert.equal(saved.endState, 'sold');
  assert.equal(canFindSimilar(saved.endState), true);
  assert.equal(openingEnablesFindSimilar(saved), true);
  assert.equal((await lifecycle.getById('deal-123'))?.endState, 'sold');
  assert.equal((await lifecycle.getById('deal-123'))?.opening?.availability, 'unavailable');
});

test('confirming the asked price stores that amount, and a different amount replaces it', () => {
  const asked = advanceDealerOpening({
    record: started().record,
    vehicle,
    dealerMessage: 'Yes, still here.',
    shopperFirst: 'Maya',
    channel: 'email',
    at: LATER,
    hasOptedInToText: true,
    hasTextedBefore: true,
  });
  const withQuestion = {
    ...asked.record,
    opening: {
      ...asked.record.opening!,
      listedPriceIncludedAt: LATER,
      history: [
        ...asked.record.opening!.history,
        { at: LATER, direction: 'outbound' as const, body: asked.draft!, listedPrice: 34990 },
      ],
    },
  };
  const yes = advanceDealerOpening({
    record: withQuestion,
    vehicle,
    dealerMessage: 'Yes.',
    shopperFirst: 'Maya',
    channel: 'email',
    at: '2026-10-19T17:00:00.000Z',
    hasOptedInToText: true,
    hasTextedBefore: true,
  });
  assert.equal(yes.draft, null);
  assert.equal(yes.record.opening?.statedPrice, 34990);
  assert.equal(yes.record.opening?.phase, 'complete');

  const changed = advanceDealerOpening({
    record: withQuestion,
    vehicle,
    dealerMessage: 'No, it is $33,100 now.',
    shopperFirst: 'Maya',
    channel: 'email',
    at: '2026-10-19T17:00:00.000Z',
    hasOptedInToText: true,
    hasTextedBefore: true,
  });
  assert.equal(changed.record.opening?.statedPrice, 33100);
  assert.equal(changed.draft, null);
});

test('a text without consent does not send the price question', () => {
  const turn = advanceDealerOpening({
    record: started().record,
    vehicle,
    dealerMessage: 'Yes, it is available.',
    shopperFirst: 'Maya',
    channel: 'sms',
    at: LATER,
    hasOptedInToText: false,
    hasTextedBefore: false,
  });
  assert.equal(turn.draft, null);
  assert.equal(turn.guardrailResult.violations.includes('no_cold_texts'), true);
  assert.equal(turn.record.opening?.listedPriceIncludedAt, null);
  assert.equal(turn.record.opening?.availability, 'available');
});

test('reply decision asks the price in shadow mode and does not call the model for a plain yes', async () => {
  const lifecycle = createMemoryLifecycleRepository();
  const first = started();
  await lifecycle.save(first.record);
  const { client, calls } = mockOpenAI(async () => {
    throw new Error('the model should not write the opening question');
  });
  const result = await runReplyDecision(mockSupabase(), client, {
    ...decisionInput('Yes, still available.'),
    opening: {
      record: first.record,
      vehicle,
      at: LATER,
      lifecycle,
    },
  });
  assert.equal(calls.length, 0);
  assert.equal(result.draft, 'Is it still listed at $34,990?');
  assert.equal(result.sideEffect, null);
  assert.equal(result.shadowMode, true);
  assert.equal(result.openingFollowUp, 'ask_price');
  assert.equal(result.openingRecord?.opening?.listedPriceIncludedAt, LATER);
  assert.equal(result.openingRecord?.opening?.marketcheckListingId, 'mc-listing-9');
  const guard = runGuardrails({
    action: 'clarify',
    draft: result.draft,
    dealerMessage: 'Yes, still available.',
    channel: 'email',
    hasOptedInToText: true,
    hasTextedBefore: true,
    fairOtd: null,
    currentOfferOtd: null,
    pushbackCount: 0,
    shopperFirst: 'Maya',
  });
  assert.equal(guard.blocked, false);
  assert.match(REPLY_DECISION_PROMPT, /asks only whether that vehicle is still available/);
  assert.match(REPLY_DECISION_PROMPT, /Is it still listed at \$X\?/);
  assert.match(REPLY_DECISION_PROMPT, /We see \$X listed\. Is that still current\?/);
  assert.match(REPLY_DECISION_PROMPT, /do not send the price question/);
  assert.match(REPLY_DECISION_PROMPT, /find similar cars/);
});

test('a bot question still gets the honest sentence, not the price question', async () => {
  const lifecycle = createMemoryLifecycleRepository();
  const first = started();
  const { client, calls } = mockOpenAI(async () => {
    throw new Error('a direct bot question does not go to the model');
  });
  const result = await runReplyDecision(mockSupabase(), client, {
    ...decisionInput('Are you a bot? Yes, the RAV4 is still available.'),
    opening: { record: first.record, vehicle, at: LATER, lifecycle },
  });
  assert.equal(calls.length, 0);
  assert.equal(result.draft, "I'm Drevvy's AI, working for Maya.");
  assert.equal(result.sideEffect, null);
  assert.equal(/negotiat/i.test(result.draft ?? ''), false);
  assert.equal(result.openingRecord?.opening?.availability, 'available');
  assert.equal(result.openingRecord?.opening?.listedPriceIncludedAt, null);
  assert.equal((await lifecycle.get('shopper-1', 'deal-123'))?.opening?.listedPrice, 34990);
});

test('a combined reply skips the second question inside the reply loop', async () => {
  const lifecycle = createMemoryLifecycleRepository();
  const first = started();
  const { client, calls } = mockOpenAI(async () => {
    throw new Error('a price and a yes do not need a model to choose the next question');
  });
  const result = await runReplyDecision(mockSupabase(), client, {
    ...decisionInput('Yes, available, listed at $32,500.'),
    opening: { record: first.record, vehicle, at: LATER, lifecycle },
  });
  assert.equal(calls.length, 0);
  assert.equal(result.draft, null);
  assert.equal(result.decision, 'skip');
  assert.equal(result.sideEffect, null);
  assert.equal((await lifecycle.get('shopper-1', 'deal-123'))?.opening?.statedPrice, 32500);
  assert.equal((await lifecycle.get('shopper-1', 'deal-123'))?.opening?.listedPriceIncludedAt, null);
});

function decisionInput(message: string): ReplyDecisionInput {
  return {
    dealId: 'deal-123',
    dealerId: 'dealer-1',
    dealerState: 'TX',
    channel: 'email',
    dealerMessage: message,
    dealContext: {
      shopperFirst: 'Maya',
      vehicle: '2024 Toyota RAV4 XLE',
      fairOtd: null,
      currentOfferOtd: null,
      pushbackCount: 0,
      hasOptedInToText: true,
      hasTextedBefore: true,
      isItemized: false,
    },
  };
}

function mockOpenAI(
  handler: (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => Promise<OpenAI.Responses.Response>,
) {
  const calls: OpenAI.Responses.ResponseCreateParamsNonStreaming[] = [];
  const client = {
    responses: {
      create: async (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => {
        calls.push(params);
        return handler(params);
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

function mockSupabase(): SupabaseClient {
  const query = {
    insert() { return query; },
    update() { return query; },
    select() { return query; },
    eq() { return query; },
    or() { return query; },
    order() { return query; },
    single() { return Promise.resolve({ data: { id: 'run-1' }, error: null }); },
    then(resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    },
  };
  return { from() { return query; } } as unknown as SupabaseClient;
}
