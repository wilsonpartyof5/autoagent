import { searchActiveCarsMcp } from '@/lib/marketcheck/mcp-adapter';
import { deliverShopperPushLive } from '@/lib/push/dispatch';
import type { ShopperPush } from '@/lib/push/events';
import { composeShopperPush, didYouBuyOnServer, type VehicleHint } from '@/lib/push/triggers';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseShopperDealRepository } from './deal-store';
import {
  ShopperDealError,
  createShopperDeal,
  getShopperDeal,
  isShopperListingId,
  listShopperDeals,
  toShopperDeal,
  type ShopperDeal,
  type ShopperDealRepository,
} from './deals';
import {
  blankLifecycle,
  buyOutcome,
  canFindSimilar,
  endDeal,
  noteOutreach,
  noteReply,
  presentDeal,
  quotaDealFromRecord,
  readAgentEvent,
  recordGeofenceExit,
  recordOutcome,
  removeDeal,
  revealDealerVisit,
  runScheduledLifecycle,
  type BuyOutcome,
  type DealAgentEvent,
  type LifecycleRecord,
  type OfferInput,
  type OutcomeInput,
  type PresentedDeal,
} from './lifecycle';
import { getLifecycleRepository, type LifecycleRepository } from './lifecycle-store';
import { shouldRefundCredit, type QuotaEndState } from './quota';
import {
  checkCanAddCar,
  getShopperCredits,
  refundCredit,
  consumeCredit,
} from './credits';
import { findSimilarListings, similarSearchQuery, type SimilarListing, type SimilarQuery, type SimilarSearch } from './similar';

export type CreditSummary = {
  balance: number;
  canAdd: boolean;
  reason: 'ok' | 'no_credits';
};

export type DealDeps = {
  deals: ShopperDealRepository;
  lifecycle: LifecycleRepository;
  now: Date;
  live: boolean;
  search?: SimilarSearch;
  notify?: (push: ShopperPush) => Promise<void>;
  supabase?: SupabaseClient;
};

let createAdminClientFn: (() => SupabaseClient) | null = null;

function getAdminClient(deps: DealDeps): SupabaseClient {
  if (deps.supabase) return deps.supabase;
  if (!createAdminClientFn) {
    const { createAdminClient } = require('@/lib/supabase/admin');
    createAdminClientFn = createAdminClient;
  }
  return createAdminClientFn!();
}

export async function shopperDeps(_userId: string): Promise<DealDeps> {
  const now = new Date();
  return {
    deals: supabaseShopperDealRepository(),
    lifecycle: getLifecycleRepository(),
    now,
    live: process.env.MARKETCHECK_LIVE === '1',
    search: searchActiveCarsMcp,
    notify: (push) => deliverShopperPushLive(push).then(() => undefined),
  };
}

export async function addShopperCar(
  userId: string,
  input: { listingId: unknown; vehicle: unknown },
  deps: DealDeps,
): Promise<{ deal: PresentedDeal; credits: CreditSummary }> {
  const supabase = getAdminClient(deps);

  if (isShopperListingId(input.listingId)) {
    const existing = await deps.deals.findOpen(userId, input.listingId);
    if (existing) {
      const deal = toShopperDeal(existing);
      const records = await deps.lifecycle.listForShopper(userId);
      return {
        deal: presentDeal(deal, findRecord(records, deal.id)),
        credits: await creditSummaryFor(supabase, userId),
      };
    }
  }

  const creditCheck = await checkCanAddCar(supabase, userId);
  if (!creditCheck.canAdd) {
    throw new ShopperDealError(
      'You need car credits to add a new car. Purchase a car pack to continue.',
      402,
      'no_credits',
    );
  }

  const deal = await createShopperDeal(deps.deals, {
    consumerUserId: userId,
    listingId: input.listingId,
    vehicle: input.vehicle,
  });

  const useResult = await consumeCredit(supabase, userId, deal.id);
  if (!useResult.success) {
    console.error('[deal-actions] Failed to use credit:', useResult.error);
  }

  const records = await deps.lifecycle.listForShopper(userId);
  if (!findRecord(records, deal.id)) {
    await deps.lifecycle.save(blankLifecycle(deal, userId));
  }

  return {
    deal: presentDeal(deal, (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId)),
    credits: await creditSummaryFor(supabase, userId),
  };
}

