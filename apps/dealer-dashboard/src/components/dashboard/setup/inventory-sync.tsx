"use client";

import { useState, useTransition, useEffect } from "react";
import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Database, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncMarketCheckInventory, fetchDealerRooftops, setInventoryProvider, type DealerRooftop } from "@/app/app/setup/actions";
import { type InventoryProvider } from "@/lib/supabase/profile";

type Props = {
  initialProvider?: InventoryProvider | null;
  initialDealerId?: string | null;
  initialZip?: string | null;
  initialDealershipName?: string | null;
};

export function InventorySyncForm({ initialProvider, initialDealerId, initialZip, initialDealershipName }: Props) {
  const [provider, setProvider] = useState<InventoryProvider>(initialProvider ?? "marketcheck");
  const [dealerId, setDealerId] = useState(initialDealerId ?? "");
  const [zip, setZip] = useState(initialZip ?? "");
  const [dealershipName, setDealershipName] = useState(initialDealershipName ?? "");
  
  // Update form when initial values change (e.g., when switching dealerships)
  useEffect(() => {
    if (initialDealerId) setDealerId(initialDealerId);
    if (initialZip) setZip(initialZip);
    if (initialDealershipName) setDealershipName(initialDealershipName);
  }, [initialDealerId, initialZip, initialDealershipName]);
  const [radius, setRadius] = useState(50);
  const [condition, setCondition] = useState<"all" | "new" | "used">("all");
  const [feedback, setFeedback] = useState<{ variant: "success" | "error"; message: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  
  // Rooftop selection state
  const [rooftops, setRooftops] = useState<DealerRooftop[]>([]);
  const [selectedRooftop, setSelectedRooftop] = useState<DealerRooftop | null>(null);
  const [isLoadingRooftops, setIsLoadingRooftops] = useState(false);
  const [showManualZip, setShowManualZip] = useState(false);
  const [rooftopError, setRooftopError] = useState<string | null>(null);

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

  // Fetch rooftops when dealer ID changes
  useEffect(() => {
    const trimmedId = dealerId.trim();
    if (!trimmedId || trimmedId === initialDealerId) {
      setRooftops([]);
      setSelectedRooftop(null);
      setShowManualZip(false);
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setIsLoadingRooftops(true);
      setRooftopError(null);
      try {
        const fetchedRooftops = await fetchDealerRooftops(trimmedId);
        setRooftops(fetchedRooftops);
        
        if (fetchedRooftops.length === 0) {
          // No rooftops found, show manual ZIP input
          setShowManualZip(true);
          setSelectedRooftop(null);
        } else if (fetchedRooftops.length === 1) {
          // Single rooftop, auto-select but allow override
          setSelectedRooftop(fetchedRooftops[0]);
          setZip(fetchedRooftops[0].zip);
          setShowManualZip(false);
        } else {
          // Multiple rooftops, require selection
          setShowManualZip(false);
          setSelectedRooftop(null);
        }
      } catch (error) {
        setRooftopError("Unable to fetch dealer locations. You can enter a ZIP manually.");
        setShowManualZip(true);
        setRooftops([]);
      } finally {
        setIsLoadingRooftops(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [dealerId, initialDealerId]);

  const handleRooftopSelect = (rooftop: DealerRooftop) => {
    setSelectedRooftop(rooftop);
    setZip(rooftop.zip);
    setShowManualZip(false);
  };

  const handleSync = () => {
    if (!dealerId.trim()) {
      setFeedback({
        variant: "error",
        message: "Enter your MarketCheck dealer ID before syncing.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await syncMarketCheckInventory({
          dealerId: dealerId.trim(),
          zip: zip.trim() || undefined,
          radiusMiles: radius,
          condition,
        });

        setFeedback({
          variant: "success",
          message: `Inventory synced from MarketCheck. Imported ${result.imported} vehicles.`,
        });
      } catch (error) {
        setFeedback({
          variant: "error",
          message:
            error instanceof Error ? error.message : "We couldn't sync inventory. Please try again.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Connect Your Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Choose your inventory provider to sync your active listings into AutoAgent.
        </p>
      </header>

      <section className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
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
            <MarketCheckForm
            dealerId={dealerId}
            setDealerId={setDealerId}
            zip={zip}
            setZip={setZip}
            radius={radius}
            setRadius={setRadius}
            condition={condition}
            setCondition={setCondition}
            feedback={feedback}
            setFeedback={setFeedback}
            isPending={isPending}
            startTransition={startTransition}
            rooftops={rooftops}
            setRooftops={setRooftops}
            selectedRooftop={selectedRooftop}
            setSelectedRooftop={setSelectedRooftop}
            isLoadingRooftops={isLoadingRooftops}
            setIsLoadingRooftops={setIsLoadingRooftops}
            showManualZip={showManualZip}
            setShowManualZip={setShowManualZip}
            rooftopError={rooftopError}
            setRooftopError={setRooftopError}
            initialDealerId={initialDealerId}
            dealershipName={dealershipName}
            setDealershipName={setDealershipName}
          />
        )}

        {provider === "cdk" && (
          <PlaceholderProvider
            providerName="CDK"
            description="CDK integration is in beta—contact support@autoagent.ai to join waitlist."
          />
        )}

        {provider === "vauto" && (
          <PlaceholderProvider
            providerName="vAuto"
            description="vAuto integration is in beta—contact support@autoagent.ai to join waitlist."
          />
        )}
      </section>
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

function MarketCheckForm({
  dealerId,
  setDealerId,
  zip,
  setZip,
  radius,
  setRadius,
  condition,
  setCondition,
  feedback,
  setFeedback,
  isPending,
  startTransition,
  rooftops,
  setRooftops,
  selectedRooftop,
  setSelectedRooftop,
  isLoadingRooftops,
  setIsLoadingRooftops,
  showManualZip,
  setShowManualZip,
  rooftopError,
  setRooftopError,
  initialDealerId,
  dealershipName,
  setDealershipName,
}: {
  dealerId: string;
  setDealerId: (value: string) => void;
  zip: string;
  setZip: (value: string) => void;
  radius: number;
  setRadius: (value: number) => void;
  condition: "all" | "new" | "used";
  setCondition: (value: "all" | "new" | "used") => void;
  feedback: { variant: "success" | "error"; message: string } | null;
  setFeedback: (value: { variant: "success" | "error"; message: string } | null) => void;
  isPending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  rooftops: DealerRooftop[];
  setRooftops: (value: DealerRooftop[]) => void;
  selectedRooftop: DealerRooftop | null;
  setSelectedRooftop: (value: DealerRooftop | null) => void;
  isLoadingRooftops: boolean;
  setIsLoadingRooftops: (value: boolean) => void;
  showManualZip: boolean;
  setShowManualZip: (value: boolean) => void;
  rooftopError: string | null;
  setRooftopError: (value: string | null) => void;
  initialDealerId?: string | null;
  dealershipName: string;
  setDealershipName: (value: string) => void;
}) {
  // Fetch rooftops when dealer ID changes
  useEffect(() => {
    const trimmedId = dealerId.trim();
    if (!trimmedId || trimmedId === initialDealerId) {
      setRooftops([]);
      setSelectedRooftop(null);
      setShowManualZip(false);
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setIsLoadingRooftops(true);
      setRooftopError(null);
      try {
        const fetchedRooftops = await fetchDealerRooftops(trimmedId);
        setRooftops(fetchedRooftops);
        
        if (fetchedRooftops.length === 0) {
          // No rooftops found, show manual ZIP input
          setShowManualZip(true);
          setSelectedRooftop(null);
        } else if (fetchedRooftops.length === 1) {
          // Single rooftop, auto-select but allow override
          setSelectedRooftop(fetchedRooftops[0]);
          setZip(fetchedRooftops[0].zip);
          setShowManualZip(false);
        } else {
          // Multiple rooftops, require selection
          setShowManualZip(false);
          setSelectedRooftop(null);
        }
      } catch (error) {
        setRooftopError("Unable to fetch dealer locations. You can enter a ZIP manually.");
        setShowManualZip(true);
        setRooftops([]);
      } finally {
        setIsLoadingRooftops(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [dealerId, initialDealerId, setRooftops, setSelectedRooftop, setZip, setShowManualZip, setIsLoadingRooftops, setRooftopError]);

  const handleRooftopSelect = (rooftop: DealerRooftop) => {
    setSelectedRooftop(rooftop);
    setZip(rooftop.zip);
    setShowManualZip(false);
  };

  const handleSync = () => {
    if (!dealerId.trim()) {
      setFeedback({
        variant: "error",
        message: "Enter your MarketCheck dealer ID before syncing.",
      });
      return;
    }

    if (!dealershipName.trim()) {
      setFeedback({
        variant: "error",
        message: "Enter your dealership name before syncing.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await syncMarketCheckInventory({
          dealerId: dealerId.trim(),
          zip: zip.trim() || undefined,
          radiusMiles: radius,
          condition,
          dealershipName: dealershipName.trim(),
        });

        setFeedback({
          variant: "success",
          message: `Inventory synced from MarketCheck. Imported ${result.imported} vehicles.`,
        });
      } catch (error) {
        setFeedback({
          variant: "error",
          message:
            error instanceof Error ? error.message : "We couldn't sync inventory. Please try again.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg bg-primary/5 px-4 py-3 text-sm text-foreground">
          <Database className="h-5 w-5 text-primary" />
          <p>
            Already connected to MarketCheck? You can adjust your dealer ID or sync parameters at any time
            from this page. We recommend syncing at least once per day.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Dealership name"
            required
            value={dealershipName}
            onChange={setDealershipName}
            placeholder="e.g., Main Street Auto"
            helper="The name of your dealership as it should appear in the dashboard."
          />

          <Field
            label="MarketCheck dealer ID"
            required
            value={dealerId}
            onChange={setDealerId}
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

          {/* Rooftop Selection UI */}
          {dealerId.trim() && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Dealer Location
              </label>
              
              {isLoadingRooftops ? (
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Finding your locations...</span>
                </div>
              ) : rooftops.length > 1 ? (
                // Multiple rooftops - show selection
                <div className="space-y-2">
                  <div className="rounded-md border border-input bg-background">
                    {rooftops.map((rooftop, index) => (
                      <label
                        key={index}
                        className={`flex cursor-pointer items-start gap-3 border-b border-input p-3 last:border-b-0 hover:bg-muted/50 ${
                          selectedRooftop === rooftop ? "bg-primary/5" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="rooftop"
                          checked={selectedRooftop === rooftop}
                          onChange={() => handleRooftopSelect(rooftop)}
                          className="mt-0.5 h-4 w-4 text-primary"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{rooftop.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {rooftop.address && `${rooftop.address}, `}
                            {rooftop.city && `${rooftop.city}, `}
                            {rooftop.state} {rooftop.zip}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualZip(true)}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Use a different location
                  </button>
                </div>
              ) : rooftops.length === 1 ? (
                // Single rooftop - show confirmation
                <div className="space-y-2">
                  <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {rooftops[0].name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rooftops[0].address && `${rooftops[0].address}, `}
                        {rooftops[0].city && `${rooftops[0].city}, `}
                        {rooftops[0].state} {rooftops[0].zip}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualZip(true)}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Use a different location
                  </button>
                </div>
              ) : null}

              {/* Manual ZIP input (fallback or override) */}
              {(showManualZip || (rooftops.length === 0 && !isLoadingRooftops)) && (
                <div className="space-y-2">
                  {rooftopError && (
                    <p className="text-xs text-muted-foreground">{rooftopError}</p>
                  )}
                  <Field
                    label="Zip code"
                    value={zip}
                    onChange={(value) => {
                      setZip(value);
                      setSelectedRooftop(null);
                    }}
                    placeholder="Dealer ZIP"
                    helper="Used to refine search results for multi-store groups."
                  />
                </div>
              )}
            </div>
          )}

          {/* Manual ZIP input when no dealer ID entered yet */}
          {!dealerId.trim() && (
            <Field
              label="Zip code (optional)"
              value={zip}
              onChange={setZip}
              placeholder="Dealer ZIP"
              helper="Used to refine search results for multi-store groups."
            />
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Radius</label>
            <select
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            >
              {[10, 25, 50, 100, 200].map((miles) => (
                <option key={miles} value={miles}>
                  {miles} miles
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Listings outside this radius will be ignored.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Vehicle condition</label>
            <select
              value={condition}
              onChange={(event) => setCondition(event.target.value as typeof condition)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All vehicles</option>
              <option value="new">New vehicles only</option>
              <option value="used">Used vehicles only</option>
            </select>
            <p className="text-xs text-muted-foreground">Filter the dataset before importing.</p>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-lg border px-4 py-2 text-sm ${
              feedback.variant === "success"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          Data Privacy: Vehicles are stored securely inside your AutoAgent account. We only import listing
          details (VIN, pricing, mileage, photos, vehicle metadata) and never customer information.
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Need help locating your dealer ID?{" "}
            <a
              href="mailto:support@autoagent.ai"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Contact our onboarding team
            </a>
            .
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="ghost" disabled={isPending}>
              Save Draft
            </Button>
            <Button onClick={handleSync} disabled={isPending || isLoadingRooftops}>
              {isPending ? "Syncing..." : "Sync MarketCheck Inventory"}
            </Button>
          </div>
        </div>
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
