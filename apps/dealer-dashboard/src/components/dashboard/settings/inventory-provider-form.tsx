"use client";

import { useState, useTransition, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { updateMarketCheckSettings } from "@/app/app/settings/actions";
import { setInventoryProvider } from "@/app/app/setup/actions";
import { type InventoryProvider } from "@/lib/supabase/profile";

type Props = {
  currentProvider?: InventoryProvider | null;
  websiteUrl?: string | null;
};

export function InventoryProviderForm({ currentProvider, websiteUrl }: Props) {
  const [provider, setProvider] = useState<InventoryProvider>(currentProvider ?? "marketcheck");
  const [marketcheckWebsiteUrl, setMarketcheckWebsiteUrl] = useState(websiteUrl ?? "");
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
    const normalizedWebsite = normalizeWebsite(marketcheckWebsiteUrl);
    if (!normalizedWebsite) {
      setFeedback({
        variant: "error",
        message: "Enter a valid dealership website URL (e.g., https://exampledealer.com).",
      });
      return;
    }

    startTransition(async () => {
      try {
        await updateMarketCheckSettings({
          websiteUrl: normalizedWebsite,
        });

        setFeedback({
          variant: "success",
          message:
            "MarketCheck settings saved. We'll auto-detect your dealer ID and reset inventory sync.",
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
          Choose your inventory provider to sync dealer inventory. Enter your dealership website and
          we'll auto-detect your MarketCheck dealer ID.
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
        <div className="space-y-4">
          <Field
            label="Dealership website URL"
            required
            value={marketcheckWebsiteUrl}
            onChange={setMarketcheckWebsiteUrl}
            placeholder="https://exampledealer.com or mydealer.com"
            helper="We'll auto-detect your MarketCheck dealer ID; no manual ID needed."
            inputMode="url"
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

function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return null;
    }

    const hostname = parsed.hostname.startsWith("www.") ? parsed.hostname.slice(4) : parsed.hostname;
    return hostname.toLowerCase();
  } catch {
    return null;
  }
}

function Field({
  label,
  helper,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  helper?: string | ReactNode;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={inputMode === "url" || type === "url" ? "url" : "off"}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
      />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