export async function listShopperCars(
  userId: string,
  deps: DealDeps,
): Promise<{ deals: PresentedDeal[]; credits: CreditSummary }> {
  const supabase = getAdminClient(deps);
  const [deals, records] = await Promise.all([
    listShopperDeals(deps.deals, userId),
    deps.lifecycle.listForShopper(userId),
  ]);
  return {
    deals: deals.map((deal) => presentDeal(deal, findRecord(records, deal.id))),
    credits: await creditSummaryFor(supabase, userId),
  };
}

export async function getShopperCar(userId: string, dealId: string, deps: DealDeps): Promise<PresentedDeal> {
  const deal = await requireDeal(userId, dealId, deps);
  const record = await deps.lifecycle.get(userId, deal.id);
  return presentDeal(deal, record);
}

const REMOVAL_REFUND_MS = 30 * 60 * 1000;

export async function removeShopperCar(
  userId: string,
  dealId: string,
  deps: DealDeps,
): Promise<{ id: string; removedAt: string; credits: CreditSummary; refunded: boolean }> {
  const supabase = getAdminClient(deps);
  const deal = await requireDeal(userId, dealId, deps);
  const at = deps.now.toISOString();
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  const removed = removeDeal(current, at);
  await deps.lifecycle.save(removed);
  await deps.deals.close(userId, deal.id);

  let refunded = false;
  const addedMs = Date.parse(current.addedAt);
  const nowMs = Date.parse(at);
  const within30Minutes = Number.isFinite(addedMs) && Number.isFinite(nowMs) && nowMs - addedMs <= REMOVAL_REFUND_MS;
  const beforeOutreach = current.outreachSentAt == null;

  if (within30Minutes && beforeOutreach) {
    const result = await refundCredit(supabase, userId, deal.id, 'removed');
    refunded = result.refunded;
  }

  return {
    id: deal.id,
    removedAt: removed.removedAt ?? at,
    credits: await creditSummaryFor(supabase, userId),
    refunded,
  };
}

export async function similarForDeal(
  userId: string,
  dealId: string,
  deps: DealDeps,
): Promise<{ dealId: string; search: SimilarQuery; source: 'mock' | 'live'; listings: SimilarListing[] }> {
  const deal = await requireDeal(userId, dealId, deps);
  const record = await deps.lifecycle.get(userId, deal.id);
  const endState = record?.endState ?? 'open';
  if (!canFindSimilar(endState)) {
    throw new ShopperDealError(
      'Find similar is available when a deal is sold or ends with no response.',
      409,
      'similar_unavailable',
    );
  }
  const search = similarSearchQuery(deal.vehicle, deal.listingId);
  const result = await findSimilarListings(search, { live: deps.live, search: deps.search });
  return { dealId: deal.id, search, source: result.source, listings: result.listings };
}

export async function forwardOffer(
  userId: string,
  dealId: string,
  input: OfferInput,
  deps: DealDeps,
  dealerName?: string | null,
): Promise<PresentedDeal> {
  const deal = await requireDeal(userId, dealId, deps);
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  const firstForward = !current.offerForwardedAt;
  const revealed = revealDealerVisit(current, input, deps.now.toISOString());
  await deps.lifecycle.save(revealed);
  if (firstForward) {
    await emitPush(deps, composeShopperPush({
      event: 'official_offer',
      userId,
      dealId: deal.id,
      listingId: deal.listingId,
    }, {
      offerForwarded: true,
      dealerName,
      vehicle: vehicleHint(deal),
    }));
  }
  return presentDeal(deal, revealed);
}

