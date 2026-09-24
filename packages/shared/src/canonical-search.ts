/**
 * Canonical inventory search.
 *
 * Both the dealer-dashboard HTTP API and the MCP server call this module
 * after they fetch listings. Ranking lives here, not in iOS or ChatGPT.
 * A future search index can replace the fetchers; this function stays the seam.
 */

export type InventoryMode = 'hybrid' | 'uvs_preferred' | 'uvs_only';

export type InventorySource = 'uvs' | 'marketcheck';

/** UVS rows required before uvs_preferred skips MarketCheck. */
export const UVS_PREFERRED_MIN_RESULTS = 8;

export interface CanonicalListing {
  listingId: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  dealerId?: string;
  dealerName?: string;
  latitude?: number;
  longitude?: number;
  daysOnMarket?: number;
  bodyStyle?: string;
  inventorySource: InventorySource;
  drevvyDealer: boolean;
  lastUpdatedAt?: string;
}

export interface RankCriteria {
  make?: string;
  model?: string;
  year?: number;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxMiles?: number;
  bodyStyle?: string;
  radiusMiles?: number;
  origin?: {
    latitude: number;
    longitude: number;
  };
}

export interface MergeStats {
  inventoryMode: InventoryMode;
  uvsCount: number;
  marketcheckCount: number;
  dedupedCount: number;
  drevvyDealerCount: number;
  returnedCount: number;
}

export interface SearchEventEnvelope {
  event_id: string;
  event_name: 'search_started' | 'search_completed' | 'inventory_impression';
  occurred_at: string;
  session_id: string | null;
  conversation_id: null;
  negotiation_case_id: null;
  consumer_user_id: null;
  dealership_id: string | null;
  listing_id: string | null;
  vin: string | null;
  source: 'consumer_ios' | 'dealer_ios' | 'dealer_dashboard' | 'mcp' | 'agent' | 'backend';
  properties: Record<string, unknown>;
}

const PII_KEYS = new Set([
  'email',
  'phone',
  'phoneNumber',
  'address',
  'street',
  'name',
  'firstName',
  'lastName',
  'fullName',
]);

export function resolveInventoryMode(input: {
  inventoryMode?: string | null;
  legacyProvider?: string | null;
}): InventoryMode {
  const explicit = input.inventoryMode?.trim().toLowerCase();
  if (explicit) {
    if (explicit === 'hybrid' || explicit === 'uvs_preferred' || explicit === 'uvs_only') {
      return explicit;
    }
    throw new Error(`INVENTORY_MODE must be hybrid, uvs_preferred, or uvs_only. Received: ${input.inventoryMode}`);
  }
  if (input.legacyProvider === 'uvs') return 'uvs_only';
  return 'hybrid';
}

export function shouldQueryUvs(mode: InventoryMode): boolean {
  return mode === 'hybrid' || mode === 'uvs_preferred' || mode === 'uvs_only';
}

export function shouldQueryMarketCheck(mode: InventoryMode, uvsCount: number, minimumResults = UVS_PREFERRED_MIN_RESULTS): boolean {
  if (mode === 'uvs_only') return false;
  if (mode === 'hybrid') return true;
  return uvsCount < minimumResults;
}

