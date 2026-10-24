import type { Metadata } from 'next';

import { AnalyticsPanel } from '@/components/dealer/analytics-panel';
import { analyticsSummary } from '@/lib/dealer/mock';
import type { AnalyticsRange } from '@/lib/dealer/types';

export const metadata: Metadata = { title: 'Analytics' };

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d'];

export default function DealerAnalyticsPage() {
  return (
    <AnalyticsPanel summaries={RANGES.map(range => analyticsSummary(range))} />
  );
}
