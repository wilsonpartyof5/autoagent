'use client';

import { useState } from 'react';

import { RANGE_LABEL } from '@/lib/dealer/format';
import type { AnalyticsRange, AnalyticsSummary } from '@/lib/dealer/types';

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d'];

export function AnalyticsPanel({
  summaries,
}: {
  summaries: AnalyticsSummary[];
}) {
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const summary = summaries.find(item => item.range === range) ?? summaries[0];

  const cards = [
    {
      label: 'Reply rate',
      value: `${Math.round(summary.replyRate * 100)}%`,
    },
    {
      label: 'Median first reply',
      value: `${summary.medianFirstReplyMinutes} min`,
    },
    {
      label: 'Conversations started',
      value: String(summary.conversationsStarted),
    },
    {
      label: 'Conversations closed',
      value: String(summary.conversationsClosed),
    },
    {
      label: 'Numbers shared',
      value: String(summary.numbersShared),
    },
  ];

  return (
    <div className="h-full overflow-y-auto px-5 py-6">
      <h1 className="text-lg font-extrabold">Analytics</h1>
      <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
        Sample counts for Demo Rooftop. Not live. Reply rate, time to first
        reply, conversations, and numbers shared.
      </p>
      <div className="mt-4 flex gap-2" role="group" aria-label="Date range">
        {RANGES.map(value => {
          const selected = value === range;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setRange(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selected
                  ? 'bg-[#171A2C] text-white'
                  : 'border border-border bg-card text-foreground'
              }`}
            >
              {RANGE_LABEL[value]}
            </button>
          );
        })}
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(card => (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <dt className="text-xs font-semibold text-muted-foreground">
              {card.label}
            </dt>
            <dd className="mt-2 text-2xl font-extrabold">{card.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
