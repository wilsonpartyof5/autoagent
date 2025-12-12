"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { InventoryVehicle } from "@/app/app/inventory/page";

interface VehicleCardProps {
  vehicle: InventoryVehicle;
  onClick?: (vehicle: InventoryVehicle) => void;
}

function VehicleCardComponent({ vehicle, onClick }: VehicleCardProps) {
  // Extract enriched data from raw field
  const rawData = vehicle.raw as {
    original?: unknown;
    enriched?: {
      media?: {
        photo_links?: string[];
        primary_photo_url?: string;
      };
      extra?: {
        seller_comments?: string;
        options?: Array<{
          name?: string;
          code?: string;
          description?: string;
        }>;
      };
    };
  } | null;

  const enrichedListing =
    rawData && typeof rawData === "object" && "enriched" in rawData
      ? (rawData.enriched as {
          media?: { photo_links?: string[]; primary_photo_url?: string };
        })
      : null;

  // Prefer enriched photos if available
  const enrichedPhotos = enrichedListing?.media?.photo_links;
  const enrichedPrimaryPhoto = enrichedListing?.media?.primary_photo_url;

  const heroImage =
    enrichedPrimaryPhoto ??
    vehicle.primary_photo_url ??
    vehicle.thumbnail_url ??
    enrichedPhotos?.[0] ??
    vehicle.photo_urls?.[0] ??
    null;

  // Extract seller comments and options from enriched data
  const enrichedExtra =
    rawData && typeof rawData === "object" && "enriched" in rawData
      ? (rawData.enriched as {
          extra?: {
            seller_comments?: string;
            options?: Array<{ name?: string; code?: string; description?: string }>;
          };
        })?.extra
      : null;

  const sellerComments = enrichedExtra?.seller_comments;
  const options = enrichedExtra?.options ?? [];

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      data-vehicle-id={vehicle.id}
    >
      <div className="relative h-48 w-full bg-muted">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={`${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`}
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 320px, (min-width: 768px) 50vw, 100vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No photo available
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Title and Live Badge */}
        <div className="space-y-1">
          <div className="flex items-start gap-1.5">
            <h3 className="text-base font-semibold text-foreground line-clamp-2 leading-tight flex-1">
              {vehicle.year ?? "—"} {vehicle.make ?? ""} {vehicle.model ?? ""}
            </h3>
            {vehicle.is_live && (
              <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400 shrink-0">
                LIVE
              </span>
            )}
          </div>
          {vehicle.trim && (
            <p className="text-xs text-muted-foreground truncate">{vehicle.trim}</p>
          )}
        </div>

        {/* Condition and Body Type Badges */}
        <div className="flex flex-wrap gap-1.5">
          {vehicle.condition && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {vehicle.condition.toUpperCase()}
            </span>
          )}
          {vehicle.body_type && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {vehicle.body_type}
            </span>
          )}
        </div>

        {/* Price - Prominent */}
        <div className="mt-1">
          <span className="text-xl font-bold text-foreground">
            {vehicle.price ? `$${vehicle.price.toLocaleString()}` : "Price TBD"}
          </span>
          {vehicle.msrp && vehicle.msrp !== vehicle.price && (
            <p className="text-xs text-muted-foreground line-through mt-0.5">
              ${vehicle.msrp.toLocaleString()}
            </p>
          )}
        </div>

        {/* Key Info - Compact Grid */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {vehicle.miles !== null && (
            <>
              <span className="truncate">Mileage:</span>
              <span className="font-medium truncate text-right">
                {vehicle.miles ? `${vehicle.miles.toLocaleString()} mi` : "—"}
              </span>
            </>
          )}
          {vehicle.vin && (
            <>
              <span className="truncate">VIN:</span>
              <span className="font-medium truncate text-right font-mono text-[10px]">
                {vehicle.vin.slice(-8)}
              </span>
            </>
          )}
        </div>

        {/* View Details Button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-2 text-xs h-8"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(vehicle);
          }}
        >
          View Details
        </Button>

        {/* Dealer Info - Compact */}
        {(vehicle.dealer_name || vehicle.dealer_city || vehicle.dealer_state) && (
          <div className="text-[10px] text-muted-foreground truncate mt-auto pt-1 border-t border-border/40">
            {vehicle.dealer_name && <p className="truncate">{vehicle.dealer_name}</p>}
            {(vehicle.dealer_city || vehicle.dealer_state) && (
              <p className="truncate">
                {[vehicle.dealer_city, vehicle.dealer_state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// Export with displayName for easier identification
export const VehicleCard = VehicleCardComponent as typeof VehicleCardComponent & { displayName: string };
VehicleCard.displayName = 'VehicleCard';

