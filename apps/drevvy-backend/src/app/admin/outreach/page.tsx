import { CommunicationsLog } from '@/components/admin/communications-log';
import { ConversationIdentities } from '@/components/admin/conversation-identities';
import { OutreachDashboard } from '@/components/admin/outreach-dashboard';
import { loadStoredCommunications } from '@/lib/admin/communications-store';
import { loadIdentityAdmin } from '@/lib/admin/identities';
import { getOutreachInsight } from '@/lib/admin/outreach/insights';
import { loadConversations, loadOutreachReport, parseOutreachRange, parseTrafficFilter } from '@/lib/admin/outreach/repository';
import { readSmsOptOutLineAdminState } from '@/lib/sms/settings-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach | Drevvy Admin' };

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; traffic?: string; notice?: string; smsSetting?: string; smsSettingError?: string }>;
}) {
  const params = await searchParams;
  const range = parseOutreachRange(params.from, params.to);
  const traffic = parseTrafficFilter(params.traffic);
  const [report, insight, preview, stored, optOutLine, identities] = await Promise.all([
    loadOutreachReport(range),
    getOutreachInsight(range),
    loadConversations({ ...range, traffic }),
    loadStoredCommunications(traffic),
    readSmsOptOutLineAdminState(),
    loadIdentityAdmin(traffic),
  ]);
  return (
    <div className="space-y-8">
      <ConversationIdentities admin={identities} traffic={traffic} from={range.from} to={range.to} notice={params.notice ?? null} />
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
