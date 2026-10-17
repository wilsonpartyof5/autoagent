import { CommunicationsLog } from '@/components/admin/communications-log';
import { OutreachDashboard } from '@/components/admin/outreach-dashboard';
import { loadStoredCommunications } from '@/lib/admin/communications-store';
import { getOutreachInsight } from '@/lib/admin/outreach/insights';
import { loadConversations, loadOutreachReport, parseOutreachRange, parseTrafficFilter } from '@/lib/admin/outreach/repository';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach | Drevvy Admin' };

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; traffic?: string }>;
}) {
  const params = await searchParams;
  const range = parseOutreachRange(params.from, params.to);
  const traffic = parseTrafficFilter(params.traffic);
  const [report, insight, preview, stored] = await Promise.all([
    loadOutreachReport(range),
    getOutreachInsight(range),
    loadConversations({ ...range, traffic }),
    loadStoredCommunications(traffic),
  ]);
  return (
    <div className="space-y-8">
      <CommunicationsLog rows={stored.rows} traffic={traffic} from={range.from} to={range.to} configured={stored.configured} />
      <OutreachDashboard report={report} insight={insight} preview={preview} traffic={traffic} />
    </div>
  );
}
