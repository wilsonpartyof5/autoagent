"use client";

import { useState, useEffect } from "react";
import { Home, LineChart, Layers, DollarSign, Settings } from "lucide-react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { AppHeader } from "@/components/dashboard/app-header";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Dealership } from "@/lib/supabase/dealerships";

type IconKey = "leads" | "analytics" | "inventory" | "billing" | "settings";

type SerializedNavItem = {
  href: string;
  label: string;
  icon: IconKey;
};

type AppShellProps = {
  navItems: SerializedNavItem[];
  children: ReactNode;
  dealerships: Dealership[];
  activeDealership: Dealership | null;
};

const iconMap: Record<IconKey, LucideIcon> = {
  leads: Home,
  analytics: LineChart,
  inventory: Layers,
  billing: DollarSign,
  settings: Settings,
};

export function AppShell({ navItems, children, dealerships, activeDealership }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const resolvedNavItems = navItems.map(({ icon, ...rest }) => ({
    ...rest,
    icon: iconMap[icon],
  }));

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", isMobileNavOpen);
  }, [isMobileNavOpen]);

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <div className="flex min-h-screen">
        <AppSidebar items={resolvedNavItems} />

        <div className="flex flex-1 flex-col">
        <AppHeader
          dealerships={dealerships}
          activeDealership={activeDealership}
          onToggleMobileSidebar={() => setIsMobileNavOpen((prev) => !prev)}
          isMobileNavOpen={isMobileNavOpen}
        />

          <main className="flex-1 px-4 py-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileNavOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-full bg-background shadow-lg transition-transform duration-200 lg:hidden ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AppSidebar items={resolvedNavItems} isMobile onNavigate={() => setIsMobileNavOpen(false)} />
      </div>
    </div>
  );
}
