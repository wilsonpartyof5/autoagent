import { getMockShoppers } from './mock-source';
import type { ShopperDeal } from './types';

export const OVERVIEW_STATUSES = ['active', 'sold', 'no-response', 'accepted'] as const;
export type OverviewStatus = (typeof OVERVIEW_STATUSES)[number];

export const OVERVIEW_STATUS_LABEL: Record<OverviewStatus, string> = {
  active: 'Active',
  sold: 'Sold',
  'no-response': 'No response',
  accepted: 'Accepted',
};

export type OverviewDeal = {
  id: string;
  status: OverviewStatus | null;
  addedMonth: string;
  responseHours: number | null;
  priceDropRounds: number;
};

export type DealsOverview = {
  source: 'live' | 'demo';
  partial: boolean;
  counts: Record<OverviewStatus, number>;
  counted: number;
  excluded: number;
  averageResponseHours: number | null;
  replies: number;
  averagePriceDropRounds: number | null;
  roundBuckets: Array<{ label: string; count: number }>;
  carsByMonth: Array<{ month: string; cars: number }>;
};

export type LiveDealRow = {
  id: string;
  status: string;
  createdAt: string;
};

export type LiveLifecycleRow = {
  dealId: string;
  endState: string;
  addedAt: string | null;
  firstOutreachAt: string | null;
  repliedAt: string | null;
  bought: boolean | null;
};

export type LiveOfferRow = {
  dealId: string;
  price: number | null;
  at: string;
};

export type LiveMessageRow = {
  dealId: string;
  direction: string;
  at: string;
  isTest?: boolean;
};

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function classifyDealStatus(
  status: string,
  endState: string | null,
  bought: boolean | null,
): OverviewStatus | null {
  if (endState === 'sold' || bought === true) return 'sold';
  if (endState === 'ended_no_response') return 'no-response';
  if (status === 'accepted') return 'accepted';
  if (endState === 'removed' || endState === 'dealer_declined' || status === 'closed') return null;
  if (endState === 'open' || status === 'interested' || status === 'negotiating') return 'active';
  return null;
}

export function responseHours(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 3_600_000;
}

export function priceDropRounds(offers: Array<{ price: number | null; at: string }>): number {
  const ordered = offers
    .filter((row): row is { price: number; at: string } => row.price != null && Number.isFinite(row.price))
    .sort((a, b) => a.at.localeCompare(b.at) || a.price - b.price);
  let rounds = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].price < ordered[index - 1].price) rounds += 1;
  }
  return rounds;
}

export function monthKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

export function assembleOverviewDeals(input: {
  deals: LiveDealRow[];
  lifecycle: LiveLifecycleRow[];
  offers: LiveOfferRow[];
  messages: LiveMessageRow[];
}): OverviewDeal[] {
  const lifecycle = new Map(input.lifecycle.map((row) => [row.dealId, row]));
  const offers = groupBy(input.offers, (row) => row.dealId);
  const messages = groupBy(input.messages, (row) => row.dealId);

  return input.deals.map((deal) => {
    const life = lifecycle.get(deal.id) ?? null;
    const reply = responseHours(life?.firstOutreachAt, life?.repliedAt) ?? messageResponseHours(messages.get(deal.id) ?? []);
    const addedAt = life?.addedAt || deal.createdAt;
    return {
      id: deal.id,
      status: classifyDealStatus(deal.status, life?.endState ?? null, life?.bought ?? null),
      addedMonth: monthKey(addedAt),
      responseHours: reply,
      priceDropRounds: priceDropRounds(offers.get(deal.id) ?? []),
    };
  });
}

export function summarizeDeals(deals: OverviewDeal[], source: 'live' | 'demo', partial = false): DealsOverview {
  const counts = emptyCounts();
  const cars = new Map<string, number>();
  const replyHours: number[] = [];
  const rounds: number[] = [];

  for (const deal of deals) {
    if (deal.status) counts[deal.status] += 1;
    if (MONTH.test(deal.addedMonth)) cars.set(deal.addedMonth, (cars.get(deal.addedMonth) ?? 0) + 1);
    if (deal.responseHours != null) replyHours.push(deal.responseHours);
    rounds.push(Math.max(0, deal.priceDropRounds));
  }

  const counted = OVERVIEW_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  return {
    source,
    partial,
    counts,
    counted,
    excluded: deals.length - counted,
    averageResponseHours: average(replyHours),
    replies: replyHours.length,
    averagePriceDropRounds: rounds.length === 0 ? null : average(rounds),
    roundBuckets: bucketRounds(rounds),
    carsByMonth: [...cars.entries()]
      .map(([month, count]) => ({ month, cars: count }))
      .sort((a, b) => b.month.localeCompare(a.month)),
  };
}

export function demoOverviewDeals(shoppers = getMockShoppers()): OverviewDeal[] {
  return shoppers.flatMap((shopper) => shopper.deals).map(demoDeal);
}

function demoDeal(deal: ShopperDeal): OverviewDeal {
  return {
    id: deal.id,
    status: demoStatus(deal),
    addedMonth: monthKey(deal.createdAt),
    responseHours: responseHours(deal.firstOutboundAt, deal.firstReplyAt),
    priceDropRounds: deal.market.priceDropCount,
  };
}

function demoStatus(deal: ShopperDeal): OverviewStatus {
  if (deal.won) return 'sold';
  if (deal.stage === 'best_price_ready') return 'accepted';
  if (deal.stage === 'reaching_out' && deal.firstReplyAt == null) return 'no-response';
  return 'active';
}

function messageResponseHours(messages: LiveMessageRow[]): number | null {
  const live = messages.filter((row) => row.isTest !== true);
  const outbound = live
    .filter((row) => row.direction === 'outbound')
    .map((row) => row.at)
    .sort();
  const inbound = live
    .filter((row) => row.direction === 'inbound')
    .map((row) => row.at)
    .sort();
  if (outbound.length === 0 || inbound.length === 0) return null;
  const reply = inbound.find((at) => Date.parse(at) >= Date.parse(outbound[0]));
  return responseHours(outbound[0], reply ?? null);
}

function bucketRounds(rounds: number[]): Array<{ label: string; count: number }> {
  const counts = [0, 0, 0, 0];
  for (const value of rounds) counts[Math.min(3, Math.floor(value))] += 1;
  return [
    { label: '0', count: counts[0] },
    { label: '1', count: counts[1] },
    { label: '2', count: counts[2] },
    { label: '3+', count: counts[3] },
  ];
}

function emptyCounts(): Record<OverviewStatus, number> {
  return { active: 0, sold: 0, 'no-response': 0, accepted: 0 };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = grouped.get(id);
    if (list) list.push(row);
    else grouped.set(id, [row]);
  }
  return grouped;
}
