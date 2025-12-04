import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { InventoryPageClient } from "@/components/dashboard/inventory/inventory-page-client";
import { VehicleCard } from "@/components/dashboard/inventory/vehicle-card";
import { ResyncButton } from "@/components/dashboard/inventory/resync-button";
import { parseFiltersFromSearchParams } from "@/types/inventoryFilters";
import { getActiveDealershipId, getActiveDealership } from "@/lib/supabase/dealerships";
import { searchUVSVehicles, convertUVSToInventoryVehicle, type UVSVehicleSearchFilters } from "@/lib/db/uvs-vehicles";

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

  // Build UVS search filters
  const uvsFilters: UVSVehicleSearchFilters = {
    minPrice: filters.minPrice ?? undefined,
    maxPrice: filters.maxPrice ?? undefined,
    availabilityStatus: 'available', // Only show available vehicles by default
  };

  // Apply condition filter
  if (filters.condition.length > 0 && filters.condition.length < 3) {
    // If not selecting all conditions, filter by the selected ones
    // Note: UVS only supports single condition, so we'll need to filter after query
    if (filters.condition.length === 1) {
      uvsFilters.condition = filters.condition[0] as 'new' | 'used' | 'certified';
    }
  }

  // Search UVS vehicles with filters
  const { vehicles: uvsVehicles, total } = await searchUVSVehicles(uvsFilters);

  // Get full row data including sync metadata
  let query = supabase
    .from("uvs_vehicles")
    .select("id, uvs_data, last_synced_at, sync_status, sync_error, availability_status, data_source")
    .in("id", uvsVehicles.map(v => v.id));

  const { data: rowsData, error } = await query;

  if (error) {
    console.error("[inventory] failed to load UVS vehicles", error);
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">
            Review your UVS inventory. Publish listings once you&apos;re ready to go live inside ChatGPT.
          </p>
        </header>
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">Error loading inventory</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Failed to load vehicles from UVS database. Check the console for details.
          </p>
        </div>
      </section>
    );
  }

  // Create a map of row data by vehicle ID for metadata
  const rowsMap = new Map((rowsData || []).map((row: any) => [row.id, row]));

  // Convert UVS vehicles to InventoryVehicle format with metadata
  let vehicles: InventoryVehicle[] = uvsVehicles.map((vehicle) => {
    const row = rowsMap.get(vehicle.id);
    return convertUVSToInventoryVehicle(vehicle, row);
  });

  // Apply additional filters that need to check UVS structure
  if (filters.bodyType.length > 0) {
    vehicles = vehicles.filter((v) => {
      const bodyType = v.body_type;
      return bodyType && filters.bodyType.includes(bodyType);
    });
  }

  if (filters.minMsrp !== null || filters.maxMsrp !== null) {
    vehicles = vehicles.filter((v) => {
      if (v.msrp === null) return false;
      if (filters.minMsrp !== null && v.msrp < filters.minMsrp) return false;
      if (filters.maxMsrp !== null && v.msrp > filters.maxMsrp) return false;
      return true;
    });
  }

  if (filters.daysOnLot !== 'any') {
    vehicles = vehicles.filter((v) => {
      const days = v.days_on_market;
      if (days === null) return false;
      if (filters.daysOnLot === '0-14') return days >= 0 && days <= 14;
      if (filters.daysOnLot === '15-30') return days >= 15 && days <= 30;
      if (filters.daysOnLot === '31+') return days >= 31;
      return true;
    });
  }

  if (filters.stockNumber) {
    vehicles = vehicles.filter((v) => {
      return v.stock_number?.toLowerCase().includes(filters.stockNumber.toLowerCase());
    });
  }

  if (filters.vin) {
    vehicles = vehicles.filter((v) => {
      return v.vin?.toLowerCase().includes(filters.vin.toLowerCase());
    });
  }

  // Apply boolean filters (these require checking the data structure)
  if (filters.hasPhotos) {
    vehicles = vehicles.filter(
      (v) =>
        (v.photo_urls && v.photo_urls.length > 0) ||
        v.primary_photo_url ||
        v.thumbnail_url
    );
  }

  if (filters.hasSellerComments) {
    vehicles = vehicles.filter((v) => {
      const vehicle = v.raw as any;
      const enrichment = vehicle?.enrichment;
      if (!enrichment?.providerSpecific) return false;
      const providerData = enrichment.providerSpecific;
      const marketcheck = providerData?.marketcheck;
      const comments = marketcheck?.extra?.seller_comments;
      return comments && typeof comments === 'string' && comments.trim().length > 0;
    });
  }

  if (filters.hasOptions) {
    vehicles = vehicles.filter((v) => {
      const vehicle = v.raw as any;
      const packages = vehicle?.featuresPackages?.packages;
      if (Array.isArray(packages) && packages.length > 0) return true;
      const enrichment = vehicle?.enrichment;
      if (enrichment?.providerSpecific) {
        const marketcheck = enrichment.providerSpecific?.marketcheck;
        const options = marketcheck?.extra?.options;
        return Array.isArray(options) && options.length > 0;
      }
      return false;
    });
  }

  // Apply condition filter if multiple conditions selected
  if (filters.condition.length > 0 && filters.condition.length < 3) {
    vehicles = vehicles.filter((v) => {
      return v.condition && filters.condition.includes(v.condition);
    });
  }

  // Get distinct body types from UVS vehicles
  const availableBodyTypes = Array.from(
    new Set(
      vehicles
        .map((v) => v.body_type)
        .filter((bt): bt is string => typeof bt === "string" && bt.length > 0)
    )
  ).sort();

  // Get active dealership to check if re-sync is available
  const activeDealership = await getActiveDealership();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
            <p className="text-sm text-muted-foreground">
              Review the vehicles imported from MarketCheck. Publish listings once you&apos;re ready to go live
              inside ChatGPT.
            </p>
          </div>
          {activeDealership?.marketcheckDealerId && (
            <ResyncButton />
          )}
        </div>
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

