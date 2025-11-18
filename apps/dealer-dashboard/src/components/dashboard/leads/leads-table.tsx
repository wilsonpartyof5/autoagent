"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendLeadDelivery } from "@/app/app/leads/actions";
import { RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Lead {
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  encPayload: string;
  createdAt: number;
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

export function LeadsTable({ leads, deliveryLogs }: Props) {
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Map<string, { variant: "success" | "error"; message: string }>>(new Map());

  const handleResend = async (leadId: string) => {
    setResendingIds((prev) => new Set(prev).add(leadId));
    setFeedback((prev) => {
      const next = new Map(prev);
      next.delete(leadId);
      return next;
    });

    try {
      const result = await resendLeadDelivery(leadId);
      if (result.success) {
        setFeedback((prev) => {
          const next = new Map(prev);
          next.set(leadId, { variant: "success", message: "Lead resent successfully" });
          return next;
        });
        // Refresh page after a short delay to show updated status
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setFeedback((prev) => {
          const next = new Map(prev);
          next.set(leadId, { variant: "error", message: result.error || "Failed to resend" });
          return next;
        });
      }
    } catch (error) {
      setFeedback((prev) => {
        const next = new Map(prev);
        next.set(leadId, {
          variant: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return next;
      });
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDeliveryStatus = (leadId: string) => {
    const log = deliveryLogs.get(leadId);
    if (!log) {
      return { status: "pending" as const, label: "Pending", icon: Clock };
    }

    if (log.status === "success") {
      return { status: "success" as const, label: "Delivered", icon: CheckCircle2 };
    } else if (log.status === "failed") {
      return { status: "failed" as const, label: "Failed", icon: XCircle };
    } else {
      return { status: "pending" as const, label: "Pending", icon: Clock };
    }
  };

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
            <th className="px-6 py-3 font-medium">VIN</th>
            <th className="px-6 py-3 font-medium">Vehicle ID</th>
            <th className="px-6 py-3 font-medium">Delivery Status</th>
            <th className="px-6 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {leads.map((lead) => {
            const deliveryStatus = getDeliveryStatus(lead.id);
            const log = deliveryLogs.get(lead.id);
            const isResending = resendingIds.has(lead.id);
            const leadFeedback = feedback.get(lead.id);
            const StatusIcon = deliveryStatus.icon;

            return (
              <tr key={lead.id} className="text-foreground">
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {formatDate(lead.createdAt)}
                </td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                  {lead.vin || "N/A"}
                </td>
                <td className="px-6 py-4 text-sm">{lead.vehicleId}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <StatusIcon
                      className={`h-4 w-4 ${
                        deliveryStatus.status === "success"
                          ? "text-green-600"
                          : deliveryStatus.status === "failed"
                            ? "text-red-600"
                            : "text-yellow-600"
                      }`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        deliveryStatus.status === "success"
                          ? "text-green-700"
                          : deliveryStatus.status === "failed"
                            ? "text-red-700"
                            : "text-yellow-700"
                      }`}
                    >
                      {deliveryStatus.label}
                    </span>
                    {log && log.delivery_method && (
                      <span className="text-xs text-muted-foreground">
                        ({log.delivery_method.toUpperCase()})
                      </span>
                    )}
                  </div>
                  {log?.error_message && (
                    <p className="mt-1 text-xs text-red-600">{log.error_message}</p>
                  )}
                  {leadFeedback && (
                    <div
                      className={`mt-2 rounded px-2 py-1 text-xs ${
                        leadFeedback.variant === "success"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {leadFeedback.message}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {log && log.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResend(lead.id)}
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
          })}
        </tbody>
      </table>
    </div>
  );
}

