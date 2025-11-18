"use client";

import { X } from "lucide-react";
import type { InventoryFilters } from "@/types/inventoryFilters";

type Props = {
  filters: InventoryFilters;
  onRemoveFilter: (key: keyof InventoryFilters, value?: string) => void;
};

export function ActiveFilterChips({ filters, onRemoveFilter }: Props) {
  const chips: Array<{ key: keyof InventoryFilters; label: string; value?: string }> = [];

  // Condition chips
  filters.condition.forEach((condition) => {
    chips.push({
      key: 'condition',
      label: `Condition: ${condition.charAt(0).toUpperCase() + condition.slice(1)}`,
      value: condition,
    });
  });

  // Body type chips
  filters.bodyType.forEach((bodyType) => {
    chips.push({
      key: 'bodyType',
      label: `Body: ${bodyType}`,
      value: bodyType,
    });
  });

  // Price range
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const range = [
      filters.minPrice !== null ? `$${filters.minPrice.toLocaleString()}` : '',
      filters.maxPrice !== null ? `$${filters.maxPrice.toLocaleString()}` : '',
    ]
      .filter(Boolean)
      .join(' - ');
    chips.push({
      key: 'minPrice' as keyof InventoryFilters,
      label: `Price: ${range}`,
    });
  }

  // MSRP range
  if (filters.minMsrp !== null || filters.maxMsrp !== null) {
    const range = [
      filters.minMsrp !== null ? `$${filters.minMsrp.toLocaleString()}` : '',
      filters.maxMsrp !== null ? `$${filters.maxMsrp.toLocaleString()}` : '',
    ]
      .filter(Boolean)
      .join(' - ');
    chips.push({
      key: 'minMsrp' as keyof InventoryFilters,
      label: `MSRP: ${range}`,
    });
  }

  // Days on lot
  if (filters.daysOnLot !== 'any') {
    const label =
      filters.daysOnLot === '0-14'
        ? 'Days: 0-14'
        : filters.daysOnLot === '15-30'
          ? 'Days: 15-30'
          : 'Days: 31+';
    chips.push({
      key: 'daysOnLot',
      label,
    });
  }

  // Boolean toggles
  if (filters.hasPhotos) {
    chips.push({
      key: 'hasPhotos',
      label: 'Has photos',
    });
  }

  if (filters.hasSellerComments) {
    chips.push({
      key: 'hasSellerComments',
      label: 'Has seller comments',
    });
  }

  if (filters.hasOptions) {
    chips.push({
      key: 'hasOptions',
      label: 'Has options',
    });
  }

  // Stock Number
  if (filters.stockNumber) {
    chips.push({
      key: 'stockNumber',
      label: `Stock: ${filters.stockNumber}`,
    });
  }

  // VIN
  if (filters.vin) {
    chips.push({
      key: 'vin',
      label: `VIN: ${filters.vin}`,
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip, index) => (
        <button
          key={`${chip.key}-${chip.value ?? index}`}
          type="button"
          onClick={() => {
            if (chip.key === 'minPrice') {
              onRemoveFilter('minPrice');
              onRemoveFilter('maxPrice');
            } else if (chip.key === 'minMsrp') {
              onRemoveFilter('minMsrp');
              onRemoveFilter('maxMsrp');
            } else {
              onRemoveFilter(chip.key, chip.value);
            }
          }}
          className="flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          <span>{chip.label}</span>
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

