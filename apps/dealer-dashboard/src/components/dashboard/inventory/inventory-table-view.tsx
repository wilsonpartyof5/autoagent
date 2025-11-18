"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InventoryVehicle } from "@/app/app/inventory/page";

type SortField = 
  | "year"
  | "make"
  | "model"
  | "stock_number"
  | "vin"
  | "condition"
  | "price"
  | "msrp"
  | "miles"
  | "days_on_market";

type SortDirection = "asc" | "desc";

type Props = {
  vehicles: InventoryVehicle[];
  onVehicleClick?: (vehicle: InventoryVehicle) => void;
};

export function InventoryTableView({ vehicles, onVehicleClick }: Props) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: string | number | null = null;
    let bValue: string | number | null = null;

    switch (sortField) {
      case "year":
        aValue = a.year ?? 0;
        bValue = b.year ?? 0;
        break;
      case "make":
        aValue = a.make ?? "";
        bValue = b.make ?? "";
        break;
      case "model":
        aValue = a.model ?? "";
        bValue = b.model ?? "";
        break;
      case "stock_number":
        aValue = a.stock_number ?? "";
        bValue = b.stock_number ?? "";
        break;
      case "vin":
        aValue = a.vin ?? "";
        bValue = b.vin ?? "";
        break;
      case "condition":
        aValue = a.condition ?? "";
        bValue = b.condition ?? "";
        break;
      case "price":
        aValue = a.price ?? 0;
        bValue = b.price ?? 0;
        break;
      case "msrp":
        aValue = a.msrp ?? 0;
        bValue = b.msrp ?? 0;
        break;
      case "miles":
        aValue = a.miles ?? 0;
        bValue = b.miles ?? 0;
        break;
      case "days_on_market":
        aValue = a.days_on_market ?? 0;
        bValue = b.days_on_market ?? 0;
        break;
    }

    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;

    const comparison =
      typeof aValue === "string" && typeof bValue === "string"
        ? aValue.localeCompare(bValue)
        : (aValue as number) - (bValue as number);

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 font-medium text-foreground hover:text-primary"
      >
        {children}
        {isActive ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    );
  };

  const getVehicleImage = (vehicle: InventoryVehicle) => {
    const rawData = vehicle.raw as {
      original?: unknown;
      enriched?: {
        media?: {
          photo_links?: string[];
          primary_photo_url?: string;
        };
      };
    } | null;

    const enrichedListing =
      rawData && typeof rawData === "object" && "enriched" in rawData
        ? (rawData.enriched as { media?: { photo_links?: string[]; primary_photo_url?: string } })
        : null;

    const enrichedPhotos = enrichedListing?.media?.photo_links;
    const enrichedPrimaryPhoto = enrichedListing?.media?.primary_photo_url;

    return (
      enrichedPrimaryPhoto ??
      vehicle.primary_photo_url ??
      vehicle.thumbnail_url ??
      enrichedPhotos?.[0] ??
      vehicle.photo_urls?.[0] ??
      null
    );
  };

  if (vehicles.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground md:px-4">
              Image
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground md:px-4">
              <SortButton field="year">Year</SortButton>
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground md:table-cell">
              <SortButton field="make">Make</SortButton>
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground md:px-4">
              <SortButton field="model">Model</SortButton>
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground lg:table-cell">
              <SortButton field="stock_number">Stock #</SortButton>
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground xl:table-cell">
              <SortButton field="vin">VIN</SortButton>
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground md:px-4">
              <SortButton field="condition">Condition</SortButton>
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground lg:table-cell">
              Body Type
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground md:px-4">
              <SortButton field="price">Price</SortButton>
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground xl:table-cell">
              <SortButton field="msrp">MSRP</SortButton>
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground lg:table-cell">
              <SortButton field="miles">Miles</SortButton>
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground xl:table-cell">
              <SortButton field="days_on_market">Days</SortButton>
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground md:px-4">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedVehicles.map((vehicle) => {
            const imageUrl = getVehicleImage(vehicle);
            return (
              <tr
                key={vehicle.id}
                className="border-b border-border/40 bg-card hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => onVehicleClick?.(vehicle)}
              >
                <td className="px-2 py-3 md:px-4">
                  {imageUrl ? (
                    <div className="relative h-10 w-14 overflow-hidden rounded border border-border/40 md:h-12 md:w-16">
                      <Image
                        src={imageUrl}
                        alt={`${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-14 items-center justify-center rounded border border-border/40 bg-muted text-[10px] text-muted-foreground md:h-12 md:w-16 md:text-xs">
                      No photo
                    </div>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-foreground md:px-4">
                  <div className="flex items-center gap-2">
                    {vehicle.year ?? "—"}
                    {vehicle.is_live && (
                      <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                        LIVE
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-sm text-foreground md:table-cell">
                  {vehicle.make ?? "—"}
                </td>
                <td className="px-2 py-3 text-sm text-foreground md:px-4">{vehicle.model ?? "—"}</td>
                <td className="hidden px-4 py-3 text-sm font-mono text-foreground lg:table-cell">
                  {vehicle.stock_number ?? "—"}
                </td>
                <td className="hidden px-4 py-3 text-sm font-mono text-foreground xl:table-cell">
                  {vehicle.vin ? (
                    <span title={vehicle.vin} className="truncate max-w-[120px] block">
                      {vehicle.vin}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-3 md:px-4">
                  {vehicle.condition ? (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary md:px-2 md:text-xs">
                      {vehicle.condition.toUpperCase()}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                  {vehicle.body_type ?? "—"}
                </td>
                <td className="px-2 py-3 text-sm font-medium text-foreground md:px-4">
                  {vehicle.price ? `$${vehicle.price.toLocaleString()}` : "—"}
                </td>
                <td className="hidden px-4 py-3 text-sm text-muted-foreground xl:table-cell">
                  {vehicle.msrp ? `$${vehicle.msrp.toLocaleString()}` : "—"}
                </td>
                <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                  {vehicle.miles ? `${vehicle.miles.toLocaleString()} mi` : "—"}
                </td>
                <td className="hidden px-4 py-3 text-sm text-muted-foreground xl:table-cell">
                  {typeof vehicle.days_on_market === "number"
                    ? `${vehicle.days_on_market} days`
                    : "—"}
                </td>
                <td className="px-2 py-3 md:px-4" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => onVehicleClick?.(vehicle)}
                  >
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

