"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createDealershipAction } from "@/app/app/actions/dealership";
import { useRouter } from "next/navigation";

type AddStoreFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function AddStoreForm({ onSuccess, onCancel }: AddStoreFormProps) {
  const [name, setName] = useState("");
  const [marketcheckDealerId, setMarketcheckDealerId] = useState("");
  const [marketcheckZip, setMarketcheckZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Dealership name is required");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createDealershipAction({
          name: name.trim(),
          marketcheckDealerId: marketcheckDealerId.trim() || null,
          marketcheckZip: marketcheckZip.trim() || null,
        });

        if (result.success) {
          onSuccess?.();
          // Redirect to setup page with the new dealership
          router.push(`/app/setup?dealership=${result.dealershipId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create store");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Store Name <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Main Street Auto"
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          The name of your dealership as it should appear in the dashboard
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="marketcheckDealerId" className="text-sm font-medium text-foreground">
          MarketCheck Dealer ID
        </label>
        <input
          id="marketcheckDealerId"
          type="text"
          value={marketcheckDealerId}
          onChange={(e) => setMarketcheckDealerId(e.target.value)}
          placeholder="e.g., 102345"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Optional: Add this when you&apos;re ready to sync inventory
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="marketcheckZip" className="text-sm font-medium text-foreground">
          ZIP Code
        </label>
        <input
          id="marketcheckZip"
          type="text"
          value={marketcheckZip}
          onChange={(e) => setMarketcheckZip(e.target.value)}
          placeholder="e.g., 29730"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Optional: Used to refine search results for multi-store groups
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? "Creating..." : "Create Store"}
        </Button>
      </div>
    </form>
  );
}

