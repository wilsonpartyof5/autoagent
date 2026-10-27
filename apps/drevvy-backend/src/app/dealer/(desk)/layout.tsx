import type { ReactNode } from 'react';

import { DealerShell } from '@/components/dealer/dealer-shell';

export const dynamic = 'force-dynamic';

export default function DealerDeskLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DealerShell>{children}</DealerShell>;
}
