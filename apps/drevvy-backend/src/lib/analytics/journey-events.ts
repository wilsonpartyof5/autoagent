import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Thin client for Analytics journey RPCs.
 *
 * Prod functions live in `private` (`private.drevvy_emit_event`,
 * `private.drevvy_user_hash`) and are not executable by `service_role`.
 * Call the public wrappers of the same names once
 * `supabase/drafts/drevvy_service_role_journey_rpcs.sql` is applied (DW OK).
 * Do not apply that file from this PR.
 */
export const DREVVY_EMIT_EVENT_RPC = 'drevvy_emit_event';
export const DREVVY_USER_HASH_RPC = 'drevvy_user_hash';

export type JourneyActor = 'shopper' | 'agent' | 'dealer' | 'system';
export type JourneyListingSource = 'marketcheck' | 'dealer_feed';

export type EmitJourneyEventInput = {
  eventType: string;
  version: number;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  consumerUserId?: string | null;
  shopperDealId?: string | null;
  dealerId?: string | null;
  entityTable?: string | null;
  entityId?: string | null;
  actor?: JourneyActor | null;
  listingSource?: JourneyListingSource | null;
  region?: string | null;
  occurredAt?: string | Date | null;
};

export type JourneyRpcResult = {
  ok: boolean;
  id: string | null;
  error: string | null;
};

const ZIP = /^\d{5}(?:-\d{4})?$/;

/** State / DMA only. Never persist a ZIP as region. */
export function analyticsRegion(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || ZIP.test(trimmed)) return null;
  return trimmed;
}

export function compactPayload(
  payload: Record<string, unknown | null | undefined>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

export async function hashShopperUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<JourneyRpcResult> {
  const { data, error } = await supabase.rpc(DREVVY_USER_HASH_RPC, { p_user: userId });
  if (error) {
    return { ok: false, id: null, error: error.message };
  }
  if (typeof data !== 'string' || !data) {
    return { ok: false, id: null, error: 'user_hash_missing' };
  }
  return { ok: true, id: data, error: null };
}

export async function emitJourneyEvent(
  supabase: SupabaseClient,
  input: EmitJourneyEventInput,
): Promise<JourneyRpcResult> {
  const { data, error } = await supabase.rpc(DREVVY_EMIT_EVENT_RPC, {
    p_event_type: input.eventType,
    p_version: input.version,
    p_idempotency_key: input.idempotencyKey,
    p_consumer_user_id: input.consumerUserId ?? null,
    p_shopper_deal_id: input.shopperDealId ?? null,
    p_dealer_id: input.dealerId ?? null,
    p_entity_table: input.entityTable ?? null,
    p_entity_id: input.entityId ?? null,
    p_actor: input.actor ?? null,
    p_listing_source: input.listingSource ?? null,
    p_region: analyticsRegion(input.region),
    p_payload: input.payload,
    p_occurred_at: occurredAtIso(input.occurredAt),
  });
  if (error) {
    return { ok: false, id: null, error: error.message };
  }
  if (typeof data !== 'string' || !data) {
    return { ok: false, id: null, error: 'event_id_missing' };
  }
  return { ok: true, id: data, error: null };
}

function occurredAtIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}
