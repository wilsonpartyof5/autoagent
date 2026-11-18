import type { SupabaseClient } from '@supabase/supabase-js';

import {
  analyticsRegion,
  compactPayload,
  emitJourneyEvent,
  hashShopperUser,
  type EmitJourneyEventInput,
} from '@/lib/analytics/journey-events';

import type { OffNetworkOtdRequest } from './otd-request';

export const OTD_TWIN_TABLE = 'drevvy_otd_requests';
export const CATALOG_CTA_KIND_REQUEST_OTD = 'request_otd';

export const OTD_VALUE_SOURCES = ['gtm_outreach', 'dealer_form', 'shopper_upload'] as const;
export type OtdValueSource = (typeof OTD_VALUE_SOURCES)[number];

export type OtdTwinRow = {
  id: string;
  userHash: string;
  listingId: string;
  vdpMatchId: string | null;
  drevvyDealerId: string | null;
  dealerDomain: string | null;
  region: string | null;
  status: string;
  otdUsd: number | null;
  otdItemized: boolean | null;
  otdSource: OtdValueSource | null;
  submittedAt: string;
  capturedAt: string | null;
};

export type OtdSubmittedAnalyticsInput = {
  userId: string;
  request: OffNetworkOtdRequest;
  region?: string | null;
  vdpMatchId?: string | null;
  drevvyDealerId?: string | null;
};

export type JourneyEmitCall = EmitJourneyEventInput;

export interface OtdAnalytics {
  recordSubmitted(input: OtdSubmittedAnalyticsInput): Promise<void>;
}

export function otdSubmittedIdempotencyKey(otdRequestId: string): string {
  return `otd_request.submitted:${otdRequestId}`;
}

export function ctaTappedOtdIdempotencyKey(otdRequestId: string): string {
  return `cta.tapped:${CATALOG_CTA_KIND_REQUEST_OTD}:${otdRequestId}`;
}

export function otdValueCapturedIdempotencyKey(otdRequestId: string): string {
  return `otd_request.value_captured:${otdRequestId}`;
}

/** Catalog v0.9.1 `otd_request.submitted` v1. Free CTA — never `key_spend_id`. */
export function otdSubmittedPayload(input: {
  otdRequestId: string;
  listingId?: string | null;
  vdpMatchId?: string | null;
  drevvyDealerId?: string | null;
  dealerDomain?: string | null;
  region?: string | null;
}): Record<string, unknown> {
  return compactPayload({
    otd_request_id: input.otdRequestId,
    listing_id: input.listingId,
    vdp_match_id: input.vdpMatchId,
    drevvy_dealer_id: input.drevvyDealerId,
    dealer_domain: input.dealerDomain,
    region: analyticsRegion(input.region),
  });
}

/** Catalog `cta.tapped` v1 for a free off-network OTD submit. */
export function ctaTappedSubmittedFreePayload(): Record<string, unknown> {
  return {
    cta_kind: CATALOG_CTA_KIND_REQUEST_OTD,
    outcome: 'submitted_free',
    network_status: 'off_network',
  };
}

/** Catalog `otd_request.value_captured` v1. */
export function otdValueCapturedPayload(input: {
  otdRequestId: string;
  otdUsd: number;
  itemized?: boolean | null;
  source?: OtdValueSource | null;
  hoursSinceSubmitted?: number | null;
}): Record<string, unknown> {
  return compactPayload({
    otd_request_id: input.otdRequestId,
    otd_usd: input.otdUsd,
    itemized: input.itemized,
    source: input.source,
    hours_since_submitted: input.hoursSinceSubmitted,
  });
}

export function twinRowFromSubmitted(input: OtdSubmittedAnalyticsInput, userHash: string): OtdTwinRow {
  return {
    id: input.request.id,
    userHash,
    listingId: input.request.listingId,
    vdpMatchId: input.vdpMatchId ?? null,
    drevvyDealerId: input.drevvyDealerId ?? null,
    dealerDomain: input.request.dealerDomain,
    region: analyticsRegion(input.region),
    status: 'submitted',
    otdUsd: null,
    otdItemized: null,
    otdSource: null,
    submittedAt: input.request.createdAt,
    capturedAt: null,
  };
}

