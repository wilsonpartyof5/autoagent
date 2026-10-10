'use client';

import { useState } from 'react';

import type { OutreachInsight } from '@/lib/admin/outreach/types';

export function InsightsPanel({
  initial,
  from,
  to,
}: {
  initial: OutreachInsight;
  from: string;
  to: string;
}) {
  const [insight, setInsight] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/outreach/insights?from=${from}&to=${to}`, { method: 'POST' });
      if (!response.ok) throw new Error('The insight request failed.');
      const payload = await response.json() as { data?: OutreachInsight };
      if (!payload.data) throw new Error('The insight response was empty.');
      setInsight(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The insight request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-xl border border-amber-400/30 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-amber-100">AI insights</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{insight.label}</p>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          className="rounded-md bg-amber-400 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
        >
          {loading ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InsightList title="What's working" items={insight.working} />
        <InsightList title="What's not" items={insight.notWorking} />
        <InsightList title="Bottlenecks" items={insight.bottlenecks} />
        <InsightList title="Suggested next steps" items={insight.nextSteps} />
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-medium">Proposed variants</h4>
        <ul className="mt-2 space-y-3">
          {insight.proposedVariants.map((row) => (
            <li key={`${row.touchpoint}-${row.hypothesis}`} className="rounded-lg border border-slate-800 p-3 text-sm">
              <p className="font-medium text-slate-100">{row.touchpoint}</p>
              <p className="mt-1 text-slate-300">{row.hypothesis}</p>
              <p className="mt-2 text-slate-400">{row.sketch}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Suggestions only. Regenerating does not change the cadence or assign a new control.</p>
      </div>
    </article>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-300">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
