import { createAdminClient } from '@/lib/supabase/admin';

import {
  assembleOverviewDeals,
  demoOverviewDeals,
  summarizeDeals,
  type DealsOverview,
  type LiveDealRow,
  type LiveLifecycleRow,
  type LiveMessageRow,
  type LiveOfferRow,
} from './deals-overview';

const PAGE = 1000;
const MAX_ROWS = 20000;

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

export async function loadDealsOverview(): Promise<DealsOverview> {
  const live = await readLiveDeals();
  if (!live) return summarizeDeals(demoOverviewDeals(), 'demo');
  return summarizeDeals(live.deals, 'live', live.partial);
}

async function readLiveDeals(): Promise<{ deals: ReturnType<typeof assembleOverviewDeals>; partial: boolean } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const admin = createAdminClient();
    const deals = await selectPages<LiveDealTable>((from, to) => (
      admin.from('shopper_deals').select('id, status, created_at').order('created_at', { ascending: false }).range(from, to)
    ));
    if (deals.error || deals.rows.length === 0) return null;

    const [lifecycle, offers, messages] = await Promise.all([
      selectPages<LifecycleTable>((from, to) => (
        admin.from('shopper_deal_lifecycle').select('deal_id, end_state, added_at, first_outreach_at, replied_at, bought').range(from, to)
      )),
      selectPages<OfferTable>((from, to) => (
        admin.from('shopper_offers').select('shopper_deal_id, vehicle_price, occurred_at').order('occurred_at', { ascending: true }).range(from, to)
      )),
      selectPages<MessageTable>((from, to) => (
        admin.from('shopper_outreach_messages').select('shopper_deal_id, direction, occurred_at').order('occurred_at', { ascending: true }).range(from, to)
      )),
    ]);

    const partial = Boolean(deals.capped || lifecycle.error || offers.error || messages.error);
    return {
      partial,
      deals: assembleOverviewDeals({
        deals: deals.rows.map(toDeal),
        lifecycle: lifecycle.error ? [] : lifecycle.rows.map(toLifecycle),
        offers: offers.error ? [] : offers.rows.map(toOffer),
        messages: messages.error ? [] : messages.rows.map(toMessage),
      }),
    };
  } catch {
    return null;
  }
}

async function selectPages<T>(
  query: (from: number, to: number) => PromiseLike<QueryResult<T>>,
): Promise<{ rows: T[]; error: string | null; capped: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) return { rows, error: error.message, capped: false };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, error: null, capped: false };
  }
  return { rows, error: null, capped: true };
}

type LiveDealTable = { id: string; status: string; created_at: string };
type LifecycleTable = {
  deal_id: string;
  end_state: string;
  added_at: string | null;
  first_outreach_at: string | null;
  replied_at: string | null;
  bought: boolean | null;
};
type OfferTable = { shopper_deal_id: string; vehicle_price: number | string | null; occurred_at: string };
type MessageTable = { shopper_deal_id: string; direction: string; occurred_at: string };

function toDeal(row: LiveDealTable): LiveDealRow {
  return { id: row.id, status: row.status, createdAt: row.created_at };
}

function toLifecycle(row: LifecycleTable): LiveLifecycleRow {
  return {
    dealId: row.deal_id,
    endState: row.end_state,
    addedAt: row.added_at,
    firstOutreachAt: row.first_outreach_at,
    repliedAt: row.replied_at,
    bought: row.bought,
  };
}

function toOffer(row: OfferTable): LiveOfferRow {
  const price = row.vehicle_price == null ? null : Number(row.vehicle_price);
  return {
    dealId: row.shopper_deal_id,
    price: price != null && Number.isFinite(price) ? price : null,
    at: row.occurred_at,
  };
}

function toMessage(row: MessageTable): LiveMessageRow {
  return { dealId: row.shopper_deal_id, direction: row.direction, at: row.occurred_at };
}
