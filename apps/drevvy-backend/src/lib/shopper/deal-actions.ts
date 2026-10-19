import { searchActiveCarsMcp } from '@/lib/marketcheck/mcp-adapter';
import {
  loadFairPriceIfAllowed,
  type FairPriceQuote,
  type FairPriceTrigger,
  type FairPriceVehicle,
} from '@/lib/marketcheck/price';
import { redactSecrets } from '@/lib/marketcheck/secrets';
import { deliverShopperPushLive } from '@/lib/push/dispatch';
import type { ShopperPush } from '@/lib/push/events';
import { planShopperPush, type PushIdentity, type PushTrigger } from '@/lib/push/triggers';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseShopperDealRepository } from './deal-store';
import {
  ShopperDealError,
  getShopperDeal,
  isShopperListingId,
  listShopperDeals,
  provisionShopperDeal,
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
  type DealSignalIdentity,
  type LifecycleRecord,
  type OfferInput,
  type OutcomeInput,
  type PresentedDeal,
} from './lifecycle';
import { getLifecycleRepository, type LifecycleRepository } from './lifecycle-store';
import { shouldRefundCredit } from './quota';
import {
  checkCanAddCar,
  getShopperCredits,
  refundCredit,
  consumeCredit,
} from './credits';
import { readShopperTrimNotice } from '@/lib/dealer/trim-store';
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
  /** Defaults to MarketCheck Price, allowed only for unlock and open-deal. */
  loadFairPrice?: (trigger: FairPriceTrigger, vehicle: FairPriceVehicle) => Promise<FairPriceQuote | null>;
  /** Shopper-facing note when the verified trim disagrees with MarketCheck. */
  trimNotice?: (dealId: string) => Promise<string | null>;
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
    trimNotice: (dealId) => readShopperTrimNotice(dealId),
  };
}

export const REMOVAL_REFUND_MS = 30 * 60 * 1000;

export async function addShopperCar(
  userId: string,
  input: { listingId: unknown; vehicle: unknown; zip?: unknown },
  deps: DealDeps,
): Promise<{ deal: PresentedDeal; credits: CreditSummary }> {
  const supabase = getAdminClient(deps);

  if (isShopperListingId(input.listingId)) {
    const existing = await deps.deals.findOpen(userId, input.listingId);
    if (existing) {
      const deal = toShopperDeal(existing);
      await chargeDeal(supabase, userId, deal.id, false, deps);
      const records = await deps.lifecycle.listForShopper(userId);
      return {
        deal: await withFairPrice(presentDeal(deal, findRecord(records, deal.id)), 'unlock_with_agent', input.zip, deps),
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

  const provisioned = await provisionShopperDeal(deps.deals, {
    consumerUserId: userId,
    listingId: input.listingId,
    vehicle: input.vehicle,
  });
  await chargeDeal(supabase, userId, provisioned.deal.id, provisioned.created, deps);

  const records = await deps.lifecycle.listForShopper(userId);
  if (!findRecord(records, provisioned.deal.id)) {
    await deps.lifecycle.save(blankLifecycle(provisioned.deal, userId));
  }

  return {
    deal: await withFairPrice(
      presentDeal(
        provisioned.deal,
        (await deps.lifecycle.get(userId, provisioned.deal.id)) ?? blankLifecycle(provisioned.deal, userId),
      ),
      'unlock_with_agent',
      input.zip,
      deps,
    ),
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
  const notices = deps.trimNotice
    ? await Promise.all(deals.map(async (deal) => [deal.id, await deps.trimNotice?.(deal.id)] as const))
    : [];
  const noticeFor = new Map(notices);
  return {
    deals: deals.map((deal) => presentDeal(deal, findRecord(records, deal.id), noticeFor.get(deal.id) ?? null)),
    credits: await creditSummaryFor(supabase, userId),
  };
}

export async function getShopperCar(
  userId: string,
  dealId: string,
  deps: DealDeps,
  options?: { zip?: unknown },
): Promise<PresentedDeal> {
  const deal = await requireDeal(userId, dealId, deps);
  const record = await deps.lifecycle.get(userId, deal.id);
  const notice = deps.trimNotice ? await deps.trimNotice(deal.id) : null;
  return withFairPrice(presentDeal(deal, record, notice), 'open_deal', options?.zip, deps);
}

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
  revealedDealerName: string | null = null,
): Promise<PresentedDeal> {
  const deal = await requireDeal(userId, dealId, deps);
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  const firstForward = !current.offerForwardedAt;
  const revealed = revealDealerVisit(current, input, deps.now.toISOString());
  await deps.lifecycle.save(revealed);
  if (firstForward) {
    await emitPlanned(deps, {
      kind: 'official_offer',
      userId,
      dealId: deal.id,
      listingId: deal.listingId,
      vehicle: { model: deal.vehicle.model },
      offerForwarded: true,
      identity: { dealerName: revealedDealerName },
    });
  }
  return presentDeal(deal, revealed);
}

export async function exitGeofence(userId: string, dealId: string, deps: DealDeps) {
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
      await refundCredit(supabase, userId, deal.id, answered.endState);
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
  const current = await deps.lifecycle.getById(event.dealId);
  if (!current || current.consumerUserId !== event.consumerUserId) {
    throw new ShopperDealError('Deal not found.', 404, 'not_found');
  }
  if (event.type === 'price_drop' || event.type === 'offer_ready') {
    await emitListingSignal(event, current, deps);
    return current;
  }
  const supabase = getAdminClient(deps as DealDeps);
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
      await refundCredit(supabase, next.consumerUserId, next.dealId, next.endState);
    }
  }
  if (soldNow) {
    const model = await vehicleModel(deps, next.consumerUserId, next.dealId);
    await emitPlanned(deps, {
      kind: 'car_sold',
      userId: next.consumerUserId,
      dealId: next.dealId,
      listingId: next.listingId,
      vehicle: { model },
      identity: { dealerName: null },
    });
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
          next.endState,
        );
        if (refundResult.refunded) {
          creditsRefunded += 1;
        }
      }
    }
  }
  for (const prompt of result.buyPrompts) {
    const record = result.records.find((item) => item.dealId === prompt.dealId);
    if (!record) continue;
    const model = await vehicleModel(deps, record.consumerUserId, record.dealId);
    await emitPlanned(deps, {
      kind: 'did_you_buy',
      source: prompt.source,
      userId: record.consumerUserId,
      dealId: record.dealId,
      listingId: record.listingId,
      vehicle: { model },
      identity: { dealerName: null },
    });
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

async function withFairPrice(
  deal: PresentedDeal,
  trigger: FairPriceTrigger,
  zip: unknown,
  deps: DealDeps,
): Promise<PresentedDeal> {
  const load = deps.loadFairPrice ?? loadFairPriceIfAllowed;
  try {
    const quote = await load(trigger, {
      vin: deal.vehicle.vin,
      miles: deal.vehicle.miles,
      condition: deal.vehicle.condition,
      zip: typeof zip === 'string' ? zip : undefined,
    });
    if (!quote) return deal;
    return { ...deal, fairPrice: quote };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'marketcheck_price_failed',
      trigger,
      error: redactSecrets(error instanceof Error ? error.message : String(error)),
    }));
    return deal;
  }
}

