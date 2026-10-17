import { OutreachDashboard } from '@/components/admin/outreach-dashboard';
import { getOutreachInsight } from '@/lib/admin/outreach/insights';
import { loadConversations, loadOutreachReport, parseOutreachRange } from '@/lib/admin/outreach/repository';
import { readSmsOptOutLineAdminState } from '@/lib/sms/settings-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach | Drevvy Admin' };

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; smsSetting?: string; smsSettingError?: string }>;
}) {
  const params = await searchParams;
  const range = parseOutreachRange(params.from, params.to);
  const [report, insight, preview, optOutLine] = await Promise.all([
    loadOutreachReport(range),
    getOutreachInsight(range),
    loadConversations(range),
    readSmsOptOutLineAdminState(),
  ]);
  return (
    <OutreachDashboard
      report={report}
      insight={insight}
      preview={preview}
      optOutLine={optOutLine}
      smsSettingSaved={params.smsSetting === 'database' || params.smsSetting === 'preview' ? params.smsSetting : null}
      smsSettingError={params.smsSettingError ?? null}
    />
  );
}
