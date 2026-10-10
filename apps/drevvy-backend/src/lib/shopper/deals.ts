import { NextResponse } from 'next/server';

import { ShopperAuthError, shopperAuthErrorResponse } from './session';

export const SHOPPER_DEAL_STATUSES = ['interested', 'negotiating', 'accepted', 'closed'] as const;
export type ShopperDealStatus = (typeof SHOPPER_DEAL_STATUSES)[number];

export type VehicleSnapshot = {
  year: number;
  make: string;
  model: string;
  price: number;
  trim?: string;
  msrp?: number;
  miles?: number;
  condition?: 'new' | 'used' | 'certified';
  vin?: string;
  bodyType?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  daysOnMarket?: number;
  thumbnailUrl?: string;
};

export type ShopperDeal = {
  id: string;
  listingId: string;
  status: ShopperDealStatus;
  outreachLockedUntilPaid: true;
  vehicle: VehicleSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type ShopperDealRow = {
  id: string;
  consumerUserId: string;
  listingId: string;
  status: string;
  outreachLockedUntilPaid: boolean;
  vehicle: unknown;
  createdAt: string;
  updatedAt: string;
};

export type NewShopperDeal = {
  consumerUserId: string;
  listingId: string;
  status: 'interested';
  outreachLockedUntilPaid: true;
  vehicle: VehicleSnapshot;
};

export interface ShopperDealRepository {
  findOpen(consumerUserId: string, listingId: string): Promise<ShopperDealRow | null>;
  insert(deal: NewShopperDeal): Promise<ShopperDealRow>;
  list(consumerUserId: string): Promise<ShopperDealRow[]>;
  get(consumerUserId: string, dealId: string): Promise<ShopperDealRow | null>;
}

export class ShopperDealError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ShopperDealError';
  }
}

export class ShopperDealConflict extends ShopperDealError {
  constructor() {
    super('An open deal already exists for this listing.', 409, 'deal_exists');
    this.name = 'ShopperDealConflict';
  }
}

const DEALER_IDENTITY_KEYS = new Set([
  'dealername',
  'dealer_name',
  'dealerphone',
  'dealer_phone',
  'phone',
  'email',
  'website',
  'dealerwebsite',
  'dealer_website',
  'dealeraddress',
  'dealer_address',
  'street',
  'address',
  'salesperson',
  'salesstaff',
  'sales_staff',
  'dealerid',
  'dealer_id',
  'dealerhours',
  'dealer_hours',
  'dealerrating',
  'dealer_rating',
  'dealerreviewcount',
  'dealer_review_count',
  'dealer',
  'seller',
  'sellername',
  'seller_name',
]);

const LISTING_ID = /^[A-Za-z0-9_-]{4,64}$/;

export function readCreateDealInput(body: unknown): { listingId: unknown; vehicle: unknown } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ShopperDealError('Send a listing and vehicle.', 400, 'invalid_request');
  }
  const record = body as Record<string, unknown>;
  return { listingId: record.listingId, vehicle: record.vehicle };
}

export async function createShopperDeal(
  repo: ShopperDealRepository,
  input: { consumerUserId: string; listingId: unknown; vehicle: unknown },
): Promise<ShopperDeal> {
  const listingId = parseListingId(input.listingId);
  const vehicle = parseVehicleSnapshot(input.vehicle, 'request');
  const existing = await repo.findOpen(input.consumerUserId, listingId);
  if (existing) return toShopperDeal(existing);

  try {
    const created = await repo.insert({
      consumerUserId: input.consumerUserId,
      listingId,
      status: 'interested',
      outreachLockedUntilPaid: true,
      vehicle,
    });
    return toShopperDeal(created);
  } catch (error) {
    if (!(error instanceof ShopperDealConflict)) throw error;
    const again = await repo.findOpen(input.consumerUserId, listingId);
    if (again) return toShopperDeal(again);
    throw error;
  }
}

export async function listShopperDeals(
  repo: ShopperDealRepository,
  consumerUserId: string,
): Promise<ShopperDeal[]> {
  const rows = await repo.list(consumerUserId);
  return rows.map((row) => toShopperDeal(row));
}

export async function getShopperDeal(
  repo: ShopperDealRepository,
  consumerUserId: string,
  dealId: string,
): Promise<ShopperDeal | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dealId)) {
    throw new ShopperDealError('Deal id is not valid.', 400, 'invalid_id');
  }
  const row = await repo.get(consumerUserId, dealId);
  return row ? toShopperDeal(row) : null;
}