export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sameText(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function normalizeVin(vin?: string): string | undefined {
  const trimmed = vin?.trim().toUpperCase();
  return trimmed ? trimmed : undefined;
}

function meetsHardRequirements(listing: CanonicalListing, criteria: RankCriteria): boolean {
  if (criteria.make && !sameText(listing.make, criteria.make)) return false;
  if (criteria.model && !sameText(listing.model, criteria.model)) return false;
  if (criteria.year !== undefined && listing.year !== criteria.year) return false;
  if (criteria.minYear !== undefined && listing.year < criteria.minYear) return false;
  if (criteria.maxYear !== undefined && listing.year > criteria.maxYear) return false;
  if (criteria.minPrice !== undefined && listing.price < criteria.minPrice) return false;
  if (criteria.maxPrice !== undefined && listing.price > criteria.maxPrice) return false;
  if (criteria.maxMiles !== undefined && listing.mileage !== undefined && listing.mileage > criteria.maxMiles) return false;
  if (criteria.bodyStyle && listing.bodyStyle && !sameText(listing.bodyStyle, criteria.bodyStyle)) return false;

  if (
    criteria.origin
    && criteria.radiusMiles !== undefined
    && listing.latitude !== undefined
    && listing.longitude !== undefined
  ) {
    const miles = distanceMiles(
      criteria.origin.latitude,
      criteria.origin.longitude,
      listing.latitude,
      listing.longitude,
    );
    if (miles > criteria.radiusMiles) return false;
  }

  return true;
}

function relevanceScore(listing: CanonicalListing, criteria: RankCriteria): number {
  let weight = 0;
  let earned = 0;
  const add = (matched: boolean) => {
    weight += 1;
    if (matched) earned += 1;
  };
  if (criteria.make) add(sameText(listing.make, criteria.make));
  if (criteria.model) add(sameText(listing.model, criteria.model));
  if (criteria.year !== undefined) add(listing.year === criteria.year);
  else if (criteria.minYear !== undefined || criteria.maxYear !== undefined) {
    const min = criteria.minYear ?? 0;
    const max = criteria.maxYear ?? 9999;
    add(listing.year >= min && listing.year <= max);
  }
  if (weight === 0) return 1;
  return earned / weight;
}

function secondaryScore(listing: CanonicalListing, criteria: RankCriteria): number {
  let quality = 0.5;
  if (criteria.maxPrice !== undefined && criteria.maxPrice > 0) {
    quality = 1 - Math.min(listing.price / criteria.maxPrice, 1);
  } else if (listing.price > 0) {
    quality = 1 / (1 + listing.price / 50000);
  }

  let distance = 0.5;
  if (
    criteria.origin
    && listing.latitude !== undefined
    && listing.longitude !== undefined
  ) {
    const miles = distanceMiles(
      criteria.origin.latitude,
      criteria.origin.longitude,
      listing.latitude,
      listing.longitude,
    );
    const radius = criteria.radiusMiles && criteria.radiusMiles > 0 ? criteria.radiusMiles : 100;
    distance = 1 - Math.min(miles / radius, 1);
  }

  let freshness = 0.5;
  if (listing.daysOnMarket !== undefined && listing.daysOnMarket >= 0) {
    freshness = 1 - Math.min(listing.daysOnMarket / 90, 1);
  }

  return (0.4 * quality) + (0.35 * distance) + (0.25 * freshness);
}

export function mergeAndRank(input: {
  uvs: CanonicalListing[];
  marketcheck: CanonicalListing[];
  criteria: RankCriteria;
  limit: number;
  inventoryMode: InventoryMode;
  onboardedDealerIds?: ReadonlySet<string>;
}): { listings: CanonicalListing[]; stats: MergeStats } {
  const onboarded = input.onboardedDealerIds ?? new Set<string>();
  const mark = (listing: CanonicalListing): CanonicalListing => ({
    ...listing,
    vin: normalizeVin(listing.vin),
    drevvyDealer: listing.dealerId ? onboarded.has(listing.dealerId) : listing.drevvyDealer,
  });

  const uvs = input.uvs.map(mark);
  const marketcheck = input.marketcheck.map(mark);
  const byVin = new Map<string, CanonicalListing>();
  const withoutVin: CanonicalListing[] = [];
  let dedupedCount = 0;

  for (const listing of uvs) {
    if (!listing.vin) {
      withoutVin.push(listing);
      continue;
    }
    byVin.set(listing.vin, listing);
  }

  for (const listing of marketcheck) {
    if (!listing.vin) {
      withoutVin.push(listing);
      continue;
    }
    const existing = byVin.get(listing.vin);
    if (!existing) {
      byVin.set(listing.vin, listing);
      continue;
    }
    dedupedCount += 1;
    if (existing.inventorySource !== 'uvs') {
      byVin.set(listing.vin, listing.inventorySource === 'uvs' ? listing : existing);
    }
  }

  const eligible = [...byVin.values(), ...withoutVin].filter((listing) => meetsHardRequirements(listing, input.criteria));
  const scored = eligible.map((listing) => ({
    listing,
    relevance: relevanceScore(listing, input.criteria),
    secondary: secondaryScore(listing, input.criteria),
  }));

  scored.sort((left, right) => {
    if (right.relevance !== left.relevance) return right.relevance - left.relevance;
    const leftBoost = left.listing.drevvyDealer ? 0.03 : 0;
    const rightBoost = right.listing.drevvyDealer ? 0.03 : 0;
    return (right.secondary + rightBoost) - (left.secondary + leftBoost);
  });

  const listings = scored.slice(0, Math.max(input.limit, 0)).map((item) => item.listing);
  return {
    listings,
    stats: {
      inventoryMode: input.inventoryMode,
      uvsCount: uvs.length,
      marketcheckCount: marketcheck.length,
      dedupedCount,
      drevvyDealerCount: listings.filter((listing) => listing.drevvyDealer).length,
      returnedCount: listings.length,
    },
  };
}

function stripPii(properties: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (PII_KEYS.has(key)) continue;
    if (typeof value === 'string' && /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(value)) continue;
    clean[key] = value;
  }
  return clean;
}

