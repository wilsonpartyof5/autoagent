import { OVERVIEW_STATUSES, OVERVIEW_STATUS_LABEL } from '@/lib/admin/deals-overview';
import { loadDealsOverview } from '@/lib/admin/deals-overview-store';
import { hours } from '@/lib/admin/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Deals | Drevvy Admin' };

export default async function AdminDealsPage() {
  const overview = await loadDealsOverview();
  const rounds = overview.averagePriceDropRounds == null
    ? '—'
    : (Math.round(overview.averagePriceDropRounds * 10) / 10).toFixed(1);

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold">Deals overview</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">{sourceCopy(overview.source, overview.partial)}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OVERVIEW_STATUSES.map((status) => (
          <article key={status} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{OVERVIEW_STATUS_LABEL[status]}</p>
            <p className="mt-1 text-2xl font-semibold">{overview.counts[status]}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">Average dealer response time</h3>
          <p className="mt-2 text-2xl font-semibold">{hours(overview.averageResponseHours)}</p>
          <p className="mt-1 text-sm text-slate-400">
            {overview.replies === 0
              ? 'No replies to average yet.'
              : `Mean time from the first outbound message to the first dealer reply, across ${overview.replies} deals.`}
          </p>
        </article>
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">Price-drop rounds</h3>
          <p className="mt-2 text-2xl font-semibold">{rounds}</p>
          <p className="mt-1 text-sm text-slate-400">
            {overview.source === 'demo'
              ? 'Average recorded price drops per car in the demo book.'
              : 'Average per deal. A round is a later offer that comes in lower than the one before it.'}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {overview.roundBuckets.map((bucket) => (
              <li key={bucket.label} className="flex justify-between border-b border-slate-800 py-1">
                <span>{bucket.label} {bucket.label === '1' ? 'round' : 'rounds'}</span>
                <span>{bucket.count}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <p className="text-xs text-slate-500">
        {overview.counted} deals in these four statuses.
        {overview.excluded > 0 ? ` ${overview.excluded} ended another way and stay out of the counts.` : ''}
      </p>
    </section>
  );
}

function sourceCopy(source: 'live' | 'demo', partial: boolean): string {
  if (source === 'demo') {
    return 'Deal tables are empty, so these figures use the demo book. Sold is a completed purchase. Accepted is a ready price the shopper has not bought. No response is outreach with no reply. Every other open car is active.';
  }
  const base = 'Counts come from shopper_deals and shopper_deal_lifecycle. Response time is the first outreach to the first reply. Price-drop rounds come from shopper_offers.';
  return partial ? `${base} Some related rows could not be read, so the missing pieces stay at zero.` : base;
}
