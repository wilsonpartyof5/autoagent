import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  analyticsRegion,
  compactPayload,
  DREVVY_EMIT_EVENT_RPC,
  DREVVY_USER_HASH_RPC,
  emitJourneyEvent,
  hashShopperUser,
} from './journey-events';

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAFT_SQL = readFileSync(
  join(HERE, '../../../../../supabase/drafts/drevvy_service_role_journey_rpcs.sql'),
  'utf8',
);

test('analyticsRegion keeps state/DMA and drops ZIP', () => {
  assert.equal(analyticsRegion('SC'), 'SC');
  assert.equal(analyticsRegion(' Charlotte DMA '), 'Charlotte DMA');
  assert.equal(analyticsRegion('29730'), null);
  assert.equal(analyticsRegion('29730-1234'), null);
  assert.equal(analyticsRegion(null), null);
});

test('compactPayload drops nulls so optional catalog keys stay omitted', () => {
  assert.deepEqual(compactPayload({ otd_request_id: 'req-1', listing_id: null, region: undefined }), {
    otd_request_id: 'req-1',
  });
});

test('hashShopperUser calls drevvy_user_hash and never treats the raw user id as the hash', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const supabase = {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      assert.equal(fn, DREVVY_USER_HASH_RPC);
      assert.deepEqual(params, { p_user: userId });
      return { data: 'abc123hash', error: null };
    },
  };
  const result = await hashShopperUser(supabase as never, userId);
  assert.equal(result.ok, true);
  assert.equal(result.id, 'abc123hash');
  assert.notEqual(result.id, userId);
});

test('emitJourneyEvent posts catalog fields to drevvy_emit_event', async () => {
  const calls: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const supabase = {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      calls.push({ fn, params });
      return { data: 'evt-1', error: null };
    },
  };
  const result = await emitJourneyEvent(supabase as never, {
    eventType: 'otd_request.submitted',
    version: 1,
    idempotencyKey: 'otd_request.submitted:req-1',
    consumerUserId: '11111111-1111-4111-8111-111111111111',
    entityTable: 'drevvy_otd_requests',
    entityId: 'req-1',
    actor: 'shopper',
    listingSource: 'marketcheck',
    payload: { otd_request_id: 'req-1' },
    occurredAt: '2026-11-02T12:00:00.000Z',
  });
  assert.equal(result.ok, true);
  assert.equal(calls[0]?.fn, DREVVY_EMIT_EVENT_RPC);
  assert.equal(calls[0]?.params.p_event_type, 'otd_request.submitted');
  assert.equal(calls[0]?.params.p_version, 1);
  assert.equal(calls[0]?.params.p_idempotency_key, 'otd_request.submitted:req-1');
  assert.equal(calls[0]?.params.p_actor, 'shopper');
  assert.equal(calls[0]?.params.p_entity_table, 'drevvy_otd_requests');
  assert.deepEqual(calls[0]?.params.p_payload, { otd_request_id: 'req-1' });
});

test('the service_role wrapper draft is not a prod migration and grants only service_role', () => {
  assert.match(DRAFT_SQL, /DRAFT ONLY/);
  assert.match(DRAFT_SQL, /do not apply to AutoAgent prod without DW OK/);
  assert.match(DRAFT_SQL, /create or replace function public\.drevvy_user_hash/);
  assert.match(DRAFT_SQL, /create or replace function public\.drevvy_emit_event/);
  assert.match(DRAFT_SQL, /grant execute on function public\.drevvy_user_hash\(uuid\) to service_role/);
  assert.match(DRAFT_SQL, /revoke all on function public\.drevvy_emit_event/);
  assert.equal((DRAFT_SQL.match(/auth\.jwt\(\)->>'role'/g) ?? []).length, 2);
  assert.equal((DRAFT_SQL.match(/session_user <> 'service_role'/g) ?? []).length, 2);
  assert.doesNotMatch(DRAFT_SQL, /current_user\s*<>/);
  assert.doesNotMatch(DRAFT_SQL, /alter publication/);
  assert.doesNotMatch(DRAFT_SQL, /cron\./);
});
