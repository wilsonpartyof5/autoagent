import type { UnifiedVehicle } from '@autoagent/shared';

type MarketcheckListing = {
  id?: string;
  vin?: string;
  heading?: string;
  price?: number;
  msrp?: number;
  miles?: number;
  inventory_type?: string;
  stock_no?: string;
  vdp_url?: string;
  exterior_color?: string;
  interior_color?: string;
  dom?: number;
  dom_active?: number;
  dos_active?: number;
  dist?: number;
  in_transit?: boolean;
  media?: {
    photo_links?: string[];
    photo_links_cached?: string[];
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    vehicle_type?: string;
    transmission?: string;
    drivetrain?: string;
    fuel_type?: string;
    engine?: string;
    cylinders?: number;
    doors?: number;
    city_mpg?: number;
    highway_mpg?: number;
    powertrain_type?: string;
  };
  dealer?: {
    id?: string | number;
    name?: string;
    website?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number | string;
    longitude?: number | string;
  };
  mc_dealership?: Record<string, unknown>;
  financing_options?: Record<string, unknown>;
  leasing_options?: Record<string, unknown>;
  [key: string]: unknown;
};

type SearchPayload = {
  success?: boolean;
  data?: {
    num_found?: number;
    listings?: MarketcheckListing[];
  };
};

function payloadFromResult(result: unknown): SearchPayload {
  const envelope = result as {
    structuredContent?: SearchPayload;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (envelope?.structuredContent?.data) {
    return envelope.structuredContent;
  }
  for (const entry of envelope?.content ?? []) {
    if (entry.type === 'text' && entry.text) {
      try {
        const parsed = JSON.parse(entry.text) as SearchPayload;
        if (parsed?.data) return parsed;
      } catch {
        // Continue through alternate MCP content entries.
      }
    }
  }
  return {};
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function fuelType(
  value?: string,
): 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'plug-in hybrid' | 'flex fuel' | 'natural gas' | 'hydrogen' | 'other' | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes('plug') || normalized.includes('phev')) return 'plug-in hybrid';
  if (normalized.includes('hybrid') || normalized.includes('hev')) return 'hybrid';
  if (normalized.includes('electric') || normalized.includes('bev')) return 'electric';
  if (normalized.includes('diesel')) return 'diesel';
  if (normalized.includes('flex')) return 'flex fuel';
  if (normalized.includes('hydrogen') || normalized.includes('fcev')) return 'hydrogen';
  if (normalized.includes('gas') || normalized.includes('unleaded')) return 'gasoline';
  return 'other';
}

function drivetrain(
  value?: string,
): 'fwd' | 'rwd' | 'awd' | '4wd' | 'part-time 4wd' | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes('all') || normalized === 'awd') return 'awd';
  if (normalized.includes('front') || normalized === 'fwd') return 'fwd';
  if (normalized.includes('rear') || normalized === 'rwd') return 'rwd';
  if (normalized.includes('4') || normalized.includes('four')) return '4wd';
  return undefined;
}

export function normalizeMarketcheckListing(
  listing: MarketcheckListing,
): UnifiedVehicle | null {
  const build = listing.build ?? {};
  const year = numberValue(build.year);
  const make = build.make?.trim();
  const model = build.model?.trim();
  const price = numberValue(listing.price);
  const listingId = listing.id?.trim();
  if (!listingId || !year || !make || !model || price === undefined || price <= 0) {
    return null;
  }

  const dealer = listing.dealer ?? {};
  const dealerName = dealer.name?.trim() || 'Unknown Dealer';
  const photos = [
    ...(listing.media?.photo_links_cached ?? []),
    ...(listing.media?.photo_links ?? []),
  ].filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);
  const condition =
    listing.inventory_type === 'new'
      ? 'new'
      : listing.inventory_type === 'certified' || listing.inventory_type === 'cpo'
        ? 'certified'
        : 'used';

  return {
    id: listingId,
    baseIdentity: {
      vin: listing.vin,
      year,
      make,
      model,
      trim: build.trim,
      stockNumber: listing.stock_no,
      listingId,
    },
    condition,
    coreSpecs: {
      bodyType: build.body_type,
      doors: numberValue(build.doors),
      fuelType: fuelType(build.powertrain_type || build.fuel_type),
      engine: build.engine ? { description: build.engine } : undefined,
      transmission: build.transmission
        ? { description: build.transmission }
        : undefined,
      drivetrain: drivetrain(build.drivetrain),
      miles: numberValue(listing.miles),
    },
    dimensionsPerformance: {
      fuelEconomy: {
        city: numberValue(build.city_mpg),
        highway: numberValue(build.highway_mpg),
        unit: 'mpg',
      },
    },
    pricing: {
      price,
      msrp: numberValue(listing.msrp),
      currency: 'USD',
    },
    featuresPackages: {
      exteriorColor: listing.exterior_color,
      interiorColor: listing.interior_color,
    },
    media: {
      primaryPhotoUrl: photos[0],
      thumbnailUrl: photos[0],
      photoUrls: photos,
    },
    location: {
      dealer: {
        dealerId: dealer.id === undefined ? undefined : String(dealer.id),
        name: dealerName,
        address: dealer.street,
        city: dealer.city,
        state: dealer.state,
        zipCode: dealer.zip,
        latitude: numberValue(dealer.latitude),
        longitude: numberValue(dealer.longitude),
        distanceMiles: numberValue(listing.dist),
        website: dealer.website,
      },
    },
    availability: {
      status: 'available',
      inTransit: listing.in_transit,
    },
    marketData: {
      averageDaysOnMarket: numberValue(listing.dom_active ?? listing.dom),
    },
    operational: {
      dataSource: 'marketcheck-mcp',
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'success',
    },
    dealerDefined: {
      vdpUrl: listing.vdp_url,
      heading: listing.heading,
      dosActive: listing.dos_active,
      domActive: listing.dom_active,
      financingOptions: listing.financing_options,
      leasingOptions: listing.leasing_options,
      mcDealership: listing.mc_dealership,
    },
  } as UnifiedVehicle;
}

export function normalizeMarketcheckSearchResult(result: unknown): {
  vehicles: UnifiedVehicle[];
  totalCount: number;
  rejectedCount: number;
} {
  const payload = payloadFromResult(result);
  const listings = payload.data?.listings ?? [];
  const normalized = listings.map(normalizeMarketcheckListing);
  const vehicles = normalized.filter(
    (vehicle): vehicle is UnifiedVehicle => vehicle !== null,
  );
  return {
    vehicles,
    totalCount: payload.data?.num_found ?? listings.length,
    rejectedCount: listings.length - vehicles.length,
  };
}
