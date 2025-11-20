"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { resendLeadDelivery, updateLeadStatus } from "@/app/app/leads/actions";
import { RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Vehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
}

interface DecryptedUser {
  name: string;
  email: string;
  phone?: string;
}

type LeadStatus = "new" | "contacted" | "qualified" | "test_drive_booked" | "closed";

interface Lead {
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  createdAt: number;
  repliedAt: number | null;
  status: string;
  source: string;
  vehicle?: Vehicle;
  decrypted: DecryptedUser | null;
}

interface DeliveryLog {
  lead_id: string;
  status: "success" | "failed" | "pending";
  delivery_method: "http" | "email";
  attempted_at: string;
  error_message?: string;
  http_status?: number;
}

interface Props {
  leads: Lead[];
  deliveryLogs: Map<string, DeliveryLog>;
}

const leadStatusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "test_drive_booked", label: "Test Drive Booked" },
  { value: "closed", label: "Closed" },
];

const statusFilterOptions = [{ value: "all", label: "All Statuses" }, ...leadStatusOptions];

function formatVehicleName(vehicle?: Vehicle): string {
  if (!vehicle) return "Unknown Vehicle";
  const parts = [
    vehicle.year?.toString(),
    vehicle.make,
    vehicle.model,
    vehicle.trim,
  ].filter(Boolean);
  return parts.join(" ") || "Unknown Vehicle";
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    closed: "Closed",
    test_drive_booked: "Test Drive Booked",
  };
  return statusMap[status.toLowerCase()] || status;
}

function getStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower === "new") return "bg-blue-100 text-blue-700";
  if (statusLower === "contacted") return "bg-orange-100 text-orange-700";
  if (statusLower === "qualified") return "bg-purple-100 text-purple-700";
  if (statusLower === "closed") return "bg-gray-100 text-gray-700";
  if (statusLower === "test_drive_booked") return "bg-green-100 text-green-700";
  return "bg-gray-100 text-gray-700";
}

function getDeliveryStatus(log?: DeliveryLog) {
  if (!log || log.status === "pending") {
    return {
      label: "Pending",
      icon: Clock,
      className: "text-yellow-700",
      bgClass: "bg-yellow-100",
    };
  }

  if (log.status === "success") {
    return {
      label: "Delivered",
      icon: CheckCircle2,
      className: "text-green-700",
      bgClass: "bg-green-100",
    };
  }

  return {
    label: "Failed",
    icon: XCircle,
    className: "text-red-700",
    bgClass: "bg-red-100",
  };
}