export function buildSearchEvents(input: {
  sessionId: string;
  source: SearchEventEnvelope['source'];
  inventoryMode: InventoryMode;
  criteria: RankCriteria;
  stats: MergeStats;
  listings: CanonicalListing[];
  dealershipIdByDealerId?: ReadonlyMap<string, string>;
  now?: Date;
  eventId?: (name: string, index: number) => string;
}): SearchEventEnvelope[] {
  const occurredAt = (input.now ?? new Date()).toISOString();
  const idFor = input.eventId ?? ((name, index) => `${input.sessionId}:${name}:${index}`);
  const base = {
    occurred_at: occurredAt,
    session_id: input.sessionId,
    conversation_id: null,
    negotiation_case_id: null,
    consumer_user_id: null,
    source: input.source,
  } as const;

  const completed: SearchEventEnvelope = {
    ...base,
    event_id: idFor('search_completed', 0),
    event_name: 'search_completed',
    dealership_id: null,
    listing_id: null,
    vin: null,
    properties: stripPii({
      inventory_mode: input.stats.inventoryMode,
      uvs_count: input.stats.uvsCount,
      marketcheck_count: input.stats.marketcheckCount,
      deduped_count: input.stats.dedupedCount,
      drevvy_dealer_count: input.stats.drevvyDealerCount,
      returned_count: input.stats.returnedCount,
      make: input.criteria.make ?? null,
      model: input.criteria.model ?? null,
      radius_miles: input.criteria.radiusMiles ?? null,
    }),
  };

  const impressions: SearchEventEnvelope[] = input.listings.map((listing, index) => ({
    ...base,
    event_id: idFor('inventory_impression', index),
    event_name: 'inventory_impression',
    dealership_id: listing.dealerId ? input.dealershipIdByDealerId?.get(listing.dealerId) ?? null : null,
    listing_id: listing.listingId,
    vin: listing.vin ?? null,
    properties: stripPii({
      rank: index + 1,
      inventory_source: listing.inventorySource,
      drevvy_dealer: listing.drevvyDealer,
      price: listing.price,
      mileage: listing.mileage ?? null,
      days_on_market: listing.daysOnMarket ?? null,
    }),
  }));

  return [completed, ...impressions];
}

export function buildSearchStartedEvent(input: {
  sessionId: string;
  source: SearchEventEnvelope['source'];
  inventoryMode: InventoryMode;
  criteria: RankCriteria;
  now?: Date;
  eventId?: string;
}): SearchEventEnvelope {
  return {
    event_id: input.eventId ?? `${input.sessionId}:search_started:0`,
    event_name: 'search_started',
    occurred_at: (input.now ?? new Date()).toISOString(),
    session_id: input.sessionId,
    conversation_id: null,
    negotiation_case_id: null,
    consumer_user_id: null,
    dealership_id: null,
    listing_id: null,
    vin: null,
    source: input.source,
    properties: stripPii({
      inventory_mode: input.inventoryMode,
      make: input.criteria.make ?? null,
      model: input.criteria.model ?? null,
      radius_miles: input.criteria.radiusMiles ?? null,
    }),
  };
}
