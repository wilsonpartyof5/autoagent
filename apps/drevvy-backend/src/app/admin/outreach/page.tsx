import { OutreachDashboard } from '@/components/admin/outreach-dashboard';
import { getOutreachInsight } from '@/lib/admin/outreach/insights';
import { loadConversations, loadOutreachReport, parseOutreachRange } from '@/lib/admin/outreach/repository';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach | Drevvy Admin' };

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = parseOutreachRange(params.from, params.to);
  const [report, insight, preview] = await Promise.all([
    loadOutreachReport(range),
    getOutreachInsight(range),
    loadConversations(range),
  ]);
  return <OutreachDashboard report={report} insight={insight} preview={preview} />;
}
