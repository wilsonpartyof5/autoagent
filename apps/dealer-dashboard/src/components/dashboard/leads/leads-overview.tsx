// This component is deprecated - use LeadsTable instead
// Keeping for backward compatibility
import { Filter, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  {
    label: "Total Leads",
    value: "127",
    helper: "+12 this week",
  },
  {
    label: "New",
    value: "8",
    helper: "Awaiting contact",
  },
  {
    label: "Close Rate",
    value: "23%",
    helper: "+5% vs last month",
  },
  {
    label: "Avg Response",
    value: "2.3h",
    helper: "Response time",
  },
];

const leads = [
  {
    id: "1",
    createdAt: "2025-10-19 14:23",
    vehicle: "2021 Honda Accord EX",
    vin: "1HG8H1JX0N0198196",
    buyer: "Sarah Johnson",
    contact: "sarah.j@email.com",
    status: "New",
  },
  {
    id: "2",
    createdAt: "2025-10-19 11:15",
    vehicle: "2017 Tesla Model S 75D",
    vin: "5YJSA1E26HF123456",
    buyer: "Michael Chen",
    contact: "m.chen@email.com",
    status: "Contacted",
  },
  {
    id: "3",
    createdAt: "2025-10-18 16:45",
    vehicle: "2015 Jeep Grand Cherokee",
    vin: "1C4RJFBG3FC123789",
    buyer: "Emily Rodriguez",
    contact: "emily.r@email.com",
    status: "Test Drive Booked",
  },
];

export function LeadsOverview() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Leads Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage incoming leads from ChatGPT users. Monitor performance and follow up faster.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{stat.value}</p>
            <p className="mt-2 text-xs font-medium text-primary/80">{stat.helper}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm lg:max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by VIN, name, or vehicle..."
            className="h-8 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button variant="ghost" className="text-sm text-muted-foreground">
            All Statuses
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Created</th>
              <th className="px-6 py-3 font-medium">Vehicle</th>
              <th className="px-6 py-3 font-medium">VIN</th>
              <th className="px-6 py-3 font-medium">Buyer</th>
              <th className="px-6 py-3 font-medium">Contact</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {leads.map((lead) => (
              <tr key={lead.id} className="text-foreground">
                <td className="px-6 py-4 text-sm text-muted-foreground">{lead.createdAt}</td>
                <td className="px-6 py-4">
                  <div className="font-medium">{lead.vehicle}</div>
                  <div className="text-xs text-muted-foreground">AI-qualified</div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{lead.vin}</td>
                <td className="px-6 py-4 text-sm">{lead.buyer}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{lead.contact}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; className: string }
  > = {
    New: {
      label: "New",
      className: "bg-primary/10 text-primary",
    },
    Contacted: {
      label: "Contacted",
      className: "bg-amber-100 text-amber-700",
    },
    "Test Drive Booked": {
      label: "Test Drive Booked",
      className: "bg-emerald-100 text-emerald-700",
    },
  };

  const badge = config[status] ?? config.New;

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
