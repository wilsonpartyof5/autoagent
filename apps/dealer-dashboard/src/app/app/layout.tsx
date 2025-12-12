import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { getDealerProfile } from "@/lib/supabase/profile";
import { fetchUserDealerships, getActiveDealership } from "@/lib/supabase/dealerships";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dealer Dashboard | AutoAgent",
};

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const navItems = [
  { href: "/app/leads", label: "Leads", icon: "leads" as const },
  { href: "/app/analytics", label: "Analytics", icon: "analytics" as const },
  { href: "/app/inventory", label: "Inventory", icon: "inventory" as const },
  { href: "/app/billing", label: "Billing", icon: "billing" as const },
  { href: "/app/settings", label: "Settings", icon: "settings" as const },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Load data with error handling to prevent hangs
  let profile = null;
  let dealerships: Awaited<ReturnType<typeof fetchUserDealerships>> = [];
  let activeDealership: Awaited<ReturnType<typeof getActiveDealership>> = null;
  let hasInventory = false;

  try {
    profile = await getDealerProfile();
  } catch (error) {
    console.error('[app/layout] Failed to load profile:', error);
  }

  try {
    dealerships = await fetchUserDealerships();
  } catch (error) {
    console.error('[app/layout] Failed to load dealerships:', error);
  }

  try {
    activeDealership = await getActiveDealership();
  } catch (error) {
    console.error('[app/layout] Failed to load active dealership:', error);
  }

  // Check if there's actual inventory in uvs_vehicles table
  // This is more reliable than the profile flag
  try {
    const supabase = await createClient();
    
    // If we have an active dealership with a dealer ID, check for vehicles with that dealer_id
    if (activeDealership?.marketcheckDealerId) {
      const { count } = await supabase
        .from('uvs_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('dealer_id', activeDealership.marketcheckDealerId)
        .eq('availability_status', 'available');
      
      hasInventory = (count ?? 0) > 0;
    } else {
      // If no dealer ID, check for any available vehicles (fallback)
      const { count } = await supabase
        .from('uvs_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('availability_status', 'available');
      
      hasInventory = (count ?? 0) > 0;
    }
  } catch (error) {
    console.error('[app/layout] Failed to check inventory:', error);
    // Fallback to profile flag if inventory check fails
    hasInventory = Boolean(profile?.inventoryConnected);
  }

  return (
    <AppShell navItems={navItems} dealerships={dealerships} activeDealership={activeDealership}>
      <SetupBanner profile={profile} hasInventory={hasInventory} />
      {children}
    </AppShell>
  );
}

function SetupBanner({
  profile,
  hasInventory,
}: {
  profile: Awaited<ReturnType<typeof getDealerProfile>>;
  hasInventory: boolean;
}) {
  // Use actual inventory check instead of profile flag
  // This ensures the onboarding flow updates correctly when inventory is synced
  const inventoryConnected = hasInventory;
  const billingActive = Boolean(profile?.billingActive);

  if (inventoryConnected && billingActive) {
    return null;
  }

  const primaryLabel = inventoryConnected ? "Add Billing" : "Sync Inventory";
  const primaryHref = inventoryConnected ? "/app/billing" : "/app/setup";
  const secondaryLabel = inventoryConnected ? "View Inventory" : "View Docs";
  const secondaryHref = inventoryConnected ? "/app/inventory" : "https://docs.autoagent.ai";

  const tasks = [
    {
      label: "Inventory sync",
      description: "Connect your DMS or upload a CSV file.",
      completed: inventoryConnected,
    },
    {
      label: "Billing setup",
      description: "Add a payment method to activate leads.",
      completed: billingActive,
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Complete your setup</h2>
          <p className="text-sm text-muted-foreground">
            {inventoryConnected
              ? "Inventory is synced. Add billing to go live with AI-qualified leads."
              : "Connect your inventory so vehicles can appear in ChatGPT search."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link href={primaryHref}>
              <Button>{primaryLabel}</Button>
            </Link>
            <Link href={secondaryHref}>
              <Button variant="ghost">{secondaryLabel}</Button>
            </Link>
          </div>
        </div>
        <ul className="flex flex-1 flex-col gap-3 lg:max-w-md">
          {tasks.map((task) => (
            <li
              key={task.label}
              className="flex items-start gap-3 rounded-lg border border-border/40 bg-background px-3 py-3 text-sm"
            >
              <span
                className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  task.completed
                    ? "bg-primary/10 text-primary"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {task.completed ? "✓" : "•"}
              </span>
              <div>
                <p className="font-medium text-foreground">{task.label}</p>
                <p className="text-xs text-muted-foreground">{task.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
