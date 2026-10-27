'use client';

import { useState } from 'react';

import { useGlassTheme } from '@/components/glass/glass-theme';
import { RANGE_LABEL } from '@/lib/dealer/format';
import type { AnalyticsRange, AnalyticsSummary } from '@/lib/dealer/types';

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d'];

export function AnalyticsPanel({
  summaries,
}: {
  summaries: AnalyticsSummary[];
}) {
  const { rooftopLabel } = useGlassTheme();
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const summary = summaries.find(item => item.range === range) ?? summaries[0];

  const cards = [
    { label: 'Reply rate', value: `${Math.round(summary.replyRate * 100)}%` },
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
    { label: 'Itemized OTD shared', value: String(summary.numbersShared) },
  ];

  return (
    <div>
      <p className="mut" style={{ marginBottom: 12 }}>
        Sample counts for {rooftopLabel}. Not live. Reply rate, time to first
        reply, conversations, and itemized out-the-door shares.
      </p>
      <div className="pills" role="group" aria-label="Date range">
        {RANGES.map(value => (
          <button
            key={value}
            type="button"
            className={`pill${value === range ? ' on' : ''}`}
            aria-pressed={value === range}
            onClick={() => setRange(value)}
          >
            {RANGE_LABEL[value]}
          </button>
        ))}
      </div>
      <div className="row stats-5" style={{ marginTop: 16 }}>
        {cards.map(card => (
          <div key={card.label} className="g card">
            <div className="lab">{card.label}</div>
            <div className="num">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
