'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { RooftopSwitcher } from '@/components/dealer/rooftop-switcher';
import { ThemeToggle, useGlassTheme } from '@/components/glass/glass-theme';

const rail = [
  { href: '/dealer/inbox', label: 'Inbox', icon: '✉' },
  { href: '/dealer/analytics', label: 'Analytics', icon: '◔' },
  { href: '/dealer/team', label: 'Team', icon: '👥' },
  { href: '/dealer/rooftops', label: 'Rooftops', icon: '⌂' },
  { href: '/dealer/roles', label: 'Roles', icon: '⚿' },
  { href: '/dealer/billing', label: 'Billing', icon: '$' },
  { href: '/dealer/settings', label: 'Settings', icon: '⚙' },
];

const pills = [
  { href: '/dealer/inbox', label: 'Inbox' },
  { href: '/dealer/analytics', label: 'Analytics' },
  { href: '/dealer/team', label: 'Management' },
  { href: '/dealer/settings', label: 'Settings' },
];

function activeHref(pathname: string, href: string): boolean {
  if (href === '/dealer/inbox') {
    return pathname.startsWith('/dealer/inbox') || pathname.startsWith('/dealer/leads');
  }
  if (href === '/dealer/team') {
    return (
      pathname.startsWith('/dealer/team') ||
      pathname.startsWith('/dealer/rooftops') ||
      pathname.startsWith('/dealer/roles') ||
      pathname.startsWith('/dealer/billing')
    );
  }
  return pathname.startsWith(href);
}

function pageMeta(pathname: string, rooftopLabel: string): { crumb: string; title: string } {
  if (pathname.startsWith('/dealer/leads')) {
    return { crumb: `Dealer · ${rooftopLabel}`, title: 'Conversation' };
  }
  if (pathname.startsWith('/dealer/analytics')) {
    return { crumb: `Dealer · ${rooftopLabel}`, title: 'Analytics' };
  }
  if (pathname.startsWith('/dealer/team')) {
    return { crumb: 'Management › Team', title: 'Team' };
  }
  if (pathname.startsWith('/dealer/rooftops')) {
    return { crumb: 'Management › Rooftops', title: 'Rooftops' };
  }
  if (pathname.startsWith('/dealer/roles')) {
    return { crumb: 'Management › Roles', title: 'Roles' };
  }
  if (pathname.startsWith('/dealer/billing')) {
    return { crumb: 'Owner/GM · Billing', title: 'Billing' };
  }
  if (pathname.startsWith('/dealer/settings')) {
    return { crumb: `Dealer · ${rooftopLabel}`, title: 'Settings' };
  }
  return { crumb: `Dealer · ${rooftopLabel}`, title: 'Inbox' };
}

export function DealerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { rooftopLabel } = useGlassTheme();
  const meta = pageMeta(pathname, rooftopLabel);
  const onLead = pathname.startsWith('/dealer/leads');

  return (
    <div className="app">
      <nav className="rail g" aria-label="Dealer">
        <Link className="logo" href="/dealer/inbox" aria-label="Drevvy Desk">
          D
        </Link>
        {rail.map(item => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`ic${activeHref(pathname, item.href) ? ' on' : ''}`}
            aria-current={activeHref(pathname, item.href) ? 'page' : undefined}
          >
            {item.icon}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <Link className="ic" href="/dealer/login" title="Sign out">
          ⎋
        </Link>
      </nav>
      <div className="main">
        <header className="top g">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div className="wm">
              Drevvy <span>Dealer</span>
            </div>
            <RooftopSwitcher />
          </div>
          <div className={`pills${onLead ? ' max-md:hidden' : ''}`}>
            {pills.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`pill${activeHref(pathname, item.href) ? ' on' : ''}`}
                aria-current={activeHref(pathname, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ThemeToggle />
            <div className="av">MR</div>
          </div>
        </header>
        <div className="hd">
          <div>
            <div className="crumb">{meta.crumb}</div>
            <div className="h1">{meta.title}</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
