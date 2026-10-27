'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const links = [
  {
    href: '/dealer/inbox',
    label: 'Inbox',
    match: (path: string) =>
      path.startsWith('/dealer/inbox') || path.startsWith('/dealer/leads'),
  },
  {
    href: '/dealer/analytics',
    label: 'Analytics',
    match: (path: string) => path.startsWith('/dealer/analytics'),
  },
  {
    href: '/dealer/settings',
    label: 'Settings',
    match: (path: string) => path.startsWith('/dealer/settings'),
  },
];

export function DealerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onLead = pathname.startsWith('/dealer/leads');

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col bg-[#171A2C] text-white md:flex">
        <div className="px-4 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A6ACC2]">
            Drevvy
          </p>
          <p className="text-lg font-extrabold">Desk</p>
          <p className="mt-2 text-xs leading-5 text-[#A6ACC2]">
            Chat only. Buyer via Drevvy plus a short reference. Demo data.
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map(link => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-[#A6ACC2] hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <p className="px-4 py-4 text-xs leading-5 text-[#A6ACC2]">
          Demo Rooftop · no account yet
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <nav
          className={`${onLead ? 'hidden' : 'flex'} gap-2 border-b border-border bg-card px-3 py-2 md:hidden`}
        >
          {links.map(link => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  active ? 'bg-[#171A2C] text-white' : 'text-foreground'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
