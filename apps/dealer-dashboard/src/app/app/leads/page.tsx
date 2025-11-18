import { createClient } from "@/lib/supabase/server";
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

  // Fetch leads from Supabase
  let leadsQuery = supabase
    .from("leads")
    .select("id, dealer_id, vehicle_id, vin, enc_payload, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Filter by active dealership's MarketCheck dealer ID
  if (activeDealership?.marketcheckDealerId) {
    leadsQuery = leadsQuery.eq("dealer_id", activeDealership.marketcheckDealerId);
  } else if (activeDealership) {
    // If dealership exists but no MarketCheck ID, show empty state
    leadsQuery = leadsQuery.eq("dealer_id", "__none__");
  }

  const { data: leadsData, error: leadsError } = await leadsQuery;

  if (leadsError) {
    console.error("Error fetching leads:", leadsError);
  }

  // Transform Supabase leads to match expected format
  const leads = (leadsData || []).map((lead) => ({
    id: lead.id,
    dealerId: lead.dealer_id || undefined,
    vehicleId: lead.vehicle_id,
    vin: lead.vin || undefined,
    encPayload: lead.enc_payload,
    createdAt: new Date(lead.created_at).getTime(),
  }));

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
