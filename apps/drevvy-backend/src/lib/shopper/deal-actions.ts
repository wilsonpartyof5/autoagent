import { searchActiveCarsMcp } from '@/lib/marketcheck/mcp-adapter';

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
  quotaDealFromShopperDeal,
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
import {
  dealCountsTowardQuota,
  loadBillingPeriod,
  quotaUsage,
  type BillingPeriod,
  type QuotaDeal,
  type QuotaSummary,
} from './quota';
import { findSimilarListings, similarSearchQuery, type SimilarListing, type SimilarQuery, type SimilarSearch } from './similar';

export type DealDeps = {
  deals: ShopperDealRepository;
  lifecycle: LifecycleRepository;
  now: Date;
  period: BillingPeriod;
  live: boolean;
  search?: SimilarSearch;
};

export async function shopperDeps(userId: string): Promise<DealDeps> {
  const now = new Date();
  return {
    deals: supabaseShopperDealRepository(),
    lifecycle: getLifecycleRepository(),
    now,
    period: await loadBillingPeriod(userId, process.env, fetch, now),
    live: process.env.MARKETCHECK_LIVE === '1',
    search: searchActiveCarsMcp,
  };
}

export async function addShopperCar(
  userId: string,
  input: { listingId: unknown; vehicle: unknown },
  deps: DealDeps,
): Promise<{ deal: PresentedDeal; quota: QuotaSummary }> {
  if (isShopperListingId(input.listingId)) {
    const existing = await deps.deals.findOpen(userId, input.listingId);
    if (existing) {
      const deal = toShopperDeal(existing);
      const records = await deps.lifecycle.listForShopper(userId);
      return {
        deal: presentDeal(deal, findRecord(records, deal.id)),
        quota: await quotaFor(userId, deps),
      };
    }
  }

  const usage = await quotaFor(userId, deps);
  if (!usage.canAdd) throw quotaDenied(usage);

  const deal = await createShopperDeal(deps.deals, {
    consumerUserId: userId,
    listingId: input.listingId,
    vehicle: input.vehicle,
  });
  const records = await deps.lifecycle.listForShopper(userId);
  if (!findRecord(records, deal.id)) {
    await deps.lifecycle.save(blankLifecycle(deal, userId));
  }
  return {
    deal: presentDeal(deal, (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId)),
    quota: await quotaFor(userId, deps),
  };
}

export async function listShopperCars(
  userId: string,
  deps: DealDeps,
): Promise<{ deals: PresentedDeal[]; quota: QuotaSummary }> {
  const [deals, records] = await Promise.all([
    listShopperDeals(deps.deals, userId),
    deps.lifecycle.listForShopper(userId),
  ]);
  return {
    deals: deals.map((deal) => presentDeal(deal, findRecord(records, deal.id))),
    quota: quotaFrom(deps.period, deals, records),
  };
}

export async function getShopperCar(userId: string, dealId: string, deps: DealDeps): Promise<PresentedDeal> {
  const deal = await requireDeal(userId, dealId, deps);
  const record = await deps.lifecycle.get(userId, deal.id);
  return presentDeal(deal, record);
}

export async function removeShopperCar(
  userId: string,
  dealId: string,
  deps: DealDeps,
): Promise<{ id: string; removedAt: string; refunded: boolean; quota: QuotaSummary }> {
  const deal = await requireDeal(userId, dealId, deps);
  const at = deps.now.toISOString();
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  const removed = removeDeal(current, at);
  await deps.lifecycle.save(removed);
  await deps.deals.close(userId, deal.id);
  return {
    id: deal.id,
    removedAt: removed.removedAt ?? at,
    refunded: !dealCountsTowardQuota(quotaDealFromRecord(removed), deps.period),
    quota: await quotaFor(userId, deps),
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
): Promise<PresentedDeal> {
  const deal = await requireDeal(userId, dealId, deps);
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  const revealed = revealDealerVisit(current, input, deps.now.toISOString());
  await deps.lifecycle.save(revealed);
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
  const deal = await requireDeal(userId, dealId, deps);
  const current = (await deps.lifecycle.get(userId, deal.id)) ?? blankLifecycle(deal, userId);
  const answered = recordOutcome(current, input, deps.now.toISOString());
  await deps.lifecycle.save(answered);
  if (answered.endState !== 'open') await deps.deals.close(userId, deal.id);
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

export async function applyAgentEvent(event: DealAgentEvent, deps: Pick<DealDeps, 'deals' | 'lifecycle'>): Promise<LifecycleRecord> {
  const current = await deps.lifecycle.getById(event.dealId);
  if (!current || current.consumerUserId !== event.consumerUserId) {
    throw new ShopperDealError('Deal not found.', 404, 'not_found');
  }
  let next = current;
  if (event.type === 'outreach') next = noteOutreach(current, event.sentAt, event.channel);
  if (event.type === 'reply') next = noteReply(current, event.sentAt);
  if (event.type === 'end') next = endDeal(current, event.endState, event.sentAt);
  await deps.lifecycle.save(next);
  if (next.endState !== 'open') await deps.deals.close(next.consumerUserId, next.dealId);
  return next;
}

export async function runLifecycleSchedule(deps: Pick<DealDeps, 'deals' | 'lifecycle' | 'now'>): Promise<{
  endedNoResponse: number;
  buyPrompts: number;
}> {
  const records = await deps.lifecycle.listAll();
  const result = runScheduledLifecycle(records, deps.now.toISOString());
  for (let index = 0; index < records.length; index += 1) {
    const next = result.records[index];
    if (next === records[index]) continue;
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
    }
  }
  return {
    endedNoResponse: result.endedNoResponse.length,
    buyPrompts: result.buyPrompts.length,
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

async function quotaFor(userId: string, deps: DealDeps): Promise<QuotaSummary> {
  const [deals, records] = await Promise.all([
    listShopperDeals(deps.deals, userId),
    deps.lifecycle.listForShopper(userId),
  ]);
  return quotaFrom(deps.period, deals, records);
}

function quotaFrom(period: BillingPeriod, deals: ShopperDeal[], records: LifecycleRecord[]): QuotaSummary {
  return quotaUsage(period, quotaInputs(deals, records));
}

function quotaInputs(deals: ShopperDeal[], records: LifecycleRecord[]): QuotaDeal[] {
  const recordsById = new Map<string, LifecycleRecord>();
  records.forEach((record) => recordsById.set(record.dealId, record));
  const seen = new Set<string>();
  const inputs: QuotaDeal[] = [];
  deals.forEach((deal) => {
    seen.add(deal.id);
    const record = recordsById.get(deal.id);
    inputs.push(record ? quotaDealFromRecord(record) : quotaDealFromShopperDeal(deal));
  });
  records.forEach((record) => {
    if (!seen.has(record.dealId)) inputs.push(quotaDealFromRecord(record));
  });
  return inputs;
}

function findRecord(records: LifecycleRecord[], dealId: string): LifecycleRecord | null {
  return records.find((record) => record.dealId === dealId) ?? null;
}

function quotaDenied(usage: QuotaSummary): ShopperDealError {
  if (usage.reason === 'subscription_inactive') {
    return new ShopperDealError(
      'Deals already started will finish. A current subscription is required to add a car.',
      403,
      'subscription_inactive',
    );
  }
  return new ShopperDealError('This billing period includes 10 cars.', 402, 'monthly_quota');
}
