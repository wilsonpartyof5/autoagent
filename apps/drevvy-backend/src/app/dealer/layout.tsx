import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { GlassRoot, GlassThemeScript } from '@/components/glass/glass-theme';
import { loadDealerPageSession } from '@/lib/dealer/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Drevvy Desk',
    template: '%s · Drevvy Desk',
  },
  robots: { index: false, follow: false },
};

export default async function DealerLayout({ children }: { children: ReactNode }) {
  let rooftops: Array<{ id: string; name: string }> = [];
  let canSwitchAllRooftops = false;
  try {
    const session = await loadDealerPageSession();
    if (session) {
      rooftops = session.rooftops.map((rooftop) => ({ id: rooftop.id, name: rooftop.name }));
      canSwitchAllRooftops = session.canSwitchAllRooftops;
    }
  } catch {
    rooftops = [];
  }

  return (
    <>
      <GlassThemeScript />
      <GlassRoot rooftops={rooftops} canSwitchAllRooftops={canSwitchAllRooftops}>
        {children}
      </GlassRoot>
    </>
  );
}
