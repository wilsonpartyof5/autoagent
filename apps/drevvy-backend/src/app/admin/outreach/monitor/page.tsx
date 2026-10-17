import { OutreachMonitor } from '@/components/admin/outreach-monitor';
import { parseMonitorFilters } from '@/lib/admin/outreach-monitor';
import { loadOutreachMonitor } from '@/lib/admin/outreach-monitor-store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach monitor | Drevvy Admin' };

export default async function OutreachMonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dealer?: string; channel?: string; status?: string; day?: string; first?: string }>;
}) {
  const params = await searchParams;
  const view = await loadOutreachMonitor(parseMonitorFilters(params));
  return <OutreachMonitor view={view} />;
}
