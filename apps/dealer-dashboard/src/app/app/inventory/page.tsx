import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { InventoryPageClient } from "@/components/dashboard/inventory/inventory-page-client";
import { VehicleCard } from "@/components/dashboard/inventory/vehicle-card";
import { parseFiltersFromSearchParams } from "@/types/inventoryFilters";
import { getActiveDealershipId } from "@/lib/supabase/dealerships";

export type InventoryVehicle = {
  id: string;
  vin: string | null;
  stock_number: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  price: number | null;
  msrp: number | null;
  miles: number | null;
  condition: string | null;
  body_type: string | null;
  drivetrain: string | null;
  fuel_type: string | null;
  transmission: string | null;
  interior_color: string | null;
  exterior_color: string | null;
  certified: boolean | null;
  features: string[] | null;
  market_average_price: number | null;
  days_on_market: number | null;
  thumbnail_url: string | null;
  primary_photo_url: string | null;
  photo_urls: string[] | null;
  dealer_name: string | null;
  dealer_address: string | null;
  dealer_city: string | null;
  dealer_state: string | null;
  dealer_phone: string | null;
  dealer_website: string | null;
  is_live: boolean | null;
  published_at: string | null;
  published_by: string | null;
  raw: unknown; // Contains enriched data when available
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function InventoryPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  // Parse filters from URL
  const resolvedSearchParams = await searchParams;
  const urlSearchParams = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => urlSearchParams.append(key, v));
    } else if (value) {
      urlSearchParams.set(key, value);
    }
  });
  const filters = parseFiltersFromSearchParams(urlSearchParams);

  // Get active dealership ID
  const activeDealershipId = await getActiveDealershipId();
  
  if (!activeDealershipId) {
    // No active dealership - show empty state
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">
            Please set up a dealership first in Settings.
          </p>
        </header>
      </section>
    );
  }

  // Build query with filters
  // Use wildcard select to handle missing columns gracefully (migrations may not be run yet)
  // Scope by dealership_id instead of user_id
  let query = supabase
    .from("inventory_vehicles")
    .select("*")
    .eq("dealership_id", activeDealershipId);

  // Apply condition filter
  if (filters.condition.length > 0) {
    query = query.in("condition", filters.condition);
  }

  // Apply body type filter
  if (filters.bodyType.length > 0) {
    query = query.in("body_type", filters.bodyType);
  }

  // Apply price range
  if (filters.minPrice !== null) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice !== null) {
    query = query.lte("price", filters.maxPrice);
  }

  // Apply MSRP range
  if (filters.minMsrp !== null) {
    query = query.gte("msrp", filters.minMsrp);
  }
  if (filters.maxMsrp !== null) {
    query = query.lte("msrp", filters.maxMsrp);
  }

  // Apply days on market filter
  if (filters.daysOnLot !== 'any') {
    if (filters.daysOnLot === '0-14') {
      query = query.gte("days_on_market", 0).lte("days_on_market", 14);
    } else if (filters.daysOnLot === '15-30') {
      query = query.gte("days_on_market", 15).lte("days_on_market", 30);
    } else if (filters.daysOnLot === '31+') {
      query = query.gte("days_on_market", 31);
    }
  }

  // Apply stock number filter (case-insensitive partial match)
  if (filters.stockNumber) {
    query = query.ilike("stock_number", `%${filters.stockNumber}%`);
  }

  // Apply VIN filter (case-insensitive partial match)
  if (filters.vin) {
    query = query.ilike("vin", `%${filters.vin}%`);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("[inventory] failed to load vehicles", error);
    // If query fails, try a simpler fallback query with only essential columns
    const fallbackQuery = supabase
      .from("inventory_vehicles")
      .select("id, vin, year, make, model, trim, price, miles, dealer_name, dealer_address, raw, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) {
      console.error("[inventory] fallback query also failed", fallbackError);
      return (
        <section className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
            <p className="text-sm text-muted-foreground">
              Review the vehicles imported from MarketCheck. Publish listings once you&apos;re ready to go live
              inside ChatGPT.
            </p>
          </header>
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
            <h2 className="text-lg font-semibold text-foreground">Error loading inventory</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please ensure database migrations have been run. Check the console for details.
            </p>
          </div>
        </section>
      );
    }
    // Map fallback data to full type with nulls for missing fields
    const fallbackVehicles: InventoryVehicle[] = (fallbackData || []).map((v: any) => ({
      id: v.id,
      vin: v.vin ?? null,
      stock_number: null,
      year: v.year ?? null,
      make: v.make ?? null,
      model: v.model ?? null,
      trim: v.trim ?? null,
      price: v.price ?? null,
      msrp: null,
      miles: v.miles ?? null,
      condition: null,
      body_type: null,
      drivetrain: null,
      fuel_type: null,
      transmission: null,
      interior_color: null,
      exterior_color: null,
      certified: null,
      features: null,
      market_average_price: null,
      days_on_market: null,
      thumbnail_url: null,
      primary_photo_url: null,
      photo_urls: null,
      dealer_name: v.dealer_name ?? null,
      dealer_address: v.dealer_address ?? null,
      dealer_city: null,
      dealer_state: null,
      dealer_phone: null,
      dealer_website: null,
      is_live: null,
      published_at: null,
      published_by: null,
      raw: v.raw ?? null,
    }));
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">
            Review the vehicles imported from MarketCheck. Publish listings once you&apos;re ready to go live
            inside ChatGPT.
          </p>
        </header>
        <InventoryPageClient availableBodyTypes={[]} vehicles={fallbackVehicles}>
          {fallbackVehicles.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {fallbackVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}
        </InventoryPageClient>
      </section>
    );
  }

  let vehicles: InventoryVehicle[] = (data as InventoryVehicle[] | null) ?? [];

  // Apply boolean filters (these require checking the data structure)
  if (filters.hasPhotos) {
    vehicles = vehicles.filter(
      (v) =>
        (v.photo_urls && v.photo_urls.length > 0) ||
        v.primary_photo_url ||
        v.thumbnail_url ||
        (v.raw &&
          typeof v.raw === 'object' &&
          'enriched' in v.raw &&
          v.raw.enriched &&
          typeof v.raw.enriched === 'object' &&
          'media' in v.raw.enriched &&
          v.raw.enriched.media &&
          typeof v.raw.enriched.media === 'object' &&
          'photo_links' in v.raw.enriched.media &&
          Array.isArray(v.raw.enriched.media.photo_links) &&
          v.raw.enriched.media.photo_links.length > 0)
    );
  }

  if (filters.hasSellerComments) {
    vehicles = vehicles.filter((v) => {
      if (!v.raw || typeof v.raw !== 'object' || !('enriched' in v.raw)) {
        return false;
      }
      const enriched = v.raw.enriched;
      if (!enriched || typeof enriched !== 'object' || !('extra' in enriched)) {
        return false;
      }
      const extra = enriched.extra;
      return (
        extra &&
        typeof extra === 'object' &&
        'seller_comments' in extra &&
        extra.seller_comments &&
        typeof extra.seller_comments === 'string' &&
        extra.seller_comments.trim().length > 0
      );
    });
  }

  if (filters.hasOptions) {
    vehicles = vehicles.filter((v) => {
      if (!v.raw || typeof v.raw !== 'object' || !('enriched' in v.raw)) {
        return false;
      }
      const enriched = v.raw.enriched;
      if (!enriched || typeof enriched !== 'object' || !('extra' in enriched)) {
        return false;
      }
      const extra = enriched.extra;
      return (
        extra &&
        typeof extra === 'object' &&
        'options' in extra &&
        Array.isArray(extra.options) &&
        extra.options.length > 0
      );
    });
  }

  // Get distinct body types for filter options (scoped to active dealership)
  const { data: bodyTypeData } = await supabase
    .from("inventory_vehicles")
    .select("body_type")
    .eq("dealership_id", activeDealershipId)
    .not("body_type", "is", null);

  const availableBodyTypes = Array.from(
    new Set(
      (bodyTypeData || [])
        .map((v) => v.body_type)
        .filter((bt): bt is string => typeof bt === "string" && bt.length > 0)
    )
  ).sort();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
        <p className="text-sm text-muted-foreground">
          Review the vehicles imported from MarketCheck. Publish listings once you&apos;re ready to go live
          inside ChatGPT.
        </p>
      </header>

      <InventoryPageClient availableBodyTypes={availableBodyTypes} vehicles={vehicles}>
      {vehicles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
      </InventoryPageClient>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
      <h2 className="text-lg font-semibold text-foreground">No vehicles imported yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Run the MarketCheck sync from the setup page to bring in your live inventory.
      </p>
      <div className="mt-4 flex justify-center">
        <Button asChild>
          <a href="/app/setup">Sync inventory</a>
        </Button>
      </div>
    </div>
  );
}
