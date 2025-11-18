import { createClient } from "@/lib/supabase/server";
import { getRecentLeads } from "@/lib/db";
import { LeadsTable } from "@/components/dashboard/leads/leads-table";
import { getActiveDealership } from "@/lib/supabase/dealerships";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please sign in to view leads.</div>;
  }

  // Get active dealership to scope leads
  const activeDealership = await getActiveDealership();

  // Fetch leads from SQLite
  let leads = getRecentLeads(100);

  // Filter leads by active dealership's MarketCheck dealer ID
  if (activeDealership?.marketcheckDealerId) {
    leads = leads.filter(
      (lead) => lead.dealerId === activeDealership.marketcheckDealerId
    );
  } else if (activeDealership) {
    // If dealership exists but no MarketCheck ID, show empty state
    leads = [];
  }

  // Fetch delivery logs from Supabase for these leads
  const leadIds = leads.map((l) => l.id);
  const { data: deliveryLogs } = await supabase
    .from("lead_delivery_logs")
    .select("lead_id, status, delivery_method, attempted_at, error_message, http_status")
    .in("lead_id", leadIds.length > 0 ? leadIds : ["__none__"])
    .eq("user_id", user.id)
    .order("attempted_at", { ascending: false });

  // Create a map of lead_id -> latest delivery log
  const deliveryMap = new Map<string, NonNullable<typeof deliveryLogs>[0]>();
  deliveryLogs?.forEach((log) => {
    if (!deliveryMap.has(log.lead_id)) {
      deliveryMap.set(log.lead_id, log);
    }
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Leads Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage incoming leads from ChatGPT users. Monitor CRM delivery status and resend if needed.
          {activeDealership && (
            <span className="block mt-1">
              Showing leads for <strong>{activeDealership.name}</strong>
            </span>
          )}
        </p>
      </header>

      {!activeDealership ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">No active dealership</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please set up a dealership first in Settings.
          </p>
        </div>
      ) : (
        <LeadsTable leads={leads} deliveryLogs={deliveryMap} />
      )}
    </section>
  );
}