async function requireDeal(userId: string, dealId: string, deps: DealDeps): Promise<ShopperDeal> {
  const deal = await getShopperDeal(deps.deals, userId, dealId);
  if (!deal) throw new ShopperDealError('Deal not found.', 404, 'not_found');
  return deal;
}

async function chargeDeal(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
  discardIfUncharged: boolean,
  deps: DealDeps,
): Promise<void> {
  const useResult = await consumeCredit(supabase, userId, dealId);
  if (useResult.success) return;
  if (discardIfUncharged && useResult.error === 'no_credits') {
    try {
      await deps.deals.discard(userId, dealId);
    } catch (error) {
      console.error('[deal-actions] Failed to discard uncharged deal:', error instanceof Error ? error.message : error);
    }
  }
  if (useResult.error === 'credit_failed') {
    throw new ShopperDealError('Drevvy could not use a car credit for this deal.', 500, 'credit_failed');
  }
  throw new ShopperDealError(
    'You need car credits to add a new car. Purchase a car pack to continue.',
    402,
    'no_credits',
  );
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

async function emitListingSignal(
  event: Extract<DealAgentEvent, { type: 'price_drop' | 'offer_ready' }>,
  record: LifecycleRecord,
  deps: Pick<DealDeps, 'deals' | 'notify'>,
): Promise<void> {
  const model = await vehicleModel(deps, record.consumerUserId, record.dealId);
  const identity = pushIdentity(event.identity);
  if (event.type === 'price_drop') {
    const previousPrice = event.previousPrice ?? (await listedPrice(deps, record.consumerUserId, record.dealId));
    if (previousPrice == null) return;
    await emitPlanned(deps, {
      kind: 'price_drop',
      userId: record.consumerUserId,
      dealId: record.dealId,
      listingId: record.listingId,
      vehicle: { model },
      previousPrice,
      price: event.price,
      dealerAlias: event.dealerAlias,
      identity,
      prefs: { priceDrops: event.priceDrops, hidePrices: event.hidePrices },
    });
    return;
  }
  await emitPlanned(deps, {
    kind: 'offer_ready',
    userId: record.consumerUserId,
    dealId: record.dealId,
    listingId: record.listingId,
    vehicle: { model },
    otd: event.otd,
    identity,
    prefs: { offers: event.offers, hidePrices: event.hidePrices },
  });
}

async function listedPrice(
  deps: Pick<DealDeps, 'deals'>,
  userId: string,
  dealId: string,
): Promise<number | null> {
  try {
    const row = await deps.deals.get(userId, dealId);
    if (!row) return null;
    return toShopperDeal(row).vehicle.price;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'shopper_push_vehicle_unreadable',
      dealId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return null;
  }
}

async function vehicleModel(
  deps: Pick<DealDeps, 'deals'>,
  userId: string,
  dealId: string,
): Promise<string | null> {
  try {
    const row = await deps.deals.get(userId, dealId);
    if (!row) return null;
    return toShopperDeal(row).vehicle.model;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'shopper_push_vehicle_unreadable',
      dealId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return null;
  }
}

function pushIdentity(identity: DealSignalIdentity): PushIdentity {
  return {
    dealerName: identity.dealerName,
    dealerPhone: identity.dealerPhone,
    dealerEmail: identity.dealerEmail,
    dealerWebsite: identity.dealerWebsite,
    street: identity.street,
  };
}

async function emitPlanned(
  deps: { notify?: (push: ShopperPush) => Promise<void> },
  trigger: PushTrigger,
): Promise<void> {
  const planned = planShopperPush(trigger);
  if (!planned) return;
  await emitPush(deps, planned);
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
