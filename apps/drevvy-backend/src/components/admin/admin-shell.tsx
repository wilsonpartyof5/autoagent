import Link from 'next/link';
import type { ReactNode } from 'react';

const links = [
  { href: '/admin', label: 'Shoppers' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/outreach', label: 'Outreach' },
  { href: '/admin/outreach/monitor', label: 'Monitor' },
  { href: '/admin/deals', label: 'Deals' },
  { href: '/admin/costs', label: 'Costs' },
];

export function AdminShell({
  email,
  missingEnv = [],
  children,
}: {
  email: string;
  missingEnv?: string[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-900 px-5 py-6 md:border-b-0 md:border-r">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Drevvy</p>
          <h1 className="mt-1 text-lg font-semibold">Shopper admin</h1>
          <p className="mt-2 text-xs leading-5 text-slate-400">Separate from the dealer dashboard. Dealer names stay on this side of the glass.</p>
          <nav className="mt-6 flex gap-2 md:flex-col">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="mt-8 text-xs text-slate-500">Signed in as {email}</p>
          <p className="mt-2 text-xs text-slate-500">Shopper lists use the mock book. Platform bills save to Supabase.</p>
        </aside>
        <main className="px-5 py-6 md:px-8">
          <MissingEnvBanner names={missingEnv} />
          {children}
        </main>
      </div>
    </div>
  );
}

export function MissingEnvBanner({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <p className="mb-6 rounded-md border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm text-emerald-200">
        Required environment variables are set.
      </p>
    );
  }
  return (
    <p className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-100">
      Missing environment variables: {names.join(', ')}
    </p>
  );
}

export function StageChip({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-200">
      {label}
    </span>
  );
}
