import { buildAnalytics, type AdminAnalytics } from './analytics';
import { getMarketInsight } from './market';
import {
  getMockDeal,
  getMockShopper,
  getMockShoppers,
  listShopperSummaries,
  toShopperCard,
} from './mock-source';
import {
  DEAL_STAGES,
  type ShopperDeal,
  type ShopperDealCard,
  type ShopperRecord,
  type ShopperSummary,
} from './types';

export type ShopperSort = 'name' | 'signedUp' | 'subscription' | 'cars' | 'savings' | 'lastActivity';

export type ShopperQuery = {
  q?: string;
  sort?: ShopperSort;
  dir?: 'asc' | 'desc';
};

/**
 * Admin reads go through this module.
 * ADMIN_DATA_SOURCE defaults to mock. The supabase value is reserved and still
 * returns fixtures so this console cannot write or seed production.
 */
export function adminDataSource(): 'mock' {
  return 'mock';
}

export async function queryShoppers(query: ShopperQuery = {}): Promise<ShopperSummary[]> {
  const needle = query.q?.trim().toLowerCase() ?? '';
  const rows = listShopperSummaries().filter((shopper) => {
    if (!needle) return true;
    const record = getMockShopper(shopper.id);
    const cars = record?.deals.map((deal) => `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`).join(' ') ?? '';
    return `${shopper.name} ${shopper.email} ${cars}`.toLowerCase().includes(needle);
  });
  const dir = query.dir === 'asc' ? 1 : -1;
  const sort = query.sort ?? 'lastActivity';
  return rows.sort((a, b) => dir * compareShoppers(a, b, sort));
}

export async function loadShopper(id: string): Promise<{
  shopper: ShopperRecord;
  cards: ShopperDealCard[];
} | null> {
  const shopper = getMockShopper(id);
  if (!shopper) return null;
  return { shopper, cards: shopper.deals.map(toShopperCard) };
}

export async function loadDeal(dealId: string): Promise<{ shopper: ShopperRecord; deal: ShopperDeal; card: ShopperDealCard } | null> {
  const found = getMockDeal(dealId);
  if (!found) return null;
  const deal = {
    ...found.deal,
    market: await getMarketInsight(found.deal.vehicle),
  };
  return { shopper: found.shopper, deal, card: toShopperCard(deal) };
}

export async function loadAnalytics(): Promise<AdminAnalytics> {
  return buildAnalytics(getMockShoppers());
}

function compareShoppers(a: ShopperSummary, b: ShopperSummary, sort: ShopperSort): number {
  switch (sort) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'signedUp':
      return a.signedUpAt.localeCompare(b.signedUpAt);
    case 'subscription':
      return a.subscription.localeCompare(b.subscription);
    case 'cars':
      return a.cars - b.cars;
    case 'savings':
      return a.totalSavings - b.totalSavings;
    case 'lastActivity':
      return a.lastActivityAt.localeCompare(b.lastActivityAt);
    default:
      return 0;
  }
}

export function emptyStageCounts(): Record<(typeof DEAL_STAGES)[number], number> {
  return { reaching_out: 0, negotiating: 0, offer_received: 0, best_price_ready: 0, paused: 0 };
}
