import assert from 'node:assert/strict';
import test from 'node:test';

import { DREVVY_EMIT_EVENT_RPC, DREVVY_USER_HASH_RPC } from '@/lib/analytics/journey-events';

import {
  captureOtdValue,
  ctaTappedOtdIdempotencyKey,
  ctaTappedSubmittedFreePayload,
  memoryOtdAnalytics,
  otdSubmittedIdempotencyKey,
  otdSubmittedPayload,
  otdValueCapturedIdempotencyKey,
  otdValueCapturedPayload,
  supabaseOtdAnalytics,
  twinRowFromSubmitted,
} from './otd-analytics';
import type { OffNetworkOtdRequest } from './otd-request';

const REQUEST: OffNetworkOtdRequest = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: '11111111-1111-4111-8111-111111111111',
  listingId: 'mc-listing-9',
  listingUrl: 'https://www.cars.com/vehicledetail/9',
  dealerDomain: 'independent.example',
  marketcheckDealerId: '555',
  createdAt: '2026-11-02T12:00:00.000Z',
};

test('otd_request.submitted payload is catalog v1 with no key_spend_id', () => {
  const payload = otdSubmittedPayload({
    otdRequestId: REQUEST.id,
    listingId: REQUEST.listingId,
    dealerDomain: REQUEST.dealerDomain,
    region: '29730',
  });
  assert.deepEqual(payload, {
    otd_request_id: REQUEST.id,
    listing_id: 'mc-listing-9',
    dealer_domain: 'independent.example',
  });
  assert.equal('key_spend_id' in payload, false);
  assert.equal('listing_url' in payload, false);
  assert.equal('marketcheck_dealer_id' in payload, false);
  assert.equal(otdSubmittedIdempotencyKey(REQUEST.id), `otd_request.submitted:${REQUEST.id}`);
});

test('cta.tapped free OTD outcome is submitted_free with catalog cta_kind', () => {
  assert.deepEqual(ctaTappedSubmittedFreePayload(), {
    cta_kind: 'request_otd',
    outcome: 'submitted_free',
    network_status: 'off_network',
  });
  assert.equal(ctaTappedOtdIdempotencyKey(REQUEST.id), `cta.tapped:request_otd:${REQUEST.id}`);
});

test('the analytics twin copies request id and drops MarketCheck / listing URL', () => {
  const twin = twinRowFromSubmitted(
    { userId: REQUEST.userId, request: REQUEST, region: null, vdpMatchId: null, drevvyDealerId: null },
    'hash:shopper',
  );
  assert.equal(twin.id, REQUEST.id);
  assert.equal(twin.userHash, 'hash:shopper');
  assert.notEqual(twin.userHash, REQUEST.userId);
  assert.equal(twin.listingId, REQUEST.listingId);
  assert.equal(twin.dealerDomain, 'independent.example');
  assert.equal(twin.vdpMatchId, null);
  assert.equal(twin.drevvyDealerId, null);
  assert.equal(twin.status, 'submitted');
  assert.equal('listingUrl' in twin, false);
  assert.equal('listing_url' in twin, false);
  assert.equal('marketcheckDealerId' in twin, false);
  assert.equal('marketcheck_dealer_id' in twin, false);
});

test('memory analytics records twin + submitted + cta.tapped once per request id', async () => {
  const analytics = memoryOtdAnalytics();
  const input = { userId: REQUEST.userId, request: REQUEST };
  await analytics.recordSubmitted(input);
  await analytics.recordSubmitted(input);
  assert.equal(analytics.twins.length, 1);
  assert.equal(analytics.events.length, 2);
  assert.deepEqual(analytics.events.map((event) => event.eventType), [
    'otd_request.submitted',
    'cta.tapped',
  ]);
  assert.equal(analytics.twins[0]?.userHash, `hash:${REQUEST.userId}`);
});

