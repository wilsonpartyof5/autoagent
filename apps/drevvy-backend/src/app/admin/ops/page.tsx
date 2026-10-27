import { buildAnalytics } from '@/lib/admin/analytics';
import { loadDealsOverview } from '@/lib/admin/deals-overview-store';
import { usd } from '@/lib/admin/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ops | Drevvy Admin' };

export default async function AdminOpsPage() {
  const [analytics, overview] = await Promise.all([
    Promise.resolve(buildAnalytics()),
    loadDealsOverview(),
  ]);
  const sold = overview.counts.sold;
  const closeFees = sold * 300;

  return (
    <div className="space-y-4">
      <div className="row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <article className="g card">
          <div className="lab">Active dealer convos</div>
          <div className="num">{analytics.activeCars}</div>
          <div className="up">in-network chat</div>
        </article>
        <article className="g card">
          <div className="lab">Close fees MTD</div>
          <div className="num">{usd(closeFees)}</div>
          <div className="up">
            {sold} × $300
          </div>
        </article>
        <article className="g card">
          <div className="lab">MRR</div>
          <div className="num">{usd(analytics.mrrUsd)}</div>
          <div className="mut">{analytics.activeSubscribers} active</div>
        </article>
        <article className="g card">
          <div className="lab">Time to first reply</div>
          <div className="num">
            {analytics.medianHoursToFirstReply == null
              ? '—'
              : `${analytics.medianHoursToFirstReply.toFixed(1)}h`}
          </div>
          <div className="mut">median after first outbound</div>
        </article>
        <article className="g card">
          <div className="lab">Refunds noted</div>
          <div className="num">{analytics.churnedSubscribers}</div>
          <div className="dn">canceled subs in the book</div>
        </article>
      </div>
      <div className="row" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <article className="g card">
          <div className="t">Conversation funnel</div>
          <div className="bar" style={{ width: '100%' }}>
            Active cars {analytics.activeCars}
          </div>
          <div className="bar" style={{ width: '48%' }}>
            Dealer convo started {overview.counted}
          </div>
          <div className="bar" style={{ width: '36%' }}>
            Itemized OTD path {overview.counts.accepted}
          </div>
          <div className="bar" style={{ width: '12%' }}>
            Sold {sold}
          </div>
        </article>
        <article className="g card">
          <div className="t">Alerts</div>
          <div className="kc">
            Airport Kia · median reply 31m <span className="chip c-no">slow</span>
          </div>
          <div className="kc">Midtown Toyota · terms v2026.10 accepted</div>
          <div className="kc">2 dealer groups pending approval</div>
        </article>
      </div>
    </div>
  );
}