export function submittedJourneyEvents(
  input: OtdSubmittedAnalyticsInput,
): JourneyEmitCall[] {
  const otdRequestId = input.request.id;
  const region = analyticsRegion(input.region);
  const base = {
    version: 1 as const,
    consumerUserId: input.userId,
    shopperDealId: null,
    dealerId: input.drevvyDealerId ?? null,
    entityTable: OTD_TWIN_TABLE,
    entityId: otdRequestId,
    actor: 'shopper' as const,
    listingSource: 'marketcheck' as const,
    region,
    occurredAt: input.request.createdAt,
  };
  return [
    {
      ...base,
      eventType: 'otd_request.submitted',
      idempotencyKey: otdSubmittedIdempotencyKey(otdRequestId),
      payload: otdSubmittedPayload({
        otdRequestId,
        listingId: input.request.listingId,
        vdpMatchId: input.vdpMatchId,
        drevvyDealerId: input.drevvyDealerId,
        dealerDomain: input.request.dealerDomain,
        region,
      }),
    },
    {
      ...base,
      eventType: 'cta.tapped',
      idempotencyKey: ctaTappedOtdIdempotencyKey(otdRequestId),
      payload: ctaTappedSubmittedFreePayload(),
    },
  ];
}

export function memoryOtdAnalytics(hashUser: (userId: string) => string = (userId) => `hash:${userId}`): OtdAnalytics & {
  twins: OtdTwinRow[];
  events: JourneyEmitCall[];
} {
  const twins: OtdTwinRow[] = [];
  const events: JourneyEmitCall[] = [];
  return {
    twins,
    events,
    async recordSubmitted(input) {
      const existing = twins.find((row) => row.id === input.request.id);
      if (!existing) twins.push(twinRowFromSubmitted(input, hashUser(input.userId)));
      for (const event of submittedJourneyEvents(input)) {
        if (events.some((row) => row.idempotencyKey === event.idempotencyKey)) continue;
        events.push(event);
      }
    },
  };
}

export function supabaseOtdAnalytics(supabase: SupabaseClient): OtdAnalytics {
  return {
    async recordSubmitted(input) {
      const hashed = await hashShopperUser(supabase, input.userId);
      if (!hashed.ok || !hashed.id) {
        throw new Error(hashed.error ?? 'user_hash_failed');
      }
      await insertOtdTwin(supabase, twinRowFromSubmitted(input, hashed.id));
      for (const event of submittedJourneyEvents(input)) {
        const emitted = await emitJourneyEvent(supabase, event);
        if (!emitted.ok) {
          throw new Error(emitted.error ?? `${event.eventType}_failed`);
        }
      }
    },
  };
}

export type CaptureOtdValueInput = {
  otdRequestId: string;
  otdUsd: number;
  source: OtdValueSource;
  itemized?: boolean | null;
  capturedAt?: Date;
};

export type CaptureOtdValueResult = {
  ok: boolean;
  alreadyCaptured: boolean;
  twin: OtdTwinRow | null;
  event: JourneyEmitCall | null;
  error: string | null;
};

/**
 * Internal GTM / ops helper. Updates the analytics twin to `captured` and
 * emits `otd_request.value_captured`. Not a shopper API and not dealer outreach.
 */
