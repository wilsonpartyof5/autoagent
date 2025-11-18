import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDealerProfile } from "@/lib/supabase/profile";
import { getActiveDealership, fetchUserDealerships } from "@/lib/supabase/dealerships";
import { InventorySyncForm } from "@/components/dashboard/setup/inventory-sync";
import { Button } from "@/components/ui/button";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SetupPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const resolvedSearchParams = await searchParams;
  const dealershipParam = resolvedSearchParams.dealership;
  
  const profile = await getDealerProfile();
  const dealerships = await fetchUserDealerships();
  
  // If dealership param is provided, use that dealership; otherwise use active
  let selectedDealership;
  if (dealershipParam && typeof dealershipParam === 'string') {
    selectedDealership = dealerships.find(d => d.id === dealershipParam);
  }
  
  if (!selectedDealership) {
    selectedDealership = await getActiveDealership();
  }

  return (
    <div className="space-y-10 pb-10">
      <Breadcrumbs />
      <InventorySyncForm
        initialProvider={profile?.dmsProvider ?? null}
        initialDealerId={selectedDealership?.marketcheckDealerId ?? profile?.marketcheckDealerId}
        initialZip={selectedDealership?.marketcheckZip ?? profile?.marketcheckZip}
        initialDealershipName={selectedDealership?.name ?? null}
      />

      <Callouts profile={profile} />
    </div>
  );
}

function Breadcrumbs() {
  return (
    <nav className="text-xs font-medium text-muted-foreground">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/app/leads" className="hover:text-foreground">
            Dashboard
          </Link>
        </li>
        <li aria-hidden className="text-muted-foreground">
          /
        </li>
        <li className="text-foreground">Sync Inventory</li>
      </ol>
    </nav>
  );
}

function Callouts({
  profile,
}: {
  profile: Awaited<ReturnType<typeof getDealerProfile>>;
}) {
  const billingActive = Boolean(profile?.billingActive);

  if (billingActive) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Go live once inventory is ready</h2>
          <p className="text-sm text-muted-foreground">
            After your vehicles appear in the inventory tab, add billing to start receiving AI-qualified
            leads instantly.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/billing">Set up billing</Link>
        </Button>
      </div>
    </div>
  );
}
