import { buildAnalytics } from '@/lib/admin/analytics';
import { hours, pct, stageLabel, usd } from '@/lib/admin/format';
import { FUNNEL_EVENT_NAME, FUNNEL_STEP_LABEL } from '@/lib/admin/types';

export const metadata = { title: 'Analytics | Drevvy Admin' };

export default async function AdminAnalyticsPage() {
  const analytics = buildAnalytics();
  const maxFunnel = Math.max(...analytics.funnel.map((step) => step.count), 1);

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold">Shopper analytics</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Counts come from the mock book, shaped like rows in <code>app_events</code>. Live signup and chat events already land there. Deal and payment steps are the names to write next. MRR is {usd(analytics.mrrUsd)} from {analytics.activeSubscribers} active subscriptions at $97. {analytics.churnNote}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="MRR" value={usd(analytics.mrrUsd)} detail={`${analytics.churnedSubscribers} canceled`} />
        <Metric label="Avg savings vs listed" value={analytics.averageSavingsUsd == null ? '—' : usd(Math.round(analytics.averageSavingsUsd))} detail={analytics.averageSavingsPct == null ? '—' : `${analytics.averageSavingsPct.toFixed(1)}%`} />
        <Metric label="Time to first reply" value={hours(analytics.medianHoursToFirstReply)} detail="Median after first outbound" />
        <Metric label="Time to best price" value={hours(analytics.medianHoursToBestPrice)} detail="Median from car added" />
        <Metric label="Messages / deal" value={analytics.messagesPerDeal == null ? '—' : analytics.messagesPerDeal.toFixed(1)} detail={`Cadence reply rate ${pct(analytics.cadenceReplyRate == null ? null : analytics.cadenceReplyRate * 100)}`} />
        <Metric label="Active cars" value={String(analytics.activeCars)} detail={`${analytics.subscribersAtCap} subscribers at the 10-car cap`} />
        <Metric label="LLM cost / deal" value={analytics.llmCostPerDeal == null ? '—' : `$${analytics.llmCostPerDeal.toFixed(2)}`} detail={`${usd(Math.round(analytics.totalLlmCostUsd))} mock total`} />
        <Metric label="Subscribers" value={String(analytics.activeSubscribers)} detail="Placeholder until payments are real" />
      </div>

      <article className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-medium">Funnel</h3>
        <ol className="mt-4 space-y-2">
          {analytics.funnel.map((step) => (
            <li key={step.step} className="grid grid-cols-[180px_1fr_auto] items-center gap-3 text-sm">
              <span>{FUNNEL_STEP_LABEL[step.step]}</span>
              <span className="h-2 rounded-full bg-slate-800">
                <span className="block h-2 rounded-full bg-emerald-400" style={{ width: `${(step.count / maxFunnel) * 100}%` }} />
              </span>
              <span className="text-slate-300">{step.count}</span>
            </li>
          ))}
        </ol>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">Deals by stage</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {analytics.dealsByStage.map((row) => (
              <li key={row.stage} className="flex justify-between border-b border-slate-800 py-1">
                <span>{stageLabel(row.stage)}</span>
                <span>{row.count}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium">Response rate by channel</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {analytics.responseRateByChannel.map((row) => (
              <li key={row.channel} className="flex justify-between border-b border-slate-800 py-1">
                <span className="uppercase">{row.channel}</span>
                <span>{row.replies}/{row.sent} · {row.rate == null ? '—' : pct(row.rate * 100)}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
        <h3 className="font-medium text-slate-100">app_events names</h3>
        <p className="mt-1 text-slate-400">Store these on <code>app_events</code> with <code>source = dashboard</code> and <code>payload.consumer_user_id</code>. Dealer ids stay out of shopper-visible payloads.</p>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {Object.entries(FUNNEL_EVENT_NAME).map(([step, name]) => (
            <li key={step}><code>{name}</code></li>
          ))}
        </ul>
      </article>
    </section>
  );
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
