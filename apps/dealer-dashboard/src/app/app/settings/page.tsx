import { InventoryProviderForm } from "@/components/dashboard/settings/inventory-provider-form";
import { LeadDeliveryForm } from "@/components/dashboard/settings/lead-delivery-form";
import { YourStoresSection } from "@/components/dashboard/settings/your-stores-section";
import { getDealerProfile } from "@/lib/supabase/profile";
import { fetchUserDealerships, getActiveDealershipId } from "@/lib/supabase/dealerships";
import { getAllDealershipsStatus } from "@/lib/supabase/dealerships-status";

export default async function SettingsPage() {
  const profile = await getDealerProfile();
  const dealerships = await fetchUserDealerships();
  const activeDealershipId = await getActiveDealershipId();
  const activeDealership = dealerships.find(d => d.id === activeDealershipId);
  
  // Get status for all dealerships
  const dealershipIds = dealerships.map(d => d.id);
  const dealershipStatuses = await getAllDealershipsStatus(dealershipIds);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage account security, integrations, and team access. Start by reviewing your inventory
          provider configuration below.
        </p>
      </header>

      <div className="space-y-6">
        <YourStoresSection
          dealerships={dealerships}
          activeDealershipId={activeDealershipId}
          dealershipStatuses={dealershipStatuses}
        />

        <InventoryProviderForm
          currentProvider={profile?.dmsProvider}
          dealerId={activeDealership?.marketcheckDealerId ?? profile?.marketcheckDealerId}
          zip={activeDealership?.marketcheckZip ?? profile?.marketcheckZip}
        />

        <LeadDeliveryForm
          currentMethod={profile?.leadDeliveryMethod}
          currentEndpoint={profile?.leadDeliveryEndpoint}
          currentEmail={profile?.leadDeliveryEmail}
        />
      </div>
    </section>
  );
}
