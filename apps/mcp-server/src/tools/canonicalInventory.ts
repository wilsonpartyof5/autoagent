import {
  UVS_PREFERRED_MIN_RESULTS,
  buildSearchEvents,
  buildSearchStartedEvent,
  distanceMiles,
  mergeAndRank,
  resolveInventoryMode,
  shouldQueryMarketCheck,
  type CanonicalListing,
  type InventoryMode,
  type RankCriteria,
} from '@autoagent/shared';
import type { SearchParams, UnifiedVehicle } from '@autoagent/shared';
import { createClient } from '@supabase/supabase-js';

import { CONFIG } from '../config/env.js';
import { searchUVSVehicles, type UVSSearchParams } from '../db/uvs-vehicles.js';
import { recordFlowEvent } from '../lib/flowTelemetry.js';

let dealerCache: { expiresAt: number; ids: Set<string>; dealershipIds: Map<string, string> } | null = null;

export function currentInventoryMode(): InventoryMode {
  return resolveInventoryMode({
    inventoryMode: CONFIG.inventoryMode || null,
    legacyProvider: CONFIG.inventorySearchProvider,
  });
}

function uvsParams(searchParams: SearchParams): UVSSearchParams {
  return {
    make: searchParams.make,
    model: searchParams.model,
    maxPrice: searchParams.maxPrice,
    condition: searchParams.condition,
    maxMiles: searchParams.mileageMax,
    bodyStyle: searchParams.bodyStyle,
    radiusMiles: searchParams.radiusMiles,
    limit: 50,
    offset: 0,
  };
}

function criteriaFrom(searchParams: SearchParams, origin?: { latitude: number; longitude: number }): RankCriteria {
  return {
    make: searchParams.make,
    model: searchParams.model,
    maxPrice: searchParams.maxPrice,
    maxMiles: searchParams.mileageMax,
    bodyStyle: searchParams.bodyStyle,
    radiusMiles: searchParams.radiusMiles,
    origin,
  };
}

function toCanonical(vehicle: UnifiedVehicle, source: 'uvs' | 'marketcheck'): CanonicalListing {
  return {
    listingId: vehicle.id,
    vin: vehicle.baseIdentity?.vin,
    year: vehicle.baseIdentity?.year,
    make: vehicle.baseIdentity?.make,
    model: vehicle.baseIdentity?.model,
    trim: vehicle.baseIdentity?.trim,
    price: vehicle.pricing?.price,
    mileage: vehicle.coreSpecs?.miles,
    dealerId: vehicle.location?.dealer?.dealerId,
    dealerName: vehicle.location?.dealer?.name,
    latitude: vehicle.location?.dealer?.latitude,
    longitude: vehicle.location?.dealer?.longitude,
    daysOnMarket: vehicle.availability?.daysOnMarket,
    bodyStyle: vehicle.coreSpecs?.bodyType,
    inventorySource: source,
    drevvyDealer: false,
    lastUpdatedAt: vehicle.operational?.lastSyncedAt,
  };
}

async function onboardedDealers(): Promise<{ ids: Set<string>; dealershipIds: Map<string, string> }> {
  const now = Date.now();
  if (dealerCache && dealerCache.expiresAt > now) return dealerCache;
  const ids = new Set<string>();
  const dealershipIds = new Map<string, string>();
  if (CONFIG.supabaseUrl && CONFIG.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await supabase
        .from('dealerships')
        .select('id, marketcheck_dealer_id')
        .not('marketcheck_dealer_id', 'is', null);
      if (error) throw error;
      for (const row of data ?? []) {
        if (typeof row.marketcheck_dealer_id === 'string' && row.marketcheck_dealer_id) {
          ids.add(row.marketcheck_dealer_id);
          if (typeof row.id === 'string') dealershipIds.set(row.marketcheck_dealer_id, row.id);
        }
      }
    } catch (error) {
      console.warn(JSON.stringify({
        event: 'canonical_search_dealers_unavailable',
        message: error instanceof Error ? error.message : 'unknown',
      }));
    }
  }
  dealerCache = { expiresAt: now + 5 * 60 * 1000, ids, dealershipIds };
  return dealerCache;
}

