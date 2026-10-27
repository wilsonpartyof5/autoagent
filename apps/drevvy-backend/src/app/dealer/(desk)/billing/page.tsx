import { SettingsPanel } from '@/components/dealer/settings-panel';
import { billingSnapshot } from '@/lib/dealer/mock';

export const metadata = { title: 'Billing' };

export default function DealerBillingPage() {
  return <SettingsPanel billing={billingSnapshot()} />;
}
