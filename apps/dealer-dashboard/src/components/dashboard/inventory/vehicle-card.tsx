"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { InventoryVehicle } from "@/app/app/inventory/page";

export function VehicleCard({ vehicle }: { vehicle: InventoryVehicle }) {
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
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-foreground">
              {vehicle.year ?? "—"} {vehicle.make ?? ""} {vehicle.model ?? ""}
            </h3>
            {vehicle.is_live && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                LIVE
              </span>
            )}
          </div>
          {vehicle.trim && <p className="text-sm text-muted-foreground">{vehicle.trim}</p>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {vehicle.condition && (
            <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
              {vehicle.condition.toUpperCase()}
            </span>
          )}
          {vehicle.body_type && (
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
              {vehicle.body_type}
            </span>
          )}
          {typeof vehicle.days_on_market === "number" && (
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
              {vehicle.days_on_market} days on lot
            </span>
          )}
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            VIN: <span className="font-medium">{vehicle.vin ?? "Unavailable"}</span>
          </p>
          <p>
            Mileage:{" "}
            <span className="font-medium">
              {vehicle.miles ? `${vehicle.miles.toLocaleString()} mi` : "—"}
            </span>
          </p>
          {vehicle.market_average_price && (
            <p>
              Market avg:{" "}
              <span className="font-medium">
                ${vehicle.market_average_price.toLocaleString()}
              </span>
            </p>
          )}
          {vehicle.msrp && (
            <p>
              MSRP: <span className="font-medium">${vehicle.msrp.toLocaleString()}</span>
            </p>
          )}
        </div>
        {sellerComments && (
          <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            <p className="line-clamp-2" title={sellerComments}>
              {sellerComments}
            </p>
          </div>
        )}
        {options.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {options.map((option, idx) => (
              <span
                key={idx}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                title={option.description || option.name}
              >
                {option.name || option.code || "Option"}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between text-sm">
          <span className="text-lg font-bold text-foreground">
            {vehicle.price ? `$${vehicle.price.toLocaleString()}` : "Price TBD"}
          </span>
          <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
            View Details
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {vehicle.dealer_name && <p>{vehicle.dealer_name}</p>}
          {vehicle.dealer_address ? (
            <p>{vehicle.dealer_address}</p>
          ) : vehicle.dealer_city || vehicle.dealer_state ? (
            <p>
              {[vehicle.dealer_city, vehicle.dealer_state].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

