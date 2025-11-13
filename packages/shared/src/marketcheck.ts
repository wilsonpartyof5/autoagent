import { randomUUID } from 'node:crypto';
import { type Vehicle } from './types.js';

export interface MarketCheckVehicle {
  id: string;
  vin?: string;
  stock_no?: string;
  heading?: string;
  price?: number;
  msrp?: number;
  dom?: number;
  inventory_type?: 'new' | 'used' | 'cpo';
  certified?: boolean;
  exterior_color?: string;
  interior_color?: string;
  mileage?: number;
  miles?: number;
  source?: string;
  price_history?: Array<{
    price?: number;
    timestamp?: number | string;
    source?: string;
  }>;
  media?: {
    photo_links?: string[];
    primary_photo_url?: string;
    thumbnail?: { url?: string };
    video_url?: string;
  };
  features?: string[];
  market_data?: {
    market_average_price?: number;
  };
  dealer?: {
    id?: string | number;
    name: string;
    street?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number | string;
    longitude?: number | string;
    phone?: string;
    website?: string;
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    drivetrain?: string;
    drive_train?: string;
    fuel_type?: string;
    transmission?: string;
  };
}

/**
 * Normalize a MarketCheck listing into the AutoAgent Vehicle schema.
 */
export function normalizeMarketCheckVehicle(listing: MarketCheckVehicle): Vehicle {
  const nowIso = new Date().toISOString();

  const year = listing.build?.year ?? new Date().getFullYear();
  const make = listing.build?.make ?? 'Unknown';
  const model = listing.build?.model ?? 'Vehicle';

  const photoUrls = listing.media?.photo_links?.filter(Boolean) ?? [];
  const primaryPhoto =
    listing.media?.primary_photo_url ||
    listing.media?.thumbnail?.url ||
    photoUrls[0];

  const mileage = listing.miles ?? listing.mileage;
  const priceHistory =
    listing.price_history && listing.price_history.length > 0
      ? listing.price_history
          .filter((entry) => typeof entry.price === 'number')
          .map((entry) => ({
            price: Math.max(entry.price ?? 0, 0),
            timestamp:
              typeof entry.timestamp === 'number'
                ? new Date(entry.timestamp * 1000).toISOString()
                : entry.timestamp
                  ? new Date(entry.timestamp).toISOString()
                  : nowIso,
            source: entry.source,
          }))
      : undefined;

  const dealerLatitude =
    typeof listing.dealer?.latitude === 'string'
      ? parseFloat(listing.dealer.latitude)
      : listing.dealer?.latitude;

  const dealerLongitude =
    typeof listing.dealer?.longitude === 'string'
      ? parseFloat(listing.dealer.longitude)
      : listing.dealer?.longitude;

  const dealerAddressParts = [
    listing.dealer?.street,
    listing.dealer?.city,
    listing.dealer?.state,
    listing.dealer?.zip,
  ].filter(Boolean);

  const dealerAddress =
    dealerAddressParts.length > 0 ? dealerAddressParts.join(', ') : undefined;

  // Validate and normalize dealer website URL
  let dealerWebsite: string | undefined = undefined;
  if (listing.dealer?.website) {
    const website = listing.dealer.website.trim();
    // If it's already a valid URL, use it
    if (website.startsWith('http://') || website.startsWith('https://')) {
      try {
        new URL(website);
        dealerWebsite = website;
      } catch {
        // Invalid URL, skip it
      }
    } else if (website.includes('.') && !website.includes(' ')) {
      // Assume it's a domain and prepend https://
      try {
        const url = `https://${website}`;
        new URL(url);
        dealerWebsite = url;
      } catch {
        // Invalid domain, skip it
      }
    }
  }

  const condition =
    listing.inventory_type === 'cpo'
      ? 'certified'
      : (listing.inventory_type as 'new' | 'used' | undefined);

  const featuresSet = new Set<string>();
  listing.features?.forEach((feature) => {
    if (feature) {
      featuresSet.add(feature);
    }
  });
  [listing.build?.trim, listing.build?.drivetrain, listing.build?.drive_train, listing.build?.transmission]
    .filter(Boolean)
    .forEach((value) => featuresSet.add(String(value)));

  const features =
    featuresSet.size > 0 ? Array.from(featuresSet.values()) : undefined;

  const vehicle: Vehicle = {
    id: listing.id || listing.vin || randomUUID(),
    vin: listing.vin,
    stockNumber: listing.stock_no,
    listingId: listing.id,
    year,
    make,
    model,
    trim: listing.build?.trim ?? undefined,
    condition,
    bodyType: listing.build?.body_type ?? undefined,
    drivetrain: listing.build?.drivetrain ?? listing.build?.drive_train ?? undefined,
    fuelType: listing.build?.fuel_type ?? undefined,
    transmission: listing.build?.transmission ?? undefined,
    price: Math.max(listing.price ?? 0, 0),
    msrp: listing.msrp ?? undefined,
    priceChangeHistory: priceHistory,
    miles: typeof mileage === 'number' ? Math.max(mileage, 0) : undefined,
    dealer: {
      dealerId: listing.dealer?.id?.toString(),
      name: listing.dealer?.name || 'Unknown Dealer',
      city: listing.dealer?.city ?? undefined,
      state: listing.dealer?.state ?? undefined,
      latitude: dealerLatitude ?? undefined,
      longitude: dealerLongitude ?? undefined,
      phone: listing.dealer?.phone ?? undefined,
      website: dealerWebsite,
      address: dealerAddress,
    },
    photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    thumbnailUrl: primaryPhoto,
    videoUrl: listing.media?.video_url ?? undefined,
    imageUrl: primaryPhoto,
    features,
    interiorColor: listing.interior_color ?? undefined,
    exteriorColor: listing.exterior_color ?? undefined,
    certified:
      typeof listing.certified === 'boolean'
        ? listing.certified
        : condition === 'certified',
    marketAveragePrice: listing.market_data?.market_average_price ?? undefined,
    daysOnMarket: listing.dom ?? undefined,
    source: listing.source ?? 'marketcheck',
    lastSyncedAt: nowIso,
    syncStatus: 'success',
    dataSource: 'marketcheck-api',
    leadStatus: 'none',
    lastLeadAt: undefined,
    leadId: undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return vehicle;
}
