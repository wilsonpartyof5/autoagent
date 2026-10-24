import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/dealer/settings-panel';

export const metadata: Metadata = { title: 'Settings' };

export default function DealerSettingsPage() {
  return <SettingsPanel />;
}
