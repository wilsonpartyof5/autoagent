"use client";

import { useState, useTransition } from "react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { updateMarketCheckSettings } from "@/app/app/settings/actions";
import { setInventoryProvider } from "@/app/app/setup/actions";
import { type InventoryProvider } from "@/lib/supabase/profile";

type Props = {
  currentProvider?: InventoryProvider | null;
  dealerId?: string | null;
  zip?: string | null;
};

export function InventoryProviderForm({ currentProvider, dealerId, zip }: Props) {
  const [provider, setProvider] = useState<InventoryProvider>(currentProvider ?? "marketcheck");
  const [marketcheckDealerId, setMarketcheckDealerId] = useState(dealerId ?? "");
  const [marketcheckZip, setMarketcheckZip] = useState(zip ?? "");
  const [feedback, setFeedback] = useState<{ variant: "success" | "error"; message: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  // Handle provider change
  const handleProviderChange = (newProvider: InventoryProvider) => {
    setProvider(newProvider);
    startTransition(async () => {
      try {
        await setInventoryProvider(newProvider);
      } catch (error) {
        setFeedback({
          variant: "error",
          message: error instanceof Error ? error.message : "Failed to update provider selection.",
        });
      }
    });
  };

  const handleSave = () => {
    if (!marketcheckDealerId.trim()) {
      setFeedback({
        variant: "error",
        message: "Enter your MarketCheck dealer ID before saving.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await updateMarketCheckSettings({
          dealerId: marketcheckDealerId,
          zip: marketcheckZip,
        });

        setFeedback({
          variant: "success",
          message:
            "MarketCheck settings saved. Inventory sync was reset—run the sync again to import vehicles.",
        });
      } catch (error) {
        setFeedback({
          variant: "error",
          message:
            error instanceof Error ? error.message : "We couldn't save your changes. Try again.",
        });
      }
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Inventory provider</h2>
        <p className="text-sm text-muted-foreground">
          Choose your inventory provider to sync dealer inventory. Update your dealer ID or location
          to change which listings are imported.
        </p>
      </div>

      {/* Provider Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Inventory Provider</label>
        <div className="flex flex-wrap gap-2">
          <ProviderOption
            value="marketcheck"
            label="MarketCheck"
            recommended
            selected={provider === "marketcheck"}
            onSelect={() => handleProviderChange("marketcheck")}
          />
          <ProviderOption
            value="cdk"
            label="CDK"
            comingSoon
            selected={provider === "cdk"}
            onSelect={() => handleProviderChange("cdk")}
          />
          <ProviderOption
            value="vauto"
            label="vAuto"
            comingSoon
            selected={provider === "vauto"}
            onSelect={() => handleProviderChange("vauto")}
          />
        </div>
      </div>

      {/* Conditional Content Based on Provider */}
      {provider === "marketcheck" && (
        <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="MarketCheck dealer ID"
          required
          value={marketcheckDealerId}
          onChange={setMarketcheckDealerId}
          placeholder="e.g., 102345"
          helper={
            <>
              Find this in your MarketCheck dealer portal (account settings or dealer profile section).{" "}
              <a
                href="mailto:support@marketcheck.com"
                className="font-medium text-primary underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Need help? Contact MarketCheck support
              </a>
              .
            </>
          }
        />
        <Field
          label="Zip code (optional)"
          value={marketcheckZip}
          onChange={setMarketcheckZip}
          placeholder="Dealer ZIP"
          helper="Used to refine search results for multi-store groups."
        />
        </div>
      )}

      {provider !== "marketcheck" && (
        <PlaceholderProvider
          providerName={provider === "cdk" ? "CDK" : "vAuto"}
          description={
            provider === "cdk"
              ? "CDK integration is in beta—contact support@autoagent.ai to join waitlist."
              : "vAuto integration is in beta—contact support@autoagent.ai to join waitlist."
          }
        />
      )}

      {feedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.variant === "success"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {provider === "marketcheck" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            After saving, revisit the setup page to run a fresh MarketCheck sync.
          </p>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save MarketCheck settings"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ProviderOption({
  value,
  label,
  recommended,
  comingSoon,
  selected,
  onSelect,
}: {
  value: InventoryProvider;
  label: string;
  recommended?: boolean;
  comingSoon?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-input bg-background text-foreground hover:bg-muted"
      }`}
    >
      {label}
      {recommended && (
        <span className="ml-2 text-xs text-muted-foreground">(recommended)</span>
      )}
      {comingSoon && (
        <span className="ml-2 text-xs text-muted-foreground">(coming soon)</span>
      )}
    </button>
  );
}

function PlaceholderProvider({
  providerName,
  description,
}: {
  providerName: string;
  description: string;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border/40 bg-muted/10 p-6">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{providerName} Integration</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" disabled className="w-full sm:w-auto">
        Sync {providerName} Inventory
      </Button>
    </div>
  );
}

function Field({
  label,
  helper,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  helper?: string | ReactNode;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
      />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
