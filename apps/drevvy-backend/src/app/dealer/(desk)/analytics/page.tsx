import type { Metadata } from 'next';

import { AnalyticsPanel } from '@/components/dealer/analytics-panel';
import { loadDeskAnalytics } from '@/lib/dealer/desk-data';
import { requireDealerPageSession } from '@/lib/dealer/session';

export const metadata: Metadata = { title: 'Analytics' };

export default async function DealerAnalyticsPage() {
  const session = await requireDealerPageSession();
  return <AnalyticsPanel summaries={await loadDeskAnalytics(session)} />;
}
