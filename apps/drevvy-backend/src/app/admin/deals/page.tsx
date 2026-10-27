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
      <p className="mut">{sourceCopy(overview.source, overview.partial)}</p>
      <div className="kan">
        <div className="g card">
          <span className="chip c-new">New</span>
          <div className="kc">
            <b>Jordan · CR-V EX-L</b>
            <div className="mut">Lakeside Auto Group</div>
          </div>
          <div className="kc">
            <b>Morgan · Civic EX</b>
            <div className="mut">Lakeside Auto Group</div>
          </div>
        </div>
        <div className="g card">
          <span className="chip c-chat">In chat</span>
          <div className="kc">
            <b>Avery · Accord Sport</b>
            <div className="mut">Lakeside Auto Group</div>
          </div>
          <div className="kc">
            <b>Riley · RAV4 XLE</b>
            <div className="mut">Lakeside Auto Group</div>
          </div>
        </div>
        <div className="g card">
          <span className="chip c-wait">OTD shared</span>
          <div className="kc">
            <b>Sam · Camry SE</b>
            <div className="mut">Lakeside Auto Group</div>
          </div>
        </div>
        <div className="g card">
          <span className="chip c-no">No reply</span>
          <div className="kc">
            <b>Taylor · Sorento LX</b>
            <div className="mut">Lakeside Auto Group</div>
          </div>
        </div>
        <div className="g card">
          <span className="chip c-sold">Closed–sold</span>
          <div className="kc">
            <b>Casey · Tacoma TRD</b>
            <div className="mut">Lakeside Auto Group</div>
          </div>
        </div>
      </div>

      <div className="row pair">
        {OVERVIEW_STATUSES.map((status) => (
          <article key={status} className="g card">
            <p className="lab">{OVERVIEW_STATUS_LABEL[status]}</p>
            <p className="num">{overview.counts[status]}</p>
          </article>
        ))}
      </div>

      <div className="row pair">
        <article className="g card">
          <h3 className="t">Average dealer response time</h3>
          <p className="num">{hours(overview.averageResponseHours)}</p>
          <p className="mut">
            {overview.replies === 0
              ? 'No replies to average yet.'
              : `Mean time from the first outbound message to the first dealer reply, across ${overview.replies} deals.`}
          </p>
        </article>
        <article className="g card">
          <h3 className="t">Price-drop rounds</h3>
          <p className="num">{rounds}</p>
          <p className="mut">
            {overview.source === 'demo'
              ? 'Average recorded price drops per car in the demo book.'
              : 'Average per deal. A round is a later offer that comes in lower than the one before it.'}
          </p>
          <table className="tbl" style={{ marginTop: 12 }}>
            <tbody>
              {overview.roundBuckets.map((bucket) => (
                <tr key={bucket.label}>
                  <td>{bucket.label} {bucket.label === '1' ? 'round' : 'rounds'}</td>
                  <td>{bucket.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>

      <p className="mut">
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
