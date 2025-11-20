"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { resendLeadDelivery } from "@/app/app/leads/actions";
import { RefreshCw } from "lucide-react";

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

interface Lead {
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  encPayload: string;
  createdAt: number;
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

function LeadRow({ lead, deliveryLog }: { lead: Lead; deliveryLog?: DeliveryLog }) {
  const [isResending, setIsResending] = useState(false);

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
          lead.decrypted.email
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
            lead.status
          )}`}
        >
          {formatStatus(lead.status)}
        </span>
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
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-10 text-center text-muted-foreground">
        <p>No leads found. Leads will appear here once submitted through ChatGPT.</p>
      </div>
    );
  }

  return (
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
        <tbody className="divide-y divide-border/60 bg-white">
          {leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              deliveryLog={deliveryLogs.get(lead.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