export async function exitGeofence(userId: string, dealId: string, deps: DealDeps) {
  // The geofence "Did you buy it?" prompt is sent by the phone. The server
  // records the exit and does not send that push.
  const deal = await requireDeal(userId, dealId, deps);
  const current = await deps.lifecycle.get(userId, deal.id);
  if (!current) {
    throw new ShopperDealError('Dealer location is available after the official offer is forwarded.', 409, 'visit_unavailable');
  }
  const result = recordGeofenceExit(current, deps.now.toISOString());
  await deps.lifecycle.save(result.record);
  return { dealId: deal.id, alreadySent: result.alreadySent, prompt: result.prompt };
}

export async function answerOutcome(
  userId: string,
  dealId: string,
  input: OutcomeInput,
  deps: DealDeps,
): Promise<{ outcome: BuyOutcome; deal: PresentedDeal }> {
  const supabase = getAdminClient(deps);
  const deal = await requireDeal(userId, dealId, deps);
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  const previousState = current.endState;
  const answered = recordOutcome(current, input, deps.now.toISOString());
  await deps.lifecycle.save(answered);

  if (answered.endState !== 'open') {
    await deps.deals.close(userId, deal.id);

    if (shouldRefundCredit(answered.endState) && previousState === 'open') {
      await refundCredit(supabase, userId, deal.id, answered.endState as 'sold' | 'ended_no_response' | 'dealer_declined');
    }
  }

  const closed = await getShopperDeal(deps.deals, userId, deal.id);
  const outcome = buyOutcome(answered);
  if (!outcome) throw new ShopperDealError('Drevvy could not save this answer.', 500, 'outcome_unreadable');
  return { outcome, deal: presentDeal(closed ?? deal, answered) };
}

export async function setLocationAccess(userId: string, dealId: string, granted: boolean, deps: DealDeps): Promise<void> {
  const deal = await requireDeal(userId, dealId, deps);
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  await deps.lifecycle.save({ ...current, locationGranted: granted });
}

export async function applyAgentEvent(event: DealAgentEvent, deps: Pick<DealDeps, 'deals' | 'lifecycle' | 'notify' | 'supabase'>): Promise<LifecycleRecord> {
  const supabase = getAdminClient(deps as DealDeps);
  const current = await deps.lifecycle.getById(event.dealId);
  if (!current || current.consumerUserId !== event.consumerUserId) {
    throw new ShopperDealError('Deal not found.', 404, 'not_found');
  }
  const soldNow = event.type === 'end' && event.endState === 'sold' && current.endState !== 'sold';
  const previousState = current.endState;
  let next = current;
  if (event.type === 'outreach') next = noteOutreach(current, event.sentAt, event.channel);
  if (event.type === 'reply') next = noteReply(current, event.sentAt);
  if (event.type === 'end') next = endDeal(current, event.endState, event.sentAt);
  await deps.lifecycle.save(next);

  if (next.endState !== 'open') {
    await deps.deals.close(next.consumerUserId, next.dealId);

    if (shouldRefundCredit(next.endState) && previousState === 'open') {
      await refundCredit(supabase, next.consumerUserId, next.dealId, next.endState as 'sold' | 'ended_no_response' | 'dealer_declined');
    }
  }
  if (soldNow) {
    const vehicle = await vehicleHintFor(deps, next.consumerUserId, next.dealId);
    await emitPush(deps, composeShopperPush({
      event: 'car_sold',
      userId: next.consumerUserId,
      dealId: next.dealId,
      listingId: next.listingId,
    }, {
      offerForwarded: Boolean(next.offerForwardedAt),
      vehicle,
    }));
  }
  return next;
}

