import type { ReactNode } from 'react';

import { when } from '@/lib/admin/format';
import {
  CHANNEL_LABEL,
  MONITOR_CHANNELS,
  MONITOR_STATUSES,
  STATUS_LABEL,
  type ChannelReplyRate,
  type MonitorStatus,
  type OutreachMonitorRow,
  type OutreachMonitorView,
} from '@/lib/admin/outreach-monitor';

export function OutreachMonitor({ view }: { view: OutreachMonitorView }) {
  const maxRate = Math.max(...view.replyRates.map((rate) => rate.replyRate ?? 0), 0.01);

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold">Outreach monitor</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">{sourceCopy(view.source, view.partial)}</p>
      </header>

      <form className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 lg:grid-cols-3" action="/admin/outreach/monitor">
        <Field label="Search">
          <input
            name="q"
            defaultValue={view.filters.q}
            placeholder="Dealer, deal, vehicle, reply"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
          />
        </Field>
        <Field label="Dealer">
          <select name="dealer" defaultValue={view.filters.dealer} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
            <option value="">Any dealer</option>
            {view.dealers.map((dealer) => (
              <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Channel used">
          <select name="channel" defaultValue={view.filters.channel} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
            <option value="">Any channel</option>
            {MONITOR_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>{CHANNEL_LABEL[channel]}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={view.filters.status} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
            <option value="">Any status</option>
            {MONITOR_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABEL[status]}</option>
            ))}
          </select>
        </Field>
        <Field label="Cadence day">
          <select name="day" defaultValue={view.filters.cadenceDay == null ? '' : String(view.filters.cadenceDay)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
            <option value="">Any day</option>
            {view.cadenceDays.map((day) => (
              <option key={day} value={day}>Day {day}</option>
            ))}
          </select>
        </Field>
        <Field label="Traffic">
          <select name="traffic" defaultValue={view.filters.traffic} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
            <option value="live">Live only</option>
            <option value="test">Test only</option>
            <option value="all">Live and test</option>
          </select>
        </Field>
        <Field label="First reply">
          <select name="first" defaultValue={view.filters.firstReply} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
            <option value="">Any first reply</option>
            {MONITOR_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>{CHANNEL_LABEL[channel]}</option>
            ))}
          </select>
        </Field>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950">Apply filters</button>
          <a href="/admin/outreach/monitor" className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Clear</a>
        </div>
      </form>

      <article className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-medium">Reply rate by channel</h3>
        <p className="mt-1 text-sm text-slate-400">
          First replies on that channel, divided by live dealer-deal rows that used it. Test traffic is left out of these rates. {view.rows.length} rows match the filters. {view.total} live rows are in this book.
        </p>
        <ol className="mt-4 space-y-3">
          {view.replyRates.map((rate) => (
            <RateRow key={rate.channel} rate={rate} max={maxRate} />
          ))}
        </ol>
      </article>

      {view.rows.length === 0 ? (
        <p className="rounded-xl border border-slate-800 px-4 py-8 text-sm text-slate-400">No outreach matches these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Dealer</th>
                <th className="px-3 py-3 font-medium">Deal</th>
                <th className="px-3 py-3 font-medium">Channels</th>
                <th className="px-3 py-3 font-medium">Timestamps</th>
                <th className="px-3 py-3 font-medium">First reply</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Dealer reply</th>
                <th className="px-3 py-3 font-medium">Cadence day</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <MonitorRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MonitorRow({ row }: { row: OutreachMonitorRow }) {
  return (
    <tr className="border-t border-slate-800 align-top">
      <td className="px-3 py-3">
        <p className="font-medium">
          {row.dealerName}
          {row.isTest ? <span className="ml-2 inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-100">TEST</span> : null}
        </p>
        <p className="text-xs text-slate-500">{row.dealerId}</p>
      </td>
      <td className="px-3 py-3">
        <p>{row.vehicle}</p>
        <p className="text-xs text-slate-500">{row.dealId}{row.shopperFirst ? ` · ${row.shopperFirst}` : ''}</p>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {row.channels.map((channel) => (
            <span key={channel} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">{CHANNEL_LABEL[channel]}</span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-slate-300">
        <ul className="space-y-1">
          {row.touches.map((touch) => (
            <li key={`${touch.channel}-${touch.at}-${touch.direction}`}>
              {CHANNEL_LABEL[touch.channel]} · {when(touch.at)} · {touch.direction === 'inbound' ? 'in' : 'out'}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-3 py-3">
        {row.firstReplyChannel ? (
          <>
            <p>{CHANNEL_LABEL[row.firstReplyChannel]}</p>
            <p className="text-xs text-slate-500">{when(row.firstReplyAt)}</p>
          </>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </td>
      <td className="px-3 py-3"><StatusPill status={row.status} /></td>
      <td className="max-w-xs px-3 py-3 text-slate-300">{row.dealerReplyText ?? '—'}</td>
      <td className="px-3 py-3">{row.cadenceDay == null ? '—' : `Day ${row.cadenceDay}`}</td>
    </tr>
  );
}

function RateRow({ rate, max }: { rate: ChannelReplyRate; max: number }) {
  const width = rate.replyRate == null ? 0 : Math.round((rate.replyRate / max) * 100);
  return (
    <li className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span>{CHANNEL_LABEL[rate.channel]}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-800">
        <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${width}%` }} />
      </span>
      <span className="text-slate-300">
        {formatRate(rate.replyRate)} · {rate.replies}/{rate.attempts}
      </span>
    </li>
  );
}

function StatusPill({ status }: { status: MonitorStatus }) {
  const tone = status === 'replied'
    ? 'bg-emerald-400/15 text-emerald-200'
    : status === 'waiting'
      ? 'bg-slate-700 text-slate-200'
      : status === 'no_response'
        ? 'bg-amber-400/15 text-amber-100'
        : 'bg-rose-400/15 text-rose-100';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{STATUS_LABEL[status]}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function sourceCopy(source: 'live' | 'demo', partial: boolean): string {
  if (source === 'demo') {
    return 'widget_chat_attempts and the outreach tables are empty or not present, so this monitor is showing the demo book. Nothing was written and no migration was applied.';
  }
  const base = 'Rows come from widget_chat_attempts, outreach_events, shopper_outreach_messages, and brain_vendor_events. First reply uses first_reply_channel when that column is present. Test calls and texts are hidden unless the traffic filter includes them.';
  return partial
    ? `${base} One of those tables was missing or could not be read in full, so the missing piece is left out.`
    : base;
}
