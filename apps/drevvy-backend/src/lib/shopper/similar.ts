import type { LiveSearchParams, LiveSearchResult, LiveVehicle } from '@/lib/marketcheck/mcp-adapter';

import { ShopperDealError, type VehicleSnapshot } from './deals';

export const SIMILAR_RADIUS_MILES = 50;
export const SIMILAR_PRICE_BAND = 0.1;
export const SIMILAR_ROW_LIMIT = 8;

export type SimilarQuery = {
  excludeListingId: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  minPrice: number;
  maxPrice: number;
  latitude: number;
  longitude: number;
  radiusMiles: number;
};

export type SimilarListing = {
  listingId: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  miles?: number;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  thumbnailUrl?: string;
};

export type SimilarSearch = (params: LiveSearchParams) => Promise<LiveSearchResult>;

export function priceBand(price: number): { minPrice: number; maxPrice: number } {
  const band = Math.max(1000, Math.round(price * SIMILAR_PRICE_BAND));
  return {
    minPrice: Math.max(0, price - band),
    maxPrice: price + band,
  };
}

export function similarSearchQuery(vehicle: VehicleSnapshot, listingId: string): SimilarQuery {
  if (vehicle.latitude == null || vehicle.longitude == null) {
    throw new ShopperDealError('This car has no location to search around.', 422, 'missing_origin');
  }
  const band = priceBand(vehicle.price);
  return {
    excludeListingId: listingId,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim ?? null,
    minPrice: band.minPrice,
    maxPrice: band.maxPrice,
    latitude: vehicle.latitude,
    longitude: vehicle.longitude,
    radiusMiles: SIMILAR_RADIUS_MILES,
  };
}

export function mockSimilarListings(query: SimilarQuery): SimilarListing[] {
  const span = query.maxPrice - query.minPrice;
  const prices = [0.25, 0.5, 0.75].map((slot) => query.minPrice + Math.round(span * slot));
  const offsets = [
    { latitude: 0.08, longitude: -0.05, distanceMiles: 8 },
    { latitude: -0.12, longitude: 0.1, distanceMiles: 18 },
    { latitude: 0.2, longitude: 0.16, distanceMiles: 31 },
  ];
  return offsets.map((offset, index) => {
    const listing: SimilarListing = {
      listingId: `similar-${query.excludeListingId}-${index + 1}`,
      year: query.year,
      make: query.make,
      model: query.model,
      price: clamp(prices[index], query.minPrice, query.maxPrice),
      miles: 12000 + index * 3500,
      city: 'Charlotte',
      state: 'NC',
      latitude: roundCoord(query.latitude + offset.latitude),
      longitude: roundCoord(query.longitude + offset.longitude),
      distanceMiles: offset.distanceMiles,
    };
    if (query.trim) listing.trim = query.trim;
    return listing;
  });
}

export async function findSimilarListings(
  query: SimilarQuery,
  options: { live: boolean; search?: SimilarSearch },
): Promise<{ source: 'mock' | 'live'; listings: SimilarListing[] }> {
  if (!options.live || !options.search) {
    return { source: 'mock', listings: mockSimilarListings(query) };
  }
  try {
    const result = await options.search({
      latitude: query.latitude,
      longitude: query.longitude,
      radiusMiles: query.radiusMiles,
      rows: SIMILAR_ROW_LIMIT,
      filters: {
        year: query.year,
        make: query.make,
        model: query.model,
        trim: query.trim ?? undefined,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
      },
    });
    return { source: 'live', listings: toShopperListings(result.vehicles, query) };
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'similar_search_fallback',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return { source: 'mock', listings: mockSimilarListings(query) };
  }
}

export function toShopperListing(vehicle: LiveVehicle, query: SimilarQuery): SimilarListing | null {
  const listingId = vehicle.listingId || vehicle.id;
  if (!listingId || listingId === query.excludeListingId) return null;
  if (vehicle.year !== query.year) return null;
  if (vehicle.make.toLowerCase() !== query.make.toLowerCase()) return null;
  if (vehicle.model.toLowerCase() !== query.model.toLowerCase()) return null;
  if (query.trim && vehicle.trim && vehicle.trim.toLowerCase() !== query.trim.toLowerCase()) return null;
  if (vehicle.price < query.minPrice || vehicle.price > query.maxPrice) return null;

  const distanceMiles = haversineMiles(
    query.latitude,
    query.longitude,
    vehicle.location.latitude,
    vehicle.location.longitude,
  );
  if (distanceMiles > query.radiusMiles) return null;

  const listing: SimilarListing = {
    listingId,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    price: vehicle.price,
    latitude: vehicle.location.latitude,
    longitude: vehicle.location.longitude,
    distanceMiles: Math.round(distanceMiles),
  };
  if (vehicle.trim) listing.trim = vehicle.trim;
  if (typeof vehicle.miles === 'number') listing.miles = vehicle.miles;
  if (vehicle.location.dealerCity) listing.city = vehicle.location.dealerCity;
  if (vehicle.location.dealerState) listing.state = vehicle.location.dealerState;
  if (vehicle.thumbnailUrl && vehicle.thumbnailUrl.startsWith('https://')) {
    listing.thumbnailUrl = vehicle.thumbnailUrl;
  }
  return listing;
}

function toShopperListings(vehicles: LiveVehicle[], query: SimilarQuery): SimilarListing[] {
  const listings: SimilarListing[] = [];
  for (const vehicle of vehicles) {
    const listing = toShopperListing(vehicle, query);
    if (listing) listings.push(listing);
    if (listings.length >= SIMILAR_ROW_LIMIT) break;
  }
  return listings;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}
