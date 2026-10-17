import { CommunicationsLog } from '@/components/admin/communications-log';
import { OutreachDashboard } from '@/components/admin/outreach-dashboard';
import { loadStoredCommunications } from '@/lib/admin/communications-store';
import { getOutreachInsight } from '@/lib/admin/outreach/insights';
import { loadConversations, loadOutreachReport, parseOutreachRange, parseTrafficFilter } from '@/lib/admin/outreach/repository';
import { readSmsOptOutLineAdminState } from '@/lib/sms/settings-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach | Drevvy Admin' };

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; traffic?: string; smsSetting?: string; smsSettingError?: string }>;
}) {
  const params = await searchParams;
  const range = parseOutreachRange(params.from, params.to);
  const traffic = parseTrafficFilter(params.traffic);
  const [report, insight, preview, stored, optOutLine] = await Promise.all([
    loadOutreachReport(range),
    getOutreachInsight(range),
    loadConversations({ ...range, traffic }),
    loadStoredCommunications(traffic),
    readSmsOptOutLineAdminState(),
  ]);
  return (
    <div className="space-y-8">
      <CommunicationsLog rows={stored.rows} traffic={traffic} from={range.from} to={range.to} configured={stored.configured} />
      <OutreachDashboard
        report={report}
        insight={insight}
        preview={preview}
        traffic={traffic}
        optOutLine={optOutLine}
        smsSettingSaved={params.smsSetting === 'database' || params.smsSetting === 'preview' ? params.smsSetting : null}
        smsSettingError={params.smsSettingError ?? null}
      />
    </div>
  );
}
