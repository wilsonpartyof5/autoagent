import { SettingsPanel } from '@/components/dealer/settings-panel';
import { loadDeskBilling } from '@/lib/dealer/desk-data';
import { requireDealerPageSession } from '@/lib/dealer/session';

export const metadata = { title: 'Billing' };

export default async function DealerBillingPage() {
  const session = await requireDealerPageSession();
  return (
    <SettingsPanel
      billing={await loadDeskBilling(session)}
      profile={session ? { name: session.displayName, email: session.email } : null}
      rooftops={session?.rooftops ?? []}
    />
  );
}
