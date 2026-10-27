import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/dealer/settings-panel';
import { billingSnapshot } from '@/lib/dealer/mock';

export const metadata: Metadata = { title: 'Settings' };

export default function DealerSettingsPage() {
  return <SettingsPanel billing={billingSnapshot()} />;
}