export async function captureOtdValue(
  supabase: SupabaseClient,
  input: CaptureOtdValueInput,
): Promise<CaptureOtdValueResult> {
  if (!Number.isInteger(input.otdUsd) || input.otdUsd <= 0) {
    return { ok: false, alreadyCaptured: false, twin: null, event: null, error: 'invalid_otd_usd' };
  }
  if (!OTD_VALUE_SOURCES.includes(input.source)) {
    return { ok: false, alreadyCaptured: false, twin: null, event: null, error: 'invalid_otd_source' };
  }

  const existing = await loadOtdTwin(supabase, input.otdRequestId);
  if (!existing) {
    return { ok: false, alreadyCaptured: false, twin: null, event: null, error: 'otd_twin_missing' };
  }

  const capturedAt = (input.capturedAt ?? new Date()).toISOString();
  const alreadyCaptured = existing.status === 'captured';
  const twin: OtdTwinRow = {
    ...existing,
    status: 'captured',
    otdUsd: input.otdUsd,
    otdItemized: input.itemized ?? existing.otdItemized,
    otdSource: input.source,
    capturedAt,
  };

  if (!alreadyCaptured) {
    const { error } = await supabase
      .from(OTD_TWIN_TABLE)
      .update({
        status: 'captured',
        otd_usd: twin.otdUsd,
        otd_itemized: twin.otdItemized,
        otd_source: twin.otdSource,
        captured_at: twin.capturedAt,
      })
      .eq('id', input.otdRequestId);
    if (error) {
      return { ok: false, alreadyCaptured: false, twin: existing, event: null, error: error.message };
    }
  }

  const hoursSinceSubmitted = hoursBetween(existing.submittedAt, capturedAt);
  const event: JourneyEmitCall = {
    eventType: 'otd_request.value_captured',
    version: 1,
    idempotencyKey: otdValueCapturedIdempotencyKey(input.otdRequestId),
    consumerUserId: null,
    shopperDealId: null,
    dealerId: twin.drevvyDealerId,
    entityTable: OTD_TWIN_TABLE,
    entityId: input.otdRequestId,
    actor: 'system',
    listingSource: 'marketcheck',
    region: twin.region,
    occurredAt: capturedAt,
    payload: otdValueCapturedPayload({
      otdRequestId: input.otdRequestId,
      otdUsd: input.otdUsd,
      itemized: twin.otdItemized,
      source: input.source,
      hoursSinceSubmitted,
    }),
  };
  const emitted = await emitJourneyEvent(supabase, event);
  if (!emitted.ok) {
    return { ok: false, alreadyCaptured, twin, event, error: emitted.error };
  }
  return { ok: true, alreadyCaptured, twin, event, error: null };
}

export async function recordSubmittedAnalyticsSafely(
  analytics: OtdAnalytics | undefined,
  input: OtdSubmittedAnalyticsInput,
): Promise<void> {
  if (!analytics) return;
  try {
    await analytics.recordSubmitted(input);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'otd_analytics_failed',
      otdRequestId: input.request.id,
      listingId: input.request.listingId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
}

function twinInsertRow(row: OtdTwinRow): Record<string, unknown> {
  return {
    id: row.id,
    user_hash: row.userHash,
    listing_id: row.listingId,
    vdp_match_id: row.vdpMatchId,
    drevvy_dealer_id: row.drevvyDealerId,
    dealer_domain: row.dealerDomain,
    region: row.region,
    status: row.status,
    submitted_at: row.submittedAt,
  };
}

async function insertOtdTwin(supabase: SupabaseClient, row: OtdTwinRow): Promise<void> {
  const payload = twinInsertRow(row);
  const { error } = await supabase.from(OTD_TWIN_TABLE).insert(payload);
  if (!error) return;
  if (error.code === '23505') return;
  throw new Error(error.message);
}

async function loadOtdTwin(supabase: SupabaseClient, id: string): Promise<OtdTwinRow | null> {
  const { data, error } = await supabase
    .from(OTD_TWIN_TABLE)
    .select('id, user_hash, listing_id, vdp_match_id, drevvy_dealer_id, dealer_domain, region, status, otd_usd, otd_itemized, otd_source, submitted_at, captured_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    userHash: data.user_hash,
    listingId: data.listing_id,
    vdpMatchId: data.vdp_match_id,
    drevvyDealerId: data.drevvy_dealer_id,
    dealerDomain: data.dealer_domain,
    region: data.region,
    status: data.status,
    otdUsd: data.otd_usd,
    otdItemized: data.otd_itemized,
    otdSource: data.otd_source,
    submittedAt: data.submitted_at,
    capturedAt: data.captured_at,
  };
}

function hoursBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.round(((to - from) / 3_600_000) * 100) / 100;
}
