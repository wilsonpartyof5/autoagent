"use client";

import React, { useState, useEffect, useTransition, cloneElement, isValidElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Grid3x3, Table, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { InventoryFiltersForm } from "./inventory-filters";
import { ActiveFilterChips } from "./active-filter-chips";
import { InventoryTableView } from "./inventory-table-view";
import { VehicleDetailModal } from "./vehicle-detail-modal";
import type { InventoryFilters } from "@/types/inventoryFilters";
import type { InventoryVehicle } from "@/app/app/inventory/page";
import {
  parseFiltersFromSearchParams,
  filtersToSearchParams,
  countActiveFilters,
} from "@/types/inventoryFilters";

type ViewMode = "grid" | "table";

type Props = {
  availableBodyTypes: string[];
  vehicles: InventoryVehicle[];
  total?: number;
  currentPage?: number;
  itemsPerPage?: number;
  children?: React.ReactNode; // Grid view (legacy support)
  onVehicleClick?: (vehicle: InventoryVehicle) => void; // Handler to pass to VehicleCard
};

export function InventoryPageClient({ 
  availableBodyTypes, 
  vehicles, 
  total = 0,
  currentPage = 1,
  itemsPerPage = 50,
  children, 
  onVehicleClick 
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<InventoryVehicle | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [vehiclesState, setVehiclesState] = useState<InventoryVehicle[]>(vehicles);
  const [filters, setFilters] = useState<InventoryFilters>(() =>
    parseFiltersFromSearchParams(searchParams)
  );

  // Update vehicles state when prop changes
  useEffect(() => {
    setVehiclesState(vehicles);
  }, [vehicles]);

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inventory-view-mode");
      return (saved === "grid" || saved === "table" ? saved : "grid") as ViewMode;
    }
    return "grid";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("inventory-view-mode", viewMode);
    }
  }, [viewMode]);

  // Sync filters with URL when searchParams change (e.g., browser back/forward)
  useEffect(() => {
    const urlFilters = parseFiltersFromSearchParams(searchParams);
    setFilters(urlFilters);
  }, [searchParams]);

  const handleFiltersChange = (newFilters: InventoryFilters) => {
    setFilters(newFilters);
    const params = filtersToSearchParams(newFilters);
    // Reset to page 1 when filters change
    params.set('page', '1');
    const newUrl = params.toString() ? `/app/inventory?${params.toString()}` : '/app/inventory';
    
    startTransition(() => {
      router.push(newUrl);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = filtersToSearchParams(filters);
    params.set('page', String(newPage));
    // Preserve current page size
    if (itemsPerPage !== 50) {
      params.set('pageSize', String(itemsPerPage));
    }
    const newUrl = `/app/inventory?${params.toString()}`;
    
    startTransition(() => {
      router.push(newUrl);
      // Scroll to top when page changes
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handlePageSizeChange = (newPageSize: string) => {
    const params = filtersToSearchParams(filters);
    params.set('pageSize', newPageSize);
    params.set('page', '1'); // Reset to page 1 when page size changes
    const newUrl = `/app/inventory?${params.toString()}`;
    
    startTransition(() => {
      router.push(newUrl);
      // Scroll to top when page size changes
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const totalPages = Math.ceil(total / itemsPerPage);
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  const handleRemoveFilter = (key: keyof InventoryFilters, value?: string) => {
    const newFilters: InventoryFilters = { ...filters };

    if (key === 'condition' && value) {
      newFilters.condition = newFilters.condition.filter((c) => c !== value);
    } else if (key === 'bodyType' && value) {
      newFilters.bodyType = newFilters.bodyType.filter((b) => b !== value);
    } else if (key === 'minPrice') {
      newFilters.minPrice = null;
    } else if (key === 'maxPrice') {
      newFilters.maxPrice = null;
    } else if (key === 'minMsrp') {
      newFilters.minMsrp = null;
    } else if (key === 'maxMsrp') {
      newFilters.maxMsrp = null;
    } else if (key === 'daysOnLot') {
      newFilters.daysOnLot = 'any';
    } else if (key === 'hasPhotos') {
      newFilters.hasPhotos = false;
    } else if (key === 'hasSellerComments') {
      newFilters.hasSellerComments = false;
    } else if (key === 'hasOptions') {
      newFilters.hasOptions = false;
    } else if (key === 'stockNumber') {
      newFilters.stockNumber = null;
    } else if (key === 'vin') {
      newFilters.vin = null;
    }

    handleFiltersChange(newFilters);
  };

  const activeFilterCount = countActiveFilters(filters);

  const handleVehicleClick = (vehicle: InventoryVehicle) => {
    setSelectedVehicle(vehicle);
    setIsDetailModalOpen(true);
  };

  const handleStatusUpdate = (vehicleId: string, isLive: boolean, publishedAt?: string | null) => {
    const updatePayload = {
      is_live: isLive,
      published_at: isLive 
        ? (publishedAt || new Date().toISOString())
        : selectedVehicle?.published_at ?? null, // Preserve published_at when turning off
    };

    // Update the selected vehicle in modal immediately
    if (selectedVehicle?.id === vehicleId) {
      setSelectedVehicle({
        ...selectedVehicle,
        ...updatePayload,
      } as InventoryVehicle);
    }

    // Update the vehicle in the list
    setVehiclesState((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              ...updatePayload,
            }
          : v
      )
    );
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(true)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-input bg-background p-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            aria-label="Grid view"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            aria-label="Table view"
          >
            <Table className="h-4 w-4" />
          </button>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="space-y-2">
          <ActiveFilterChips filters={filters} onRemoveFilter={handleRemoveFilter} />
        </div>
      )}

      {/* Render appropriate view based on viewMode */}
      {viewMode === "table" ? (
        <InventoryTableView vehicles={vehiclesState} onVehicleClick={handleVehicleClick} />
      ) : (
        <div
          onClick={(e) => {
            // Don't trigger if clicking on a button or interactive element
            if (
              (e.target as HTMLElement).closest("button") ||
              (e.target as HTMLElement).closest("a")
            ) {
              return;
            }
            const card = (e.target as HTMLElement).closest("[data-vehicle-id]");
            if (card) {
              const vehicleId = card.getAttribute("data-vehicle-id");
              const vehicle = vehiclesState.find((v) => v.id === vehicleId);
              if (vehicle) handleVehicleClick(vehicle);
            }
          }}
        >
          {React.Children.map(children, (child) => {
            if (isValidElement(child) && child.props?.children) {
              // If child is a container (like a div with VehicleCards inside), recursively clone
              return cloneElement(child as React.ReactElement<any>, {
                children: React.Children.map(child.props.children, (grandchild) => {
                  if (isValidElement(grandchild)) {
                    // Check if it's a VehicleCard by checking the component's displayName or props
                    const componentType = grandchild.type as any;
                    const grandchildProps = grandchild.props as any;
                    if (componentType?.displayName === 'VehicleCard' || grandchildProps?.vehicle) {
                      return cloneElement(grandchild as React.ReactElement<any>, { onClick: handleVehicleClick });
                    }
                  }
                  return grandchild;
                }),
              });
            }
            // Direct VehicleCard child
            if (isValidElement(child)) {
              const componentType = child.type as any;
              const childProps = child.props as any;
              if (componentType?.displayName === 'VehicleCard' || childProps?.vehicle) {
                return cloneElement(child as React.ReactElement<any>, { onClick: handleVehicleClick });
              }
            }
            return child;
          })}
        </div>
      )}

      <VehicleDetailModal
        vehicle={selectedVehicle}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        onStatusUpdate={handleStatusUpdate}
      />

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startItem} to {endItem} of {total} vehicles
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={handlePageSizeChange}
                disabled={isPending}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isPending}
                    className="min-w-[2.5rem]"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            </div>
          )}
        </div>
      )}

      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen} side="right">
        <SheetContent onClose={() => setIsFilterOpen(false)}>
          <InventoryFiltersForm
            filters={filters}
            availableBodyTypes={availableBodyTypes}
            onFiltersChange={handleFiltersChange}
            onClose={() => setIsFilterOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

