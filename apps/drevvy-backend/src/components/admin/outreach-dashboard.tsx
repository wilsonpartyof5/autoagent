import Link from 'next/link';

import { InsightsPanel } from '@/components/admin/insights-panel';
import { SmsOptOutLineSettingControl } from '@/components/admin/sms-opt-out-setting';
import { channelLabel, outcomeLabel, stopLabel } from '@/lib/admin/outreach/analytics';
import { hours } from '@/lib/admin/format';
import type { OutreachDeal, OutreachInsight, OutreachReport, SegmentStat, VariantStat } from '@/lib/admin/outreach/types';
import { MIN_VARIANT_SENDS, TOUCHPOINT_IDS } from '@/lib/admin/outreach/types';
import type { SmsOptOutLineAdminState } from '@/lib/sms/settings-admin';

export function OutreachDashboard({
  report,
  insight,
  preview,
  optOutLine,
  smsSettingSaved,
  smsSettingError,
}: {
  report: OutreachReport;
  insight: OutreachInsight;
  preview: OutreachDeal[];
  optOutLine: SmsOptOutLineAdminState;
  smsSettingSaved: 'database' | 'preview' | null;
  smsSettingError: string | null;
}) {
  const maxDay = Math.max(...report.firstReplyByDay.map((row) => row.count), 1);
  const maxStop = Math.max(...report.stops.map((row) => row.count), 1);
  const maxChannel = Math.max(...report.channels.map((row) => row.sent), 1);
  const query = `from=${report.from}&to=${report.to}`;

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Outreach</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Dealer cadence from first touch until the sequence stops. Counts are mock sends shaped like <code>outreach_events</code>. The date range is deals whose first touch falls in it.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/admin/outreach">
          <label className="text-xs text-slate-400">
            From
            <input type="date" name="from" defaultValue={report.from} className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100" />
          </label>
          <label className="text-xs text-slate-400">
            To
            <input type="date" name="to" defaultValue={report.to} className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100" />
          </label>
          <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">Apply</button>
        </form>
      </header>

      <SmsOptOutLineSettingControl
        setting={optOutLine.setting}
        persistence={optOutLine.persistence}
        notice={optOutLine.notice}
        from={report.from}
        to={report.to}
        saved={smsSettingSaved}
        error={smsSettingError}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Deals contacted" value={String(report.kpis.dealsContacted)} detail="First touch in range" />
        <Metric label="Emails sent" value={String(report.kpis.emailsSent)} detail="Delivered or sent" />
        <Metric label="Texts sent" value={String(report.kpis.textsSent)} detail={`${report.kpis.textsSkipped} skipped, not textable`} />
        <Metric label="Calls sent" value={String(report.kpis.callsSent)} detail={`${report.kpis.voicemailsSent} voicemails`} />
        <Metric label="Reply within 5 days" value={percent(report.kpis.replyRateWithin5Days)} detail="Any channel" />
        <Metric label="Median time to reply" value={hours(report.kpis.medianHoursToFirstReply)} detail="From first touch" />
        <Metric label="OTD price received" value={percent(report.kpis.otdReceivedRate)} detail="Itemized price in a reply" />
        <Metric label="Number capture" value={percent(report.kpis.numberCaptureRate)} detail="Captured ÷ connected calls" />
        <Metric label="Opt-out / complaint" value={percent(report.kpis.optOutRate)} detail="STOP or don't call" />
        <Metric label="Sold before reply" value={percent(report.kpis.soldBeforeReplyRate)} detail="Car gone, no reply" />
        <Metric label="Ended, no response" value={String(report.kpis.endedNoResponse)} detail="Closed after D5-E4" />
        <Metric label="Voicemails" value={String(report.kpis.voicemailsSent)} detail="VM-1 after a missed call" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">First reply by cadence day</h3>
          <ol className="mt-4 space-y-2">
            {report.firstReplyByDay.map((row) => (
              <li key={row.day} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 text-sm">
                <span>Day {row.day}</span>
                <Bar value={row.count} max={maxDay} />
                <span>{row.count}</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">Where sequences stop</h3>
          <ol className="mt-4 space-y-2">
            {report.stops.map((row) => (
              <li key={row.reason} className="grid grid-cols-[160px_1fr_auto] items-center gap-3 text-sm">
                <span>{stopLabel(row.reason)}</span>
                <Bar value={row.count} max={maxStop} />
                <span>{row.count}</span>
              </li>
            ))}
          </ol>
        </article>
      </div>

      <article className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-medium">First reply by touchpoint</h3>
        <p className="mt-1 text-xs text-slate-500">Attributed to the last touch sent before the reply.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {report.firstReplyByTouchpoint.map((row) => (
            <span key={row.touchpoint} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
              {row.touchpoint} · {row.count}
            </span>
          ))}
        </div>
      </article>

      <article className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-medium">Variants</h3>
        <p className="mt-1 text-xs text-slate-500">Under {MIN_VARIANT_SENDS} sends, the interval is withheld. A guardrail flags opt-outs above twice the control.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Touchpoint</th>
                <th className="py-2 pr-3">Var</th>
                <th className="py-2 pr-3">Sends</th>
                <th className="py-2 pr-3">Reply</th>
                <th className="py-2 pr-3">Interval</th>
                <th className="py-2 pr-3">Time to reply</th>
                <th className="py-2 pr-3">Opt-outs</th>
                <th className="py-2 pr-3">Traffic</th>
                <th className="py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {TOUCHPOINT_IDS.map((touchpoint) => report.variants.filter((row) => row.touchpoint === touchpoint).map((row) => (
                <tr key={`${row.touchpoint}-${row.variant}`} className="border-t border-slate-800">
                  <td className="py-2 pr-3 font-medium">{row.variant === 'A' ? row.touchpoint : ''}</td>
                  <td className="py-2 pr-3">{row.variant}</td>
                  <td className="py-2 pr-3">{row.sends}</td>
                  <td className="py-2 pr-3">{percent(row.replyRate)}</td>
                  <td className="py-2 pr-3">{row.enoughData ? `${percent(row.ciLow)}–${percent(row.ciHigh)}` : 'not enough data'}</td>
                  <td className="py-2 pr-3">{hours(row.medianHoursToReply)}</td>
                  <td className="py-2 pr-3">{row.optOuts}</td>
                  <td className="py-2 pr-3">{percent(row.trafficShare)}</td>
                  <td className="py-2"><Flags row={row} /></td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">Channel breakdown</h3>
          <ol className="mt-4 space-y-2">
            {report.channels.map((row) => (
              <li key={row.channel} className="grid grid-cols-[100px_1fr_auto] items-center gap-3 text-sm">
                <span>{channelLabel(row.channel)}</span>
                <Bar value={row.sent} max={maxChannel} />
                <span>{row.sent} · {percent(row.replyRate)}</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">Call outcomes</h3>
          <p className="mt-1 text-xs text-slate-500">Average connected-call length {report.avgCallDurationS == null ? '—' : `${report.avgCallDurationS}s`}.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {report.callOutcomes.map((row) => (
              <li key={row.outcome} className="flex justify-between border-b border-slate-800 py-1">
                <span className="capitalize">{outcomeLabel(row.outcome)}</span>
                <span>{row.count}{row.avgDurationS == null ? '' : ` · ${row.avgDurationS}s`}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-medium">Segments</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Segment title="Dealer type" rows={report.segments.dealerType} />
          <Segment title="Brand" rows={report.segments.brand} />
          <Segment title="Region" rows={report.segments.region} />
          <Segment title="Day of week" rows={report.segments.dayOfWeek} note="Sends, not deals" />
          <Segment title="Time of day" rows={report.segments.timeOfDay} note="Morning is before noon, dealer local" />
        </div>
      </article>

      <article className="rounded-xl border border-slate-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Recent conversations</h3>
          <Link href={`/admin/outreach/conversations?${query}`} className="text-sm text-emerald-300">All threads</Link>
        </div>
        <ConversationTable deals={preview.slice(0, 8)} />
      </article>

      <InsightsPanel initial={insight} from={report.from} to={report.to} />
    </section>
  );
}

export function ConversationTable({ deals }: { deals: OutreachDeal[] }) {
  if (deals.length === 0) return <p className="mt-3 text-sm text-slate-400">No threads in this filter.</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-3">Dealer</th>
            <th className="py-2 pr-3">Buyer</th>
            <th className="py-2 pr-3">Vehicle</th>
            <th className="py-2 pr-3">Stop</th>
            <th className="py-2">Touches</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id} className="border-t border-slate-800">
              <td className="py-2 pr-3">
                <Link href={`/admin/outreach/conversations/${deal.id}`} className="text-emerald-300">{deal.dealerName}</Link>
                <p className="text-xs text-slate-500">{deal.dealerType} · {deal.region}</p>
              </td>
              <td className="py-2 pr-3">{deal.shopperFirst}</td>
              <td className="py-2 pr-3">{deal.vehicleShort} · #{deal.stock}</td>
              <td className="py-2 pr-3">{stopLabel(deal.stop)}</td>
              <td className="py-2">{deal.events.filter((event) => event.direction === 'outbound').length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Segment({ title, rows, note }: { title: string; rows: SegmentStat[]; note?: string }) {
  const max = Math.max(...rows.map((row) => row.deals), 1);
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      {note ? <p className="text-xs text-slate-500">{note}</p> : null}
      <ol className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
            <span className="capitalize">{row.label}</span>
            <Bar value={row.deals} max={max} />
            <span>{row.deals} · {percent(row.replyRate)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Flags({ row }: { row: VariantStat }) {
  return (
    <span className="flex flex-wrap gap-1">
      {row.winner ? <Chip className="bg-emerald-400/15 text-emerald-200">Winner</Chip> : null}
      {row.loser ? <Chip className="bg-rose-400/15 text-rose-200">Loser</Chip> : null}
      {row.guardrail ? <Chip className="bg-amber-400/15 text-amber-100">Guardrail</Chip> : null}
    </span>
  );
}

function Chip({ children, className }: { children: string; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>{children}</span>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="block h-2 rounded-full bg-slate-800">
      <span className="block h-2 rounded-full bg-emerald-400" style={{ width: `${width}%` }} />
    </span>
  );
}

function percent(value: number | null): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}
