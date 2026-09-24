import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  NEGOTIATION_CASE_WRITE_TABLES,
  POLICY_V1_RULES,
  assertGenericStateTool,
  assertNegotiationTransition,
  buildNegotiationEvents,
  buildVehicleMarketContext,
  makeShopperAliasCode,
  projectCaseForDealer,
  selectActivePolicy,
  type ShopperMandate,
} from '../src/negotiation.ts';

const mandate: ShopperMandate = {
  version: 2,
  approvedAt: '2026-09-24T00:00:00.000Z',
  maxPrice: 28000,
  questions: ['Email me at shopper@example.com or call 803-555-1212'],
  tradeIn: '2018 Honda',
};

test('a deal cannot skip the approved mandate', () => {
  assert.throws(
    () => assertNegotiationTransition({
      from: 'draft',
      to: 'ready_for_dealer',
      mandateApproved: true,
      policy: POLICY_V1_RULES,
    }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'invalid_transition',
  );
  assert.throws(
    () => assertNegotiationTransition({
      from: 'mandate_approved',
      to: 'ready_for_dealer',
      mandateApproved: false,
      policy: POLICY_V1_RULES,
    }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'mandate_required',
  );
  assert.doesNotThrow(() => assertNegotiationTransition({
    from: 'mandate_approved',
    to: 'ready_for_dealer',
    mandateApproved: true,
    policy: POLICY_V1_RULES,
  }));
});

test('a pinned policy can refuse a move the code table allows', () => {
  assert.throws(
    () => assertNegotiationTransition({
      from: 'draft',
      to: 'closed_lost',
      mandateApproved: false,
      policy: { ...POLICY_V1_RULES, allowedTransitions: [] },
    }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'policy_denied',
  );
});

test('the generic state tool cannot approve or reopen a mandate', () => {
  assert.throws(
    () => assertGenericStateTool('mandate_approved'),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'use_mandate_tool',
  );
});

test('opening a case does not write a lead', () => {
  const writes = NEGOTIATION_CASE_WRITE_TABLES.join(',');
  assert.equal(writes.includes('lead'), false);
  assert.equal(NEGOTIATION_CASE_WRITE_TABLES.includes('negotiation_cases'), true);
});

test('the dealer view uses the alias and strips contact text', () => {
  const hidden = projectCaseForDealer({
    negotiationCaseId: 'case-1',
    shopperAlias: 'A8F21',
    listingId: 'listing-1',
    vin: 'VIN123',
    dealershipId: 'dealer-1',
    state: 'mandate_approved',
    outcome: null,
    policyVersion: 1,
    mandate,
    market: null,
  });
  assert.equal(hidden, null);

  const visible = projectCaseForDealer({
    negotiationCaseId: 'case-1',
    shopperAlias: 'A8F21',
    listingId: 'listing-1',
    vin: 'VIN123',
    dealershipId: 'dealer-1',
    state: 'ready_for_dealer',
    outcome: null,
    policyVersion: 1,
    mandate,
    market: null,
  });
  const encoded = JSON.stringify(visible);
  assert.equal(encoded.includes('shopper@example.com'), false);
  assert.equal(encoded.includes('803-555-1212'), false);
  assert.equal(encoded.includes('consumerUserId'), false);
  assert.equal(encoded.includes('email'), false);
  assert.equal(visible?.shopperAlias, 'A8F21');
  assert.match(visible?.mandate?.questions?.[0] ?? '', /\[redacted\]/);
});

test('a price change is recorded only against a previous context', () => {
  const first = buildVehicleMarketContext({
    listingId: 'listing-1',
    askingPrice: 25000,
    priceChangeCount: 2,
    compPrices: [24000, 25000, 26000],
    mileage: 40000,
    compMileages: [38000, 42000],
    availability: 'available',
  });
  assert.equal(first.priceChanged, false);
  assert.equal(first.marketPosition, 'at_market');
  assert.equal(first.confidence, 'medium');

  const next = buildVehicleMarketContext({
    listingId: 'listing-1',
    askingPrice: 23000,
    previousAskingPrice: 25000,
    compPrices: [24000, 26000],
    availability: 'sold',
  });
  assert.equal(next.priceChanged, true);
  assert.equal(next.previousAskingPrice, 25000);
  assert.equal(next.inventoryExpired, true);
  assert.equal(next.marketPosition, 'below_market');
});

test('domain events carry ids and no contact fields', () => {
  const events = buildNegotiationEvents({
    negotiationCaseId: 'case-1',
    consumerUserId: 'user-1',
    listingId: 'listing-1',
    vin: 'VIN123',
    dealershipId: 'dealer-1',
    policyVersion: 1,
    from: null,
    to: 'draft',
    includeCreated: true,
    includeMandateApproved: false,
    market: buildVehicleMarketContext({
      listingId: 'listing-1',
      askingPrice: 23000,
      previousAskingPrice: 25000,
    }),
  });
  assert.deepEqual(events.map((event) => event.eventName), [
    'negotiation_created',
    'negotiation_state_changed',
    'vehicle_price_changed',
  ]);
  const encoded = JSON.stringify(events);
  assert.equal(encoded.includes('@'), false);
  assert.equal(encoded.includes('phone'), false);
});

test('the active policy is the highest version inside its window', () => {
  const selected = selectActivePolicy([
    {
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      rules: POLICY_V1_RULES,
    },
    {
      version: 2,
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      effectiveTo: '2026-07-01T00:00:00.000Z',
      rules: POLICY_V1_RULES,
    },
  ], new Date('2026-09-24T00:00:00.000Z'));
  assert.equal(selected?.version, 1);
});

test('alias codes avoid ambiguous characters', () => {
  const code = makeShopperAliasCode(() => 0);
  assert.equal(code, 'AAAAA');
  assert.equal(/[01IO]/.test(makeShopperAliasCode(() => 31)), false);
});

test('the case service never writes a lead or calls ADF', () => {
  const source = readFileSync(
    new URL('../../../apps/dealer-dashboard/src/lib/negotiation/cases.ts', import.meta.url),
    'utf8',
  );
  assert.equal(/from\(['"]leads['"]\)/.test(source), false);
  assert.equal(source.includes('lead_delivery'), false);
  assert.equal(source.includes('adf'), false);
});

test('the database seed stores the same version 1 rules', () => {
  const sql = readFileSync(
    new URL('../../../apps/dealer-dashboard/supabase/migrations/20260924_negotiation_domain.sql', import.meta.url),
    'utf8',
  );
  const match = sql.match(/\$policy\$(.*)\$policy\$/s);
  assert.ok(match);
  assert.deepEqual(JSON.parse(match[1]), POLICY_V1_RULES);
});