export async function runLifecycleSchedule(deps: Pick<DealDeps, 'deals' | 'lifecycle' | 'now' | 'notify' | 'supabase'>): Promise<{
  endedNoResponse: number;
  buyPrompts: number;
  creditsRefunded: number;
}> {
  const supabase = getAdminClient(deps as DealDeps);
  const records = await deps.lifecycle.listAll();
  const result = runScheduledLifecycle(records, deps.now.toISOString());
  let creditsRefunded = 0;

  for (let index = 0; index < records.length; index += 1) {
    const next = result.records[index];
    const previous = records[index];
    if (next === previous) continue;

    await deps.lifecycle.save(next);

    if (next.endState !== 'open') {
      try {
        await deps.deals.close(next.consumerUserId, next.dealId);
      } catch (error) {
        console.error(JSON.stringify({
          event: 'deal_lifecycle_close_failed',
          dealId: next.dealId,
          message: error instanceof Error ? error.message : 'unknown',
        }));
      }

      if (shouldRefundCredit(next.endState) && previous.endState === 'open') {
        const refundResult = await refundCredit(
          supabase,
          next.consumerUserId,
          next.dealId,
          next.endState as 'sold' | 'ended_no_response' | 'dealer_declined',
        );
        if (refundResult.refunded) {
          creditsRefunded += 1;
        }
      }
    }
  }
  for (const prompt of result.buyPrompts) {
    if (!didYouBuyOnServer(prompt.source)) continue;
    const record = result.records.find((item) => item.dealId === prompt.dealId);
    if (!record) continue;
    const vehicle = await vehicleHintFor(deps, record.consumerUserId, record.dealId);
    await emitPush(deps, composeShopperPush({
      event: 'did_you_buy',
      userId: record.consumerUserId,
      dealId: record.dealId,
      listingId: record.listingId,
    }, {
      offerForwarded: Boolean(record.offerForwardedAt),
      vehicle,
    }));
  }
  return {
    endedNoResponse: result.endedNoResponse.length,
    buyPrompts: result.buyPrompts.length,
    creditsRefunded,
  };
}

export async function listBuyOutcomes(lifecycle: LifecycleRepository): Promise<BuyOutcome[]> {
  const records = await lifecycle.listAll();
  const outcomes: BuyOutcome[] = [];
  for (const record of records) {
    const outcome = buyOutcome(record);
    if (outcome) outcomes.push(outcome);
  }
  return outcomes;
}

export function parseAgentEvent(body: unknown, now: Date): DealAgentEvent {
  return readAgentEvent(body, now.toISOString());
}

export async function readRequestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function requireDeal(userId: string, dealId: string, deps: DealDeps): Promise<ShopperDeal> {
  const deal = await getShopperDeal(deps.deals, userId, dealId);
  if (!deal) throw new ShopperDealError('Deal not found.', 404, 'not_found');
  return deal;
}

async function creditSummaryFor(supabase: SupabaseClient, userId: string): Promise<CreditSummary> {
  const credits = await getShopperCredits(supabase, userId);
  return {
    balance: credits.balance,
    canAdd: credits.balance > 0,
    reason: credits.balance > 0 ? 'ok' : 'no_credits',
  };
}

function findRecord(records: LifecycleRecord[], dealId: string): LifecycleRecord | null {
  return records.find((record) => record.dealId === dealId) ?? null;
}

function vehicleHint(deal: ShopperDeal): VehicleHint {
  return { year: deal.vehicle.year, make: deal.vehicle.make, model: deal.vehicle.model };
}

async function vehicleHintFor(
  deps: { deals: ShopperDealRepository },
  userId: string,
  dealId: string,
): Promise<VehicleHint | null> {
  try {
    const row = await deps.deals.get(userId, dealId);
    if (!row) return null;
    return vehicleHint(toShopperDeal(row));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'shopper_push_vehicle_unreadable',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return null;
  }
}

async function emitPush(deps: { notify?: (push: ShopperPush) => Promise<void> }, push: ShopperPush): Promise<void> {
  if (!deps.notify) return;
  try {
    await deps.notify(push);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'shopper_push_failed',
      push: push.event,
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
}
