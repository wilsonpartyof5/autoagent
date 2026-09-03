import { createClient } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/dashboard/leads/leads-table";
import { getActiveDealership } from "@/lib/supabase/dealerships";
import { decryptToJson, isDecryptedLead, type DecryptedLead } from "@/lib/crypto";

// Import Lead type from leads-table to ensure type compatibility
type Lead = {
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  createdAt: number;
  repliedAt: number | null;
  status: string;
  source: string;
  vehicle?: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  decrypted: {
    name: string;
    email: string;
    phone?: string;
  } | null;
};

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

  // ChatGPT leads are dealership-scoped (user_id is often null).
  // Left-join UVS so MarketCheck-only leads still appear via vehicle_snapshot.
  let leadsQuery = supabase
    .from("leads")
    .select(`
      id,
      dealer_id,
      vehicle_id,
      vin,
      enc_payload,
      created_at,
      replied_at,
      closed_at,
      status,
      source,
      vehicle_snapshot,
      uvs_vehicles(
        id,
        vin,
        year,
        make,
        model,
        trim,
        uvs_data
      )
    `)
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

  // Transform Supabase leads to match expected format and decrypt payloads
  // Vehicle data is now included via UVS FK join
  const leads = await Promise.all(
    (leadsData || []).map(async (lead: any) => {
      // Get UVS vehicle data from the join
      const uvsVehicle = Array.isArray(lead.uvs_vehicles)
        ? lead.uvs_vehicles[0]
        : lead.uvs_vehicles;
      const snapshot = lead.vehicle_snapshot || {};
      const vehicleData = uvsVehicle?.uvs_data || snapshot || {};
      
      let decrypted: DecryptedLead | null = null;
      
      // Try to decrypt the payload (server-side only)
      try {
        const payload = await decryptToJson(lead.enc_payload);
        if (isDecryptedLead(payload)) {
          decrypted = payload;
        }
      } catch (error) {
        // Decryption failed - will show N/A in UI
        console.error(`Failed to decrypt lead ${lead.id}:`, error);
      }

      const leadObj: Lead = {
        id: lead.id,
        dealerId: lead.dealer_id || undefined,
        vehicleId: lead.vehicle_id,
        vin: uvsVehicle?.vin || lead.vin || snapshot?.vin || undefined,
        createdAt: new Date(lead.created_at).getTime(),
        repliedAt: lead.replied_at ? new Date(lead.replied_at).getTime() : null,
        status: lead.status || "new",
        source: lead.source || "chatgpt",
        vehicle: (uvsVehicle || snapshot?.year || snapshot?.make)
          ? {
              year: uvsVehicle?.year || snapshot?.year || vehicleData?.baseIdentity?.year || null,
              make: uvsVehicle?.make || snapshot?.make || vehicleData?.baseIdentity?.make || null,
              model: uvsVehicle?.model || snapshot?.model || vehicleData?.baseIdentity?.model || null,
              trim: uvsVehicle?.trim || snapshot?.trim || vehicleData?.baseIdentity?.trim || undefined,
            }
          : undefined,
        decrypted: decrypted
          ? {
              name: decrypted.user.name,
              email: decrypted.user.email,
              phone: decrypted.user.phone,
            }
          : null,
      };
      return leadObj;
    })
  );

  // Fetch delivery logs from Supabase for these leads
  const leadIds = leads.map((l) => l.id);
  const { data: deliveryLogs } = await supabase
    .from("lead_delivery_logs")
    .select("lead_id, status, delivery_method, attempted_at, error_message, http_status")
    .in("lead_id", leadIds.length > 0 ? leadIds : ["__none__"])
    .order("attempted_at", { ascending: false });

  // Create a map of lead_id -> latest delivery log
  const deliveryMap = new Map<string, NonNullable<typeof deliveryLogs>[0]>();
  deliveryLogs?.forEach((log) => {
    if (!deliveryMap.has(log.lead_id)) {
      deliveryMap.set(log.lead_id, log);
    }
  });

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const totalLeads = leads.length;
  const leadsThisWeek = leads.filter((lead) => lead.createdAt >= weekAgo).length;
  const newLeadCount = leads.filter(
    (lead) => lead.status?.toLowerCase() === "new"
  ).length;
  const closedLeadCount = leads.filter(
    (lead) => lead.status?.toLowerCase() === "closed"
  ).length;
  const closeRate =
    totalLeads > 0 ? Math.round((closedLeadCount / totalLeads) * 100) : 0;

  const responseTimes = leads
    .filter((lead) => lead.repliedAt)
    .map((lead) => {
      const repliedAt = lead.repliedAt as number;
      return (repliedAt - lead.createdAt) / (1000 * 60 * 60);
    });
  const avgResponseHours =
    responseTimes.length > 0
      ? Number((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1))
      : null;

  const summaryCards = [
    {
      label: "Total Leads",
      value: totalLeads,
      helper: `+${leadsThisWeek} this week`,
    },
    {
      label: "New",
      value: newLeadCount,
      helper: "Awaiting contact",
    },
    {
      label: "Close Rate",
      value: closeRate ? `${closeRate}%` : "—",
      helper: closeRate ? "+vs last month" : "No closed leads yet",
    },
    {
      label: "Avg Response",
      value: avgResponseHours !== null ? `${avgResponseHours}h` : "—",
      helper: "Response time",
    },
  ];

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
          </div>
        ))}
      </div>

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