function LeadRow({
  lead,
  deliveryLog,
}: {
  lead: Lead;
  deliveryLog?: DeliveryLog;
}) {
  const [isResending, setIsResending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<LeadStatus>(
    (lead.status as LeadStatus) || "new",
  );
  const [statusFeedback, setStatusFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const handleStatusChange = async (nextStatus: LeadStatus) => {
    if (nextStatus === currentStatus) return;
    setIsUpdatingStatus(true);
    setStatusFeedback(null);

    const result = await updateLeadStatus(lead.id, nextStatus);
    if (result.success) {
      setCurrentStatus(nextStatus);
      lead.status = nextStatus;
      setStatusFeedback({ type: "success", message: "Status updated" });
      setTimeout(() => setStatusFeedback(null), 2000);
    } else {
      setStatusFeedback({
        type: "error",
        message: result.error || "Unable to update status",
      });
    }

    setIsUpdatingStatus(false);
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const result = await resendLeadDelivery(lead.id);
      if (result.success) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to resend:", error);
    } finally {
      setIsResending(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <tr className="text-foreground hover:bg-muted/50">
      <td className="px-6 py-4 text-sm text-muted-foreground">
        {formatDate(lead.createdAt)}
      </td>
      <td className="px-6 py-4 text-sm">
        {formatVehicleName(lead.vehicle)}
      </td>
      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
        {lead.vin || "N/A"}
      </td>
      <td className="px-6 py-4 text-sm">
        {lead.decrypted ? (
          <span className="font-medium">{lead.decrypted.name}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-muted-foreground">
        {lead.decrypted ? (
          <div className="space-y-0.5">
            <p>{lead.decrypted.email}</p>
            {lead.decrypted.phone && (
              <p className="text-xs text-muted-foreground">
                {lead.decrypted.phone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="px-6 py-4">
        <Select
          value={currentStatus}
          onValueChange={(value) => handleStatusChange(value as LeadStatus)}
          disabled={isUpdatingStatus}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue>
              <span className={`text-sm font-medium ${getStatusColor(currentStatus)}`}>
                {formatStatus(currentStatus)}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {leadStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusFeedback && (
          <p
            className={`mt-1 text-xs ${
              statusFeedback.type === "success" ? "text-green-700" : "text-red-600"
            }`}
          >
            {statusFeedback.message}
          </p>
        )}
      </td>
      <td className="px-6 py-4">
        {(() => {
          const badge = getDeliveryStatus(deliveryLog);
          const Icon = badge.icon;
          return (
            <div className="flex items-center gap-2 text-sm">
              <Icon className={`h-4 w-4 ${badge.className}`} />
              <span className={`text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
              {deliveryLog?.delivery_method && (
                <span className="text-xs text-muted-foreground">
                  ({deliveryLog.delivery_method.toUpperCase()})
                </span>
              )}
            </div>
          );
        })()}
        {deliveryLog?.error_message && (
          <p className="mt-1 text-xs text-red-600">{deliveryLog.error_message}</p>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        {deliveryLog && deliveryLog.status === "failed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={isResending}
            className="gap-2"
          >
            {isResending ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Resending...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Resend
              </>
            )}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function LeadsTable({ leads, deliveryLogs }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "all" ||
        lead.status.toLowerCase() === statusFilter.toLowerCase();

      const vehicleText = formatVehicleName(lead.vehicle).toLowerCase();
      const vinText = (lead.vin || "").toLowerCase();
      const buyerName = lead.decrypted?.name?.toLowerCase() || "";
      const buyerEmail = lead.decrypted?.email?.toLowerCase() || "";
      const buyerPhone = lead.decrypted?.phone?.toLowerCase() || "";

      const matchesSearch =
        term.length === 0 ||
        vehicleText.includes(term) ||
        vinText.includes(term) ||
        buyerName.includes(term) ||
        buyerEmail.includes(term) ||
        buyerPhone.includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [leads, searchTerm, statusFilter]);

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-10 text-center text-muted-foreground">
        <p>No leads found. Leads will appear here once submitted through ChatGPT.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex flex-col gap-3 rounded-t-xl border border-border/60 border-b-0 bg-card px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <input
            type="search"
            placeholder="Search by VIN, name, or vehicle..."
            value={searchTerm}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(event.target.value)
            }
            className="h-10 w-full rounded-full border border-border/60 bg-background px-4 pl-10 text-sm text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          >
            <path
              fill="currentColor"
              d="m21 20.3l-5.4-5.4a7 7 0 1 0-.7.7L20.3 21l.7-.7ZM11 17a6 6 0 1 1 0-12a6 6 0 0 1 0 12Z"
            />
          </svg>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <table className="min-w-full divide-y divide-border/60 text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-6 py-3 font-medium">Created</th>
            <th className="px-6 py-3 font-medium">Vehicle</th>
            <th className="px-6 py-3 font-medium">VIN</th>
            <th className="px-6 py-3 font-medium">Buyer</th>
            <th className="px-6 py-3 font-medium">Contact</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Delivery Status</th>
            <th className="px-6 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-white">
          {filteredLeads.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-6 py-10 text-center text-sm text-muted-foreground"
              >
                No leads match your filters. Try adjusting the search or status.
              </td>
            </tr>
          ) : (
            filteredLeads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                deliveryLog={deliveryLogs.get(lead.id)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
