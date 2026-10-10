import { buildOutreachReport, dealsStartedBetween } from './analytics';
import { getOutreachDeal, getOutreachDeals } from './mock-source';
import type { ConversationQuery, OutreachDeal, OutreachReport, OutreachRange, StopReason, TouchpointId, Variant } from './types';

/**
 * Outreach reads go through this module.
 * The mock book is the only source. A later supabase implementation can
 * satisfy the same functions without changing the admin pages.
 */
export function outreachDataSource(): 'mock' {
  return 'mock';
}

export function defaultOutreachRange(): OutreachRange {
  return { from: '2026-09-18', to: '2026-10-10' };
}

export function parseOutreachRange(from: string | undefined, to: string | undefined): OutreachRange {
  const fallback = defaultOutreachRange();
  const start = isDay(from) ? from : fallback.from;
  const end = isDay(to) ? to : fallback.to;
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

export async function loadOutreachReport(range: OutreachRange): Promise<OutreachReport> {
  return buildOutreachReport(range.from, range.to);
}

export async function loadConversations(query: ConversationQuery): Promise<OutreachDeal[]> {
  const needle = query.q?.trim().toLowerCase() ?? '';
  return dealsStartedBetween(query.from, query.to, getOutreachDeals())
    .filter((deal) => matchesConversation(deal, query, needle))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export async function loadConversation(id: string): Promise<OutreachDeal | null> {
  return getOutreachDeal(id);
}

function matchesConversation(deal: OutreachDeal, query: ConversationQuery, needle: string): boolean {
  if (query.outcome && deal.stop !== query.outcome) return false;
  if (query.touchpoint) {
    const sent = deal.events.some((event) => event.direction === 'outbound' && event.touchpoint === query.touchpoint);
    if (!sent) return false;
    if (query.variant && !deal.events.some((event) => event.touchpoint === query.touchpoint && event.variant === query.variant)) return false;
  } else if (query.variant && !deal.events.some((event) => event.variant === query.variant)) {
    return false;
  }
  if (!needle) return true;
  return [deal.dealerName, deal.shopperFirst, deal.vehicle, deal.stock, deal.id].join(' ').toLowerCase().includes(needle);
}

function isDay(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export type { StopReason, TouchpointId, Variant };
