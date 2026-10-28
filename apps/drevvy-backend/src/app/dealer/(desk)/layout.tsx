import type { ReactNode } from 'react';

import { DealerShell } from '@/components/dealer/dealer-shell';
import { requireDealerPageSession } from '@/lib/dealer/session';

export const dynamic = 'force-dynamic';

export default async function DealerDeskLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireDealerPageSession();
  return <DealerShell initials={session?.initials ?? 'D'}>{children}</DealerShell>;
}
