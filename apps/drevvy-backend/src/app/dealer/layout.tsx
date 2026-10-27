import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { GlassRoot, GlassThemeScript } from '@/components/glass/glass-theme';

export const metadata: Metadata = {
  title: {
    default: 'Drevvy Desk',
    template: '%s · Drevvy Desk',
  },
  robots: { index: false, follow: false },
};

export default function DealerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GlassThemeScript />
      <GlassRoot>{children}</GlassRoot>
    </>
  );
}