test('supabase analytics hashes the shopper, inserts the twin, and emits both events', async () => {
  const inserted: Array<Record<string, unknown>> = [];
  const rpcs: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const supabase = {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcs.push({ fn, params });
      if (fn === DREVVY_USER_HASH_RPC) return { data: 'deadbeef', error: null };
      return { data: 'evt-id', error: null };
    },
    from: (table: string) => {
      assert.equal(table, 'drevvy_otd_requests');
      return {
        insert: async (row: Record<string, unknown>) => {
          inserted.push(row);
          return { error: null };
        },
      };
    },
  };

  await supabaseOtdAnalytics(supabase as never).recordSubmitted({
    userId: REQUEST.userId,
    request: REQUEST,
  });

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]?.id, REQUEST.id);
  assert.equal(inserted[0]?.user_hash, 'deadbeef');
  assert.equal(inserted[0]?.listing_id, 'mc-listing-9');
  assert.equal(inserted[0]?.status, 'submitted');
  assert.equal('listing_url' in inserted[0]!, false);
  assert.equal('marketcheck_dealer_id' in inserted[0]!, false);
  assert.deepEqual(rpcs.map((call) => call.fn), [
    DREVVY_USER_HASH_RPC,
    DREVVY_EMIT_EVENT_RPC,
    DREVVY_EMIT_EVENT_RPC,
  ]);
  assert.equal(rpcs[1]?.params.p_event_type, 'otd_request.submitted');
  assert.equal(rpcs[2]?.params.p_event_type, 'cta.tapped');
  assert.equal(
    (rpcs[1]?.params.p_payload as { otd_request_id?: string }).otd_request_id,
    REQUEST.id,
  );
  assert.equal((rpcs[2]?.params.p_payload as { outcome?: string }).outcome, 'submitted_free');
});

test('captureOtdValue updates the twin and emits value_captured for GTM later', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const rpcs: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const supabase = {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcs.push({ fn, params });
      return { data: 'evt-id', error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: REQUEST.id,
              user_hash: 'deadbeef',
              listing_id: REQUEST.listingId,
              vdp_match_id: null,
              drevvy_dealer_id: null,
              dealer_domain: REQUEST.dealerDomain,
              region: null,
              status: 'submitted',
              otd_usd: null,
              otd_itemized: null,
              otd_source: null,
              submitted_at: '2026-11-02T10:00:00.000Z',
              captured_at: null,
            },
            error: null,
          }),
        }),
      }),
      update: (row: Record<string, unknown>) => {
        updates.push(row);
        return {
          eq: async () => ({ error: null }),
        };
      },
    }),
  };

  const result = await captureOtdValue(supabase as never, {
    otdRequestId: REQUEST.id,
    otdUsd: 41250,
    source: 'gtm_outreach',
    itemized: true,
    capturedAt: new Date('2026-11-02T16:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.alreadyCaptured, false);
  assert.equal(updates[0]?.status, 'captured');
  assert.equal(updates[0]?.otd_usd, 41250);
  assert.equal(updates[0]?.otd_source, 'gtm_outreach');
  assert.equal(rpcs[0]?.fn, DREVVY_EMIT_EVENT_RPC);
  assert.equal(rpcs[0]?.params.p_event_type, 'otd_request.value_captured');
  assert.equal(rpcs[0]?.params.p_actor, 'system');
  assert.equal(rpcs[0]?.params.p_idempotency_key, otdValueCapturedIdempotencyKey(REQUEST.id));
  assert.deepEqual(rpcs[0]?.params.p_payload, otdValueCapturedPayload({
    otdRequestId: REQUEST.id,
    otdUsd: 41250,
    itemized: true,
    source: 'gtm_outreach',
    hoursSinceSubmitted: 6,
  }));
});

test('captureOtdValue rejects a public-shopper-shaped missing twin without inventing outreach', async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };
  const result = await captureOtdValue(supabase as never, {
    otdRequestId: REQUEST.id,
    otdUsd: 100,
    source: 'dealer_form',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'otd_twin_missing');
});
