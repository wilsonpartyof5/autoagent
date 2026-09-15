import type { DealerMobileAuth } from '@/lib/dealer-mobile/auth';
import type { AuthorizedDealership } from '@/lib/dealer-mobile/dealerships';
import { listMobileLeads } from '@/lib/dealer-mobile/leads';

export type MobileDashboardSnapshot = {
  balance: {
    cashBalanceCents: number;
    includedLeadsRemaining: number;
    leadPriceCents: number;
    autoReplenishEnabled: boolean;
  };
  metrics: Array<{
    id: string;
    title: string;
    value: string;
    detail: string;
    symbol: string;
  }>;
  trends: Array<{
    id: string;
    date: string;
    leads: number;
    searches: number;
  }>;
};

export async function mobileDashboardSnapshot(
  auth: DealerMobileAuth,
  dealership: AuthorizedDealership,
): Promise<MobileDashboardSnapshot> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
  weekAgo.setUTCHours(0, 0, 0, 0);

  const [leads, balanceResult, analyticsResult, responseRows] = await Promise.all([
    listMobileLeads(auth, dealership, { limit: 100 }),
    auth.supabase
      .from('dealership_billing_accounts')
      .select(
        'cash_balance_cents, included_leads_remaining, lead_price_cents, auto_replenish_enabled',
      )
      .eq('dealership_id', dealership.id)
      .maybeSingle(),
    dealership.marketcheckDealerId
      ? auth.supabase
          .from('analytics_events')
          .select('event_name, timestamp')
          .eq('dealer_id', dealership.marketcheckDealerId)
          .in('event_name', ['lead.submit', 'inventory.search'])
          .gte('timestamp', weekAgo.toISOString())
      : Promise.resolve({ data: [], error: null }),
    responseTimeRows(auth, dealership),
  ]);

  const leadsThisWeek = leads.filter(
    (lead) => new Date(lead.createdAt).getTime() >= weekAgo.getTime(),
  ).length;
  const newLeads = leads.filter((lead) => lead.status === 'new').length;
  const closedLeads = leads.filter((lead) => lead.status === 'closed').length;
  const closeRate = leads.length > 0 ? Math.round((closedLeads / leads.length) * 100) : 0;

  const responseHours = responseRows
    .filter((row: any) => row.replied_at)
    .map(
      (row: any) =>
        (new Date(row.replied_at).getTime() - new Date(row.created_at).getTime()) /
        3_600_000,
    )
    .filter((hours: number) => Number.isFinite(hours) && hours >= 0);
  const averageResponseHours =
    responseHours.length > 0
      ? responseHours.reduce((sum: number, value: number) => sum + value, 0) /
        responseHours.length
      : null;

  const trendByDay = new Map<string, { leads: number; searches: number }>();
  const trends = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekAgo);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    trendByDay.set(key, { leads: 0, searches: 0 });
    return { id: key, date: date.toISOString(), leads: 0, searches: 0 };
  });

  for (const event of analyticsResult.data ?? []) {
    const key = new Date(event.timestamp).toISOString().slice(0, 10);
    const day = trendByDay.get(key);
    if (!day) continue;
    if (event.event_name === 'lead.submit') day.leads += 1;
    if (event.event_name === 'inventory.search') day.searches += 1;
  }

  for (const trend of trends) {
    const counts = trendByDay.get(trend.id);
    trend.leads = counts?.leads ?? 0;
    trend.searches = counts?.searches ?? 0;
  }

  const balance = balanceResult.data;

  return {
    balance: {
      cashBalanceCents: Number(balance?.cash_balance_cents ?? 0),
      includedLeadsRemaining: Number(balance?.included_leads_remaining ?? 0),
      leadPriceCents: Number(balance?.lead_price_cents ?? 2000),
      autoReplenishEnabled: Boolean(balance?.auto_replenish_enabled),
    },
    metrics: [
      {
        id: 'total',
        title: 'Total Leads',
        value: String(leads.length),
        detail: `+${leadsThisWeek} this week`,
        symbol: 'person.2.fill',
      },
      {
        id: 'new',
        title: 'New',
        value: String(newLeads),
        detail: 'Waiting for contact',
        symbol: 'sparkles',
      },
      {
        id: 'close',
        title: 'Close Rate',
        value: leads.length > 0 ? `${closeRate}%` : '—',
        detail: closedLeads > 0 ? `${closedLeads} leads closed` : 'No closed leads yet',
        symbol: 'chart.line.uptrend.xyaxis',
      },
      {
        id: 'response',
        title: 'Avg. Response',
        value: formatResponseTime(averageResponseHours),
        detail: 'First response time',
        symbol: 'clock.fill',
      },
    ],
    trends,
  };
}

async function responseTimeRows(
  auth: DealerMobileAuth,
  dealership: AuthorizedDealership,
): Promise<any[]> {
  let query = auth.supabase
    .from('leads')
    .select('dealer_id, dealership_id, created_at, replied_at')
    .not('replied_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  query = dealership.marketcheckDealerId
    ? query.or(
        `dealership_id.eq.${dealership.id},and(dealership_id.is.null,dealer_id.eq.${dealership.marketcheckDealerId})`,
      )
    : query.eq('dealership_id', dealership.id);

  const { data } = await query;
  return data ?? [];
}

function formatResponseTime(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  return `${hours.toFixed(1)}h`;
}
