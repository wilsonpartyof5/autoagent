import type { DetailResponse, LiveVehicle } from '../marketcheck/mcp-adapter';
import { payloadContainsSecret } from '../marketcheck/secrets';

import { DiscoverApiError } from './errors';

const LISTING_KEYS = new Set([
  'id',
  'vin',
  'price',
  'miles',
  'msrp',
  'inventory_type',
  'dom_active',
  'dist',
  'build',
  'media',
  'car_location',
  'colors',
  'extra',
]);

const BUILD_KEYS = new Set([
  'year',
  'make',
  'model',
  'trim',
  'body_type',
  'drivetrain',
  'powertrain_type',
  'engine',
  'city_mpg',
  'highway_mpg',
  'seating_capacity',
]);

const MEDIA_KEYS = new Set(['photo_links']);
const LOCATION_KEYS = new Set(['city', 'state', 'latitude', 'longitude']);
const COLOR_KEYS = new Set(['exterior_color', 'interior_color']);
const EXTRA_KEYS = new Set(['features']);

const FORBIDDEN_KEYS = new Set([
  'dealer',
  'dealername',
  'dealer_name',
  'phone',
  'dealerphone',
  'dealer_phone',
  'email',
  'website',
  'dealerwebsite',
  'dealer_website',
  'street',
  'address',
  'dealeraddress',
  'dealer_address',
  'hours',
  'dealerhours',
  'dealer_hours',
  'salesperson',
  'salesstaff',
  'sales_staff',
  'dealerid',
  'dealer_id',
  'dealerrating',
  'dealer_rating',
  'rooftop',
  'rooftop_match',
  'vdp_url',
  'listing_url',
  'stock_no',
  'stockno',
  'seller_comments',
  'sellercomments',
  'description',
  'carfax_1_owner',
  'carfax_clean_title',
  'fees',
  'ref_price',
  'market_price',
  'fair_price',
  'history',
  'loadedsections',
  'loaded_sections',
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/;
const URL_PATTERN = /https?:\/\/|www\./i;

export type PublicListingBuild = {
  year: number;
  make: string;
  model: string;
  trim?: string;
  body_type?: string;
  drivetrain?: string;
  powertrain_type?: string;
  engine?: string;
  city_mpg?: number;
  highway_mpg?: number;
  seating_capacity?: number;
};

export type PublicListing = {
  id: string;
  vin: string;
  price: number;
  miles?: number;
  msrp?: number;
  inventory_type: 'new' | 'used' | 'cpo';
  dom_active?: number;
  dist?: number;
  build: PublicListingBuild;
  media: { photo_links: string[] };
  car_location?: {
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
  };
  colors?: {
    exterior_color?: string;
    interior_color?: string;
  };
  extra?: {
    features?: string[];
  };
};

function inventoryType(condition: 'new' | 'used' | 'certified'): 'new' | 'used' | 'cpo' {
  if (condition === 'new') return 'new';
  if (condition === 'certified') return 'cpo';
  return 'used';
}

function optionalText(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function optionalFinite(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function httpsPhotos(urls: string[] | undefined): string[] {
  if (!urls) return [];
  const out: string[] = [];
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:') continue;
      if ([...parsed.searchParams.keys()].some((key) => /key|token|secret|auth/i.test(key))) continue;
      out.push(parsed.toString());
    } catch {
      continue;
    }
    if (out.length >= 20) break;
  }
  return out;
}

function scrubFeature(value: string): string | null {
  const trimmed = value.trim().slice(0, 80);
  if (trimmed.length < 2) return null;
  if (EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed) || URL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const radius = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function publicListingFromSearchVehicle(
  vehicle: LiveVehicle,
  origin: { latitude: number; longitude: number },
): PublicListing | null {
  const vin = vehicle.vin?.trim().toUpperCase();
  const id = vehicle.id?.trim();
  if (!id || !vin) return null;
  if (typeof vehicle.year !== 'number' || !vehicle.make || !vehicle.model) return null;

  const listing: PublicListing = {
    id,
    vin,
    price: Math.max(0, Math.round(vehicle.price)),
    inventory_type: inventoryType(vehicle.condition),
    build: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
    },
    media: { photo_links: httpsPhotos(vehicle.photoUrls ?? (vehicle.primaryPhotoUrl ? [vehicle.primaryPhotoUrl] : [])) },
  };

  const trim = optionalText(vehicle.trim, 60);
  const bodyType = optionalText(vehicle.bodyType, 40);
  if (trim) listing.build.trim = trim;
  if (bodyType) listing.build.body_type = bodyType;
  if (typeof vehicle.miles === 'number') listing.miles = Math.max(0, Math.round(vehicle.miles));
  if (typeof vehicle.msrp === 'number') listing.msrp = Math.max(0, Math.round(vehicle.msrp));

  const lat = optionalFinite(vehicle.location?.latitude);
  const lng = optionalFinite(vehicle.location?.longitude);
  const city = optionalText(vehicle.location?.dealerCity, 80);
  const state = optionalText(vehicle.location?.dealerState, 8);
  if (lat != null || lng != null || city || state) {
    listing.car_location = {};
    if (city) listing.car_location.city = city;
    if (state) listing.car_location.state = state;
    if (lat != null) listing.car_location.latitude = lat;
    if (lng != null) listing.car_location.longitude = lng;
  }
  if (lat != null && lng != null) {
    listing.dist = Math.round(milesBetween(origin.latitude, origin.longitude, lat, lng) * 10) / 10;
  }

  return listing;
}

export function publicListingFromDetail(detail: DetailResponse): PublicListing | null {
  const vin = detail.vin?.trim().toUpperCase();
  const id = detail.id?.trim();
  if (!id || !vin) return null;

  const listing: PublicListing = {
    id,
    vin,
    price: Math.max(0, Math.round(detail.price)),
    inventory_type: inventoryType(detail.condition),
    build: {
      year: detail.year,
      make: detail.make,
      model: detail.model,
    },
    media: { photo_links: httpsPhotos(detail.photoUrls) },
  };

  const trim = optionalText(detail.trim, 60);
  const bodyType = optionalText(detail.bodyType, 40);
  const drivetrain = optionalText(detail.drivetrain, 40);
  const powertrain = optionalText(detail.powertrainType, 40);
  const engine = optionalText(detail.engine, 80);
  if (trim) listing.build.trim = trim;
  if (bodyType) listing.build.body_type = bodyType;
  if (drivetrain) listing.build.drivetrain = drivetrain;
  if (powertrain) listing.build.powertrain_type = powertrain;
  if (engine) listing.build.engine = engine;
  if (typeof detail.cityMpg === 'number') listing.build.city_mpg = detail.cityMpg;
  if (typeof detail.highwayMpg === 'number') listing.build.highway_mpg = detail.highwayMpg;
  if (typeof detail.seatingCapacity === 'number') listing.build.seating_capacity = detail.seatingCapacity;
  if (typeof detail.miles === 'number') listing.miles = Math.max(0, Math.round(detail.miles));
  if (typeof detail.msrp === 'number') listing.msrp = Math.max(0, Math.round(detail.msrp));
  if (typeof detail.daysOnMarket === 'number') listing.dom_active = Math.max(0, Math.round(detail.daysOnMarket));

  const lat = optionalFinite(detail.location?.latitude);
  const lng = optionalFinite(detail.location?.longitude);
  const city = optionalText(detail.location?.dealerCity, 80);
  const state = optionalText(detail.location?.dealerState, 8);
  if (lat != null || lng != null || city || state) {
    listing.car_location = {};
    if (city) listing.car_location.city = city;
    if (state) listing.car_location.state = state;
    if (lat != null) listing.car_location.latitude = lat;
    if (lng != null) listing.car_location.longitude = lng;
  }

  const exterior = optionalText(detail.exteriorColor, 60);
  const interior = optionalText(detail.interiorColor, 60);
  if (exterior || interior) {
    listing.colors = {};
    if (exterior) listing.colors.exterior_color = exterior;
    if (interior) listing.colors.interior_color = interior;
  }

  const features = (detail.features ?? [])
    .map((item) => (typeof item === 'string' ? scrubFeature(item) : null))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);
  if (features.length > 0) listing.extra = { features };

  return listing;
}

function assertAllowedObject(value: unknown, allowed: Set<string>): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized) || !allowed.has(key)) {
      throw new DiscoverApiError('UPSTREAM_ERROR', 'Listing could not be returned.');
    }
  }
}

export function assertPublicListing(listing: PublicListing): PublicListing {
  assertAllowedObject(listing, LISTING_KEYS);
  assertAllowedObject(listing.build, BUILD_KEYS);
  assertAllowedObject(listing.media, MEDIA_KEYS);
  if (listing.car_location) assertAllowedObject(listing.car_location, LOCATION_KEYS);
  if (listing.colors) assertAllowedObject(listing.colors, COLOR_KEYS);
  if (listing.extra) assertAllowedObject(listing.extra, EXTRA_KEYS);
  if (payloadContainsSecret(listing)) {
    throw new DiscoverApiError('UPSTREAM_ERROR', 'Listing could not be returned.');
  }
  return listing;
}

export function publicListingsContainForbiddenKey(payload: unknown): boolean {
  const seen = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      seen.add(key.toLowerCase());
      walk(child);
    }
  };
  walk(payload);
  for (const key of seen) {
    if (FORBIDDEN_KEYS.has(key)) return true;
  }
  return false;
}