export function toShopperDeal(row: ShopperDealRow): ShopperDeal {
  if (!isStatus(row.status)) {
    throw new ShopperDealError('This deal could not be read.', 500, 'deal_unreadable');
  }
  const deal: ShopperDeal = {
    id: row.id,
    listingId: row.listingId,
    status: row.status,
    outreachLockedUntilPaid: true,
    vehicle: parseVehicleSnapshot(row.vehicle, 'stored'),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  assertNoDealerIdentity(deal);
  return deal;
}

export function shopperDealErrorResponse(error: unknown): NextResponse {
  if (error instanceof ShopperAuthError) return shopperAuthErrorResponse(error);
  if (error instanceof ShopperDealError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(JSON.stringify({
    event: 'shopper_deal_failed',
    message: error instanceof Error ? error.message : 'unknown',
  }));
  return NextResponse.json(
    { success: false, error: { code: 'internal_error', message: 'Drevvy could not load this deal.' } },
    { status: 500 },
  );
}

function parseListingId(value: unknown): string {
  if (typeof value !== 'string' || !LISTING_ID.test(value)) {
    throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
  }
  return value;
}

function parseVehicleSnapshot(value: unknown, source: 'request' | 'stored'): VehicleSnapshot {
  const fail = (message: string): never => {
    throw new ShopperDealError(
      message,
      source === 'request' ? 400 : 500,
      source === 'request' ? 'invalid_vehicle' : 'deal_unreadable',
    );
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(source === 'request' ? 'Vehicle year, make, model, and price are required.' : 'This deal could not be read.');
  }
  const record = value as Record<string, unknown>;
  const year = requiredInt(record.year, 1980, 2100);
  const make = requiredText(record.make, 40);
  const model = requiredText(record.model, 60);
  const price = requiredInt(record.price, 0, 10_000_000);
  if (year == null || make == null || model == null || price == null) {
    throw new ShopperDealError(
      source === 'request' ? 'Vehicle year, make, model, and price are required.' : 'This deal could not be read.',
      source === 'request' ? 400 : 500,
      source === 'request' ? 'invalid_vehicle' : 'deal_unreadable',
    );
  }

  const snapshot: VehicleSnapshot = { year, make, model, price };
  const trim = optionalText(record.trim, 60);
  const bodyType = optionalText(record.bodyType, 40);
  const city = optionalText(record.city, 80);
  const state = optionalText(record.state, 32);
  const vin = optionalVin(record.vin);
  const condition = optionalCondition(record.condition);
  const msrp = optionalInt(record.msrp, 0, 10_000_000);
  const miles = optionalInt(record.miles, 0, 2_000_000);
  const daysOnMarket = optionalInt(record.daysOnMarket, 0, 100_000);
  const latitude = optionalCoord(record.latitude, -90, 90);
  const longitude = optionalCoord(record.longitude, -180, 180);
  const thumbnailUrl = optionalHttpsUrl(record.thumbnailUrl);

  if (trim) snapshot.trim = trim;
  if (bodyType) snapshot.bodyType = bodyType;
  if (city) snapshot.city = city;
  if (state) snapshot.state = state;
  if (vin) snapshot.vin = vin;
  if (condition) snapshot.condition = condition;
  if (msrp != null) snapshot.msrp = msrp;
  if (miles != null) snapshot.miles = miles;
  if (daysOnMarket != null) snapshot.daysOnMarket = daysOnMarket;
  if (latitude != null) snapshot.latitude = latitude;
  if (longitude != null) snapshot.longitude = longitude;
  if (thumbnailUrl) snapshot.thumbnailUrl = thumbnailUrl;
  return snapshot;
}

function requiredInt(value: unknown, min: number, max: number): number | null {
  const parsed = optionalInt(value, min, max);
  return parsed == null ? null : parsed;
}

function optionalInt(value: unknown, min: number, max: number): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function requiredText(value: unknown, max: number): string | null {
  return optionalText(value, max);
}

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function optionalVin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const vin = value.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin) ? vin : null;
}

function optionalCondition(value: unknown): VehicleSnapshot['condition'] | null {
  if (value === 'new' || value === 'used' || value === 'certified') return value;
  return null;
}

function optionalCoord(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function optionalHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('https://') || trimmed.length > 500) return null;
  return trimmed;
}

function isStatus(value: string): value is ShopperDealStatus {
  return (SHOPPER_DEAL_STATUSES as readonly string[]).includes(value);
}

function assertNoDealerIdentity(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item) => assertNoDealerIdentity(item));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (DEALER_IDENTITY_KEYS.has(key.toLowerCase())) {
      throw new ShopperDealError('Dealer identity cannot be returned.', 500, 'dealer_identity_blocked');
    }
    assertNoDealerIdentity(child);
  }
}
