"use client";

import { useState, useTransition, useEffect } from "react";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resyncInventory } from "@/app/app/setup/actions";
import { useRouter } from "next/navigation";

const MARKETCHECK_NO_MATCH_MESSAGE =
  "We requested MarketCheck to map your website. Please try again in 24-48 hours.";

export function ResyncButton({ dealershipId }: { dealershipId?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
    result?: { fetched: number; imported: number };
  } | null>(null);

  useEffect(() => {
    // Clear feedback after 5 seconds
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleResync = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await resyncInventory(dealershipId);

        if (result?.status === "no_match") {
          setFeedback({
            type: "error",
            message: result.message ?? MARKETCHECK_NO_MATCH_MESSAGE,
          });
          return;
        }

        setFeedback({
          type: "success",
          message: `Successfully synced inventory. Fetched ${result.fetched ?? 0} vehicles, imported ${result.imported ?? 0}.`,
          result,
        });
        // Refresh the page to show updated inventory
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to re-sync inventory";
        setFeedback({
          type: "error",
          message: errorMessage,
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={handleResync}
        disabled={isPending}
        variant="outline"
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Syncing..." : "Re-sync Inventory"}
      </Button>
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}

