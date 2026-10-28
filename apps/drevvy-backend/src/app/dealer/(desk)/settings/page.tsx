import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/dealer/settings-panel';
import { loadDeskBilling } from '@/lib/dealer/desk-data';
import { requireDealerPageSession } from '@/lib/dealer/session';

export const metadata: Metadata = { title: 'Settings' };

export default async function DealerSettingsPage() {
  const session = await requireDealerPageSession();
  return (
    <SettingsPanel
      billing={await loadDeskBilling(session)}
      profile={session ? { name: session.displayName, email: session.email } : null}
      rooftops={session?.rooftops ?? []}
    />
  );
}
