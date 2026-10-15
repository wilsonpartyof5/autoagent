import { redactShopperDealerIdentity } from './redact-dealer';
import { ShopperDealError, isShopperListingId } from './deals';

/**
 * A saved car stores the listing id and VIN only.
 * Price, photos, dealer, and specs are fetched live and are not written back.
 */
export const LISTING_DATA_MESSAGE =
  'Drevvy saves the listing id and VIN only. Price, photos, dealer, and specs are fetched live, which keeps the car a transparency check.';

const STORED_COLUMNS = ['user_id', 'listing_id', 'vin', 'saved_at', 'moved_to_deal_id'] as const;

const SAVE_KEYS = new Set(['listingId', 'vin', 'movedToDealId']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SavedCarRow = {
  userId: string;
  listingId: string;
  vin: string | null;
  savedAt: string;
  movedToDealId: string | null;
};

export type SaveCarInput = {
  listingId: string;
  vin?: string | null;
  movedToDealId?: string | null;
};

export type LiveListing = {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition?: string;
  price: number;
  msrp?: number;
  miles?: number;
  bodyType?: string;
  exteriorColor?: string;
  interiorColor?: string;
  drivetrain?: string;
  fuelType?: string;
  transmission?: string;
  engine?: string;
  cityMpg?: number;
  highwayMpg?: number;
  seatingCapacity?: number;
  powertrainType?: string;
  photoUrls?: string[];
  daysOnMarket?: number;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
};

export type SavedCarView = SavedCarRow & {
  listing: LiveListing | null;
};

export interface SavedCarRepository {
  list(userId: string): Promise<SavedCarRow[]>;
  find(userId: string, listingId: string): Promise<SavedCarRow | null>;
  save(row: SavedCarRow): Promise<SavedCarRow>;
  remove(userId: string, listingId: string): Promise<boolean>;
}

export type ListingLookup = (listingId: string, vin: string | null) => Promise<unknown | null>;

export type SavedCarDeps = {
  repo: SavedCarRepository;
  ownsDeal: (userId: string, dealId: string) => Promise<boolean>;
  lookup: ListingLookup;
  now: Date;
};

export function savedCarColumns(row: SavedCarRow): {
  user_id: string;
  listing_id: string;
  vin: string | null;
  saved_at: string;
  moved_to_deal_id: string | null;
} {
  return {
    user_id: row.userId,
    listing_id: row.listingId,
    vin: row.vin,
    saved_at: row.savedAt,
    moved_to_deal_id: row.movedToDealId,
  };
}

export function storedColumnNames(): readonly string[] {
  return STORED_COLUMNS;
}

export function readSaveCarInput(body: unknown): SaveCarInput {
  const record = objectBody(body);
  for (const key of Object.keys(record)) {
    if (!SAVE_KEYS.has(key)) {
      throw new ShopperDealError(LISTING_DATA_MESSAGE, 400, 'listing_data_rejected');
    }
  }
  if (!isShopperListingId(record.listingId)) {
    throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
  }
  const input: SaveCarInput = { listingId: record.listingId };
  if ('vin' in record) input.vin = parseVin(record.vin);
  if ('movedToDealId' in record) input.movedToDealId = parseDealId(record.movedToDealId);
  return input;
}

export async function listSavedCars(userId: string, deps: SavedCarDeps): Promise<SavedCarView[]> {
  const rows = await deps.repo.list(userId);
  return Promise.all(rows.map((row) => withLiveListing(row, deps.lookup)));
}

export async function saveSavedCar(userId: string, body: unknown, deps: SavedCarDeps): Promise<SavedCarView> {
  const input = readSaveCarInput(body);
  if (input.movedToDealId) {
    const owns = await deps.ownsDeal(userId, input.movedToDealId);
    if (!owns) throw new ShopperDealError('Deal not found.', 404, 'not_found');
  }
  const existing = await deps.repo.find(userId, input.listingId);
  const row: SavedCarRow = {
    userId,
    listingId: input.listingId,
    vin: input.vin === undefined ? existing?.vin ?? null : input.vin,
    savedAt: existing?.savedAt ?? deps.now.toISOString(),
    movedToDealId: input.movedToDealId === undefined ? existing?.movedToDealId ?? null : input.movedToDealId,
  };
  const saved = await deps.repo.save(row);
  return withLiveListing(saved, deps.lookup);
}

export async function deleteSavedCar(userId: string, listingId: string, deps: SavedCarDeps): Promise<{ listingId: string }> {
  if (!isShopperListingId(listingId)) {
    throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
  }
  const removed = await deps.repo.remove(userId, listingId);
  if (!removed) throw new ShopperDealError('Saved car not found.', 404, 'not_found');
  return { listingId };
}

export function toLiveListing(value: unknown): LiveListing | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const location = record.location && typeof record.location === 'object'
    ? record.location as Record<string, unknown>
    : {};
  const id = text(record.id);
  const year = integer(record.year);
  const make = text(record.make);
  const model = text(record.model);
  const price = integer(record.price);
  if (!id || year == null || !make || !model || price == null) return null;

  const listing: LiveListing = { id, year, make, model, price };
  const vin = text(record.vin);
  const trim = text(record.trim);
  const condition = text(record.condition);
  const msrp = integer(record.msrp);
  const miles = integer(record.miles);
  const bodyType = text(record.bodyType);
  const exteriorColor = text(record.exteriorColor);
  const interiorColor = text(record.interiorColor);
  const drivetrain = text(record.drivetrain);
  const fuelType = text(record.fuelType);
  const transmission = text(record.transmission);
  const engine = text(record.engine);
  const cityMpg = integer(record.cityMpg);
  const highwayMpg = integer(record.highwayMpg);
  const seatingCapacity = integer(record.seatingCapacity);
  const powertrainType = text(record.powertrainType);
  const daysOnMarket = integer(record.daysOnMarket);
  const city = text(location.dealerCity) ?? text(record.city);
  const state = text(location.dealerState) ?? text(record.state);
  const latitude = coordinate(location.latitude ?? record.latitude);
  const longitude = coordinate(location.longitude ?? record.longitude);
  const photoUrls = httpsUrls(record.photoUrls);

  if (vin) listing.vin = vin;
  if (trim) listing.trim = trim;
  if (condition) listing.condition = condition;
  if (msrp != null) listing.msrp = msrp;
  if (miles != null) listing.miles = miles;
  if (bodyType) listing.bodyType = bodyType;
  if (exteriorColor) listing.exteriorColor = exteriorColor;
  if (interiorColor) listing.interiorColor = interiorColor;
  if (drivetrain) listing.drivetrain = drivetrain;
  if (fuelType) listing.fuelType = fuelType;
  if (transmission) listing.transmission = transmission;
  if (engine) listing.engine = engine;
  if (cityMpg != null) listing.cityMpg = cityMpg;
  if (highwayMpg != null) listing.highwayMpg = highwayMpg;
  if (seatingCapacity != null) listing.seatingCapacity = seatingCapacity;
  if (powertrainType) listing.powertrainType = powertrainType;
  if (daysOnMarket != null) listing.daysOnMarket = daysOnMarket;
  if (city) listing.city = city;
  if (state) listing.state = state;
  if (latitude != null) listing.latitude = latitude;
  if (longitude != null) listing.longitude = longitude;
  if (photoUrls.length > 0) listing.photoUrls = photoUrls;
  return listing;
}

async function withLiveListing(row: SavedCarRow, lookup: ListingLookup): Promise<SavedCarView> {
  let listing: LiveListing | null = null;
  try {
    const raw = await lookup(row.listingId, row.vin);
    listing = raw ? toLiveListing(redactShopperDealerIdentity(raw)) : null;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'saved_car_live_lookup_failed',
      listingId: row.listingId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
  return { ...row, listing };
}

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ShopperDealError('Send a listing id.', 400, 'invalid_request');
  }
  return body as Record<string, unknown>;
}

function parseVin(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ShopperDealError('VIN must be 11 to 17 characters.', 400, 'invalid_vin');
  }
  const vin = value.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) {
    throw new ShopperDealError('VIN must be 11 to 17 characters.', 400, 'invalid_vin');
  }
  return vin;
}

function parseDealId(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ShopperDealError('Deal id is not valid.', 400, 'invalid_deal');
  }
  return value;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function integer(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function coordinate(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function httpsUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.startsWith('https://') && item.length <= 500)
    .slice(0, 20);
}
