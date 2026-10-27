'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/glass/glass-theme';

const rail = [
  { href: '/admin/ops', label: 'Ops', icon: '◔' },
  { href: '/admin/deals', label: 'Deals', icon: '▦' },
  { href: '/admin', label: 'Users', icon: '👤' },
  { href: '/admin/dealers', label: 'Dealers', icon: '⌂' },
  { href: '/admin/terms-log', label: 'Terms log', icon: '✓' },
];

const pills = [
  { href: '/admin/ops', label: 'Ops' },
  { href: '/admin/deals', label: 'Deals' },
  { href: '/admin', label: 'Users' },
  { href: '/admin/dealers', label: 'Dealers' },
  { href: '/admin/terms-log', label: 'Terms log' },
  { href: '/admin/outreach', label: 'Outreach' },
  { href: '/admin/costs', label: 'Costs' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/shoppers');
  }
  if (href === '/admin/outreach') {
    return pathname.startsWith('/admin/outreach');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageMeta(pathname: string): { crumb: string; title: string } {
  if (pathname.startsWith('/admin/deals')) {
    return { crumb: 'Kanban · all rooftops', title: 'Deals / Outreach' };
  }
  if (pathname.startsWith('/admin/dealers')) {
    return { crumb: 'Groups → rooftops', title: 'Dealers / Rooftops' };
  }
  if (pathname.startsWith('/admin/terms-log')) {
    return { crumb: 'Audit · in-network messaging terms', title: 'Terms acceptance log' };
  }
  if (pathname.startsWith('/admin/outreach/monitor')) {
    return { crumb: 'admin.drevvy.com', title: 'Outreach monitor' };
  }
  if (pathname.startsWith('/admin/outreach')) {
    return { crumb: 'admin.drevvy.com', title: 'Outreach' };
  }
  if (pathname.startsWith('/admin/costs')) {
    return { crumb: 'admin.drevvy.com', title: 'Costs' };
  }
  if (pathname.startsWith('/admin/analytics')) {
    return { crumb: 'admin.drevvy.com', title: 'Shopper analytics' };
  }
  if (pathname.startsWith('/admin/shoppers')) {
    return { crumb: 'Shoppers + dealer staff', title: 'Shopper' };
  }
  if (pathname === '/admin') {
    return { crumb: 'Shoppers + dealer staff', title: 'Users' };
  }
  return { crumb: 'admin.drevvy.com', title: 'Ops Overview' };
}

export function AdminShell({
  email,
  missingEnv = [],
  children,
}: {
  email: string;
  missingEnv?: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const meta = pageMeta(pathname);
  const initials = email
    .split('@')[0]
    .split(/[.\s_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="app">
      <nav className="rail g" aria-label="Admin">
        <Link className="logo" href="/admin/ops" aria-label="Drevvy Admin">
          D
        </Link>
        {rail.map(item => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`ic${isActive(pathname, item.href) ? ' on' : ''}`}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          >
            {item.icon}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
      </nav>
      <div className="main">
        <header className="top g">
          <div className="wm">
            Drevvy <span>Admin</span>
          </div>
          <div className="pills">
            {pills.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`pill${isActive(pathname, item.href) ? ' on' : ''}`}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ThemeToggle />
            <div className="av">{initials || 'DW'}</div>
          </div>
        </header>
        <div className="hd">
          <div>
            <div className="crumb">{meta.crumb}</div>
            <div className="h1">{meta.title}</div>
          </div>
        </div>
        <MissingEnvBanner names={missingEnv} />
        {children}
      </div>
    </div>
  );
}

export function MissingEnvBanner({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <p className="note">Required environment variables are set.</p>
    );
  }
  return (
    <p className="note">
      Missing environment variables: {names.join(', ')}
    </p>
  );
}

const STAGE_TONE: Record<string, string> = {
  reaching_out: 'c-new',
  negotiating: 'c-chat',
  offer_received: 'c-wait',
  best_price_ready: 'c-sold',
  paused: 'c-no',
};

export function StageChip({ label, stage }: { label: string; stage?: string }) {
  return <span className={`chip ${STAGE_TONE[stage ?? ''] ?? 'c-chat'}`}>{label}</span>;
}