export async function uvsCoverageIsSufficient(
  searchParams: SearchParams,
  origin?: { latitude: number; longitude: number },
): Promise<boolean> {
  const result = await searchUVSVehicles(uvsParams(searchParams));
  const radius = searchParams.radiusMiles;
  const nearby = result.vehicles.filter((vehicle) => {
    if (!origin || radius === undefined) return true;
    const latitude = vehicle.location?.dealer?.latitude;
    const longitude = vehicle.location?.dealer?.longitude;
    if (latitude === undefined || longitude === undefined) return false;
    return distanceMiles(origin.latitude, origin.longitude, latitude, longitude) <= radius;
  });
  return nearby.length >= UVS_PREFERRED_MIN_RESULTS;
}

export async function rankFetchedVehicles(input: {
  uvs: UnifiedVehicle[];
  marketcheck: UnifiedVehicle[];
  searchParams: SearchParams;
  origin?: { latitude: number; longitude: number };
  limit: number;
  sessionId: string;
}): Promise<{ vehicles: UnifiedVehicle[]; stats: ReturnType<typeof mergeAndRank>['stats'] }> {
  const mode = currentInventoryMode();
  const uvs = input.uvs;
  const dealers = await onboardedDealers();
  const ranked = mergeAndRank({
    uvs: uvs.map((vehicle) => toCanonical(vehicle, 'uvs')),
    marketcheck: input.marketcheck.map((vehicle) => toCanonical(vehicle, 'marketcheck')),
    criteria: criteriaFrom(input.searchParams, input.origin),
    limit: input.limit,
    inventoryMode: mode,
    onboardedDealerIds: dealers.ids,
  });

  const uvsById = new Map(uvs.map((vehicle) => [vehicle.id, vehicle]));
  const marketcheckById = new Map(input.marketcheck.map((vehicle) => [vehicle.id, vehicle]));
  const vehicles = ranked.listings.flatMap((listing) => {
    const vehicle = listing.inventorySource === 'uvs'
      ? uvsById.get(listing.listingId)
      : marketcheckById.get(listing.listingId);
    return vehicle ? [vehicle] : [];
  });

  const events = [
    buildSearchStartedEvent({
      sessionId: input.sessionId,
      source: 'mcp',
      inventoryMode: mode,
      criteria: criteriaFrom(input.searchParams, input.origin),
    }),
    ...buildSearchEvents({
      sessionId: input.sessionId,
      source: 'mcp',
      inventoryMode: mode,
      criteria: criteriaFrom(input.searchParams, input.origin),
      stats: ranked.stats,
      listings: ranked.listings,
      dealershipIdByDealerId: dealers.dealershipIds,
    }),
  ];

  await Promise.all(events.map((event) => recordFlowEvent({
    flowId: input.sessionId,
    eventName: event.event_name,
    source: 'mcp-server',
    provider: 'canonical_search',
    vehicleId: event.listing_id ?? undefined,
    vin: event.vin ?? undefined,
    resultCount: typeof event.properties.returned_count === 'number' ? event.properties.returned_count : undefined,
    payload: {
      ...event.properties,
      event_source: event.source,
      dealership_id: event.dealership_id,
      listing_id: event.listing_id,
    },
  })));

  return { vehicles, stats: ranked.stats };
}

export async function mergeMarketcheckWithUvs(input: {
  marketcheck: UnifiedVehicle[];
  searchParams: SearchParams;
  origin?: { latitude: number; longitude: number };
  limit: number;
  sessionId: string;
}): Promise<{ vehicles: UnifiedVehicle[]; stats: ReturnType<typeof mergeAndRank>['stats'] }> {
  let uvs: UnifiedVehicle[] = [];
  try {
    const db = await searchUVSVehicles(uvsParams(input.searchParams));
    uvs = db.vehicles;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'canonical_search_uvs_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
  return rankFetchedVehicles({ ...input, uvs });
}

export function shouldSkipMarketCheck(mode: InventoryMode, uvsCount: number): boolean {
  return !shouldQueryMarketCheck(mode, uvsCount);
}
