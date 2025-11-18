"use client";

import { useState } from "react";
import { Building2, Plus, CheckCircle2, XCircle, ArrowRight, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AddStoreForm } from "./add-store-form";
import type { Dealership } from "@/lib/supabase/dealerships";
import type { DealershipStatus } from "@/lib/supabase/dealerships-status";
import { useRouter } from "next/navigation";
import Link from "next/link";

type YourStoresSectionProps = {
  dealerships: Dealership[];
  activeDealershipId: string | null;
  dealershipStatuses?: Map<string, DealershipStatus>;
  onStoreCreated?: () => void;
};

export function YourStoresSection({
  dealerships,
  activeDealershipId,
  dealershipStatuses,
  onStoreCreated,
}: YourStoresSectionProps) {
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const router = useRouter();

  const handleStoreCreated = () => {
    setIsAddStoreOpen(false);
    router.refresh();
    onStoreCreated?.();
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Your Stores</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multiple dealership locations and switch between them
          </p>
        </div>
        <Button onClick={() => setIsAddStoreOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Store
        </Button>
      </div>

      {dealerships.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-2">
            No stores yet
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first dealership to start syncing inventory
          </p>
          <Button onClick={() => setIsAddStoreOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Your First Store
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {dealerships.map((dealership) => {
            const isActive = dealership.id === activeDealershipId;
            const status = dealershipStatuses?.get(dealership.id);
            const hasInventory = status?.hasInventory ?? false;
            const hasLeadDelivery = status?.hasLeadDelivery ?? false;
            const inventoryCount = status?.inventoryCount ?? 0;

            return (
              <div
                key={dealership.id}
                className={`rounded-lg border p-4 transition-colors ${
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 bg-background"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {dealership.name}
                      </h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {dealership.marketcheckDealerId && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">MarketCheck ID:</span>
                          <span>{dealership.marketcheckDealerId}</span>
                        </div>
                      )}
                      {dealership.marketcheckZip && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">ZIP:</span>
                          <span>{dealership.marketcheckZip}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          {hasInventory ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-muted-foreground">
                                {inventoryCount} vehicle{inventoryCount !== 1 ? 's' : ''}
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-muted-foreground">No inventory</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {hasLeadDelivery ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-muted-foreground">Leads configured</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-muted-foreground">Leads pending</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-2"
                    >
                      <Link href={`/app/setup?dealership=${dealership.id}`}>
                        <ArrowRight className="h-3.5 w-3.5" />
                        Sync Inventory
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isAddStoreOpen} onOpenChange={setIsAddStoreOpen}>
        <DialogContent size="md" onClose={() => setIsAddStoreOpen(false)}>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Add New Store
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Add another dealership location to manage multiple stores from one account
            </p>
            <AddStoreForm
              onSuccess={handleStoreCreated}
              onCancel={() => setIsAddStoreOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

