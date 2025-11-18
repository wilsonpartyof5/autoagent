"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  InventoryFilters,
  ConditionFilter,
  DaysOnLotFilter,
} from "@/types/inventoryFilters";

type Props = {
  filters: InventoryFilters;
  availableBodyTypes: string[];
  onFiltersChange: (filters: InventoryFilters) => void;
  onClose: () => void;
};

export function InventoryFiltersForm({
  filters,
  availableBodyTypes,
  onFiltersChange,
  onClose,
}: Props) {
  const [localFilters, setLocalFilters] = useState<InventoryFilters>(filters);

  const handleConditionToggle = (condition: ConditionFilter) => {
    setLocalFilters((prev) => ({
      ...prev,
      condition: prev.condition.includes(condition)
        ? prev.condition.filter((c) => c !== condition)
        : [...prev.condition, condition],
    }));
  };

  const handleBodyTypeToggle = (bodyType: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      bodyType: prev.bodyType.includes(bodyType)
        ? prev.bodyType.filter((b) => b !== bodyType)
        : [...prev.bodyType, bodyType],
    }));
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: InventoryFilters = {
      condition: [],
      bodyType: [],
      minPrice: null,
      maxPrice: null,
      minMsrp: null,
      maxMsrp: null,
      daysOnLot: 'any',
      hasPhotos: false,
      hasSellerComments: false,
      hasOptions: false,
      stockNumber: null,
      vin: null,
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  return (
    <div className="space-y-6">
      {/* Condition Filter */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Condition</label>
        <div className="flex flex-wrap gap-2">
          {(['new', 'used', 'certified'] as ConditionFilter[]).map((condition) => (
            <button
              key={condition}
              type="button"
              onClick={() => handleConditionToggle(condition)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                localFilters.condition.includes(condition)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-foreground hover:bg-muted"
              }`}
            >
              {condition.charAt(0).toUpperCase() + condition.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Body Type Filter */}
      {availableBodyTypes.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Body Type</label>
          <div className="flex flex-wrap gap-2">
            {availableBodyTypes.map((bodyType) => (
              <button
                key={bodyType}
                type="button"
                onClick={() => handleBodyTypeToggle(bodyType)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  localFilters.bodyType.includes(bodyType)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background text-foreground hover:bg-muted"
                }`}
              >
                {bodyType}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Price Range</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Min Price</label>
            <input
              type="number"
              value={localFilters.minPrice ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  minPrice: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                }))
              }
              placeholder="Min"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Max Price</label>
            <input
              type="number"
              value={localFilters.maxPrice ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  maxPrice: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                }))
              }
              placeholder="Max"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* MSRP Range */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">MSRP Range</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Min MSRP</label>
            <input
              type="number"
              value={localFilters.minMsrp ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  minMsrp: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                }))
              }
              placeholder="Min"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Max MSRP</label>
            <input
              type="number"
              value={localFilters.maxMsrp ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  maxMsrp: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                }))
              }
              placeholder="Max"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* Days on Lot */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Days on Lot</label>
        <div className="space-y-2">
          {(['any', '0-14', '15-30', '31+'] as DaysOnLotFilter[]).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background p-2 hover:bg-muted/50"
            >
              <input
                type="radio"
                name="daysOnLot"
                value={option}
                checked={localFilters.daysOnLot === option}
                onChange={() =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    daysOnLot: option,
                  }))
                }
                className="h-4 w-4 text-primary"
              />
              <span className="text-sm text-foreground">
                {option === 'any' ? 'Any' : option === '0-14' ? '0-14 days' : option === '15-30' ? '15-30 days' : '31+ days'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Stock Number and VIN */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Vehicle Identification</label>
        <div className="grid gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Stock Number</label>
            <input
              type="text"
              value={localFilters.stockNumber ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  stockNumber: e.target.value.trim() || null,
                }))
              }
              placeholder="Enter stock number"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">VIN Number</label>
            <input
              type="text"
              value={localFilters.vin ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  vin: e.target.value.trim().toUpperCase() || null,
                }))
              }
              placeholder="Enter VIN"
              maxLength={17}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 uppercase"
            />
          </div>
        </div>
      </div>

      {/* Boolean Toggles */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Additional Filters</label>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={localFilters.hasPhotos}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  hasPhotos: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-input text-primary"
            />
            <span className="text-sm text-foreground">Has photos</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={localFilters.hasSellerComments}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  hasSellerComments: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-input text-primary"
            />
            <span className="text-sm text-foreground">Has seller comments</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={localFilters.hasOptions}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  hasOptions: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-input text-primary"
            />
            <span className="text-sm text-foreground">Has options</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button onClick={handleApply} className="flex-1">
          Apply Filters
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

