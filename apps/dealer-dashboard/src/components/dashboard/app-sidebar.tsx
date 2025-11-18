"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type AppSidebarProps = {
  items: NavItem[];
  isMobile?: boolean;
  onNavigate?: () => void;
};

export function AppSidebar({ items, isMobile = false, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-card/60 border-r border-border/60",
        isMobile ? "flex h-full w-full flex-col" : "hidden lg:flex lg:w-64 lg:flex-col"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="text-lg font-semibold">AA</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">AutoAgent</p>
          <p className="text-xs text-muted-foreground">Dealer Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href) && item.href !== "/app");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
              onClick={onNavigate}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
