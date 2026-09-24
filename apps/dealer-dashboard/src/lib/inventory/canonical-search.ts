import { randomUUID } from 'crypto';
import {
  buildSearchEvents,
  buildSearchStartedEvent,
  mergeAndRank,
  resolveInventoryMode,
  shouldQueryMarketCheck,
  shouldQueryUvs,
  type CanonicalListing,
  type InventoryMode,
  type RankCriteria,
  type SearchEventEnvelope,
} from '@autoagent/shared';

import {
  searchActiveCarsMcp,
  MarketCheckQuotaError,
  MarketCheckRateLimitError,
  type LiveSearchFilters,
  type LiveVehicle,
} from '@/lib/marketcheck/mcp-adapter';
import { createAdminClient } from '@/lib/supabase/admin';

export { MarketCheckQuotaError, MarketCheckRateLimitError };

export interface CanonicalSearchInput {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  filters?: LiveSearchFilters;
  rows?: number;
  start?: number;
  sessionId?: string;
  source: SearchEventEnvelope['source'];
}

export interface CanonicalSearchOutput {
  vehicles: LiveVehicle[];
  numFound: number;
  returned: number;
  start: number;
  rows: number;
  fromCache: boolean;
  latencyMs: number;
  coverage: {
    inventoryMode: InventoryMode;
    uvsCount: number;
    marketcheckCount: number;
    dedupedCount: number;
    drevvyDealerCount: number;
  };
}

interface UvsRow {
  id: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  condition: 'new' | 'used' | 'certified';
  price: number | string;
  msrp: number | string | null;
  miles: number | string | null;
  body_type: string | null;
  dealer_id: string | null;
  dealer_name: string | null;
  dealer_city: string | null;
  dealer_state: string | null;
  dealer_latitude: number | string | null;
  dealer_longitude: number | string | null;
  days_on_market: number | null;
  uvs_data: {
    media?: {
      primaryPhotoUrl?: string;
      thumbnailUrl?: string;
      photoUrls?: string[];
    };
  } | null;
}

interface Carrier extends LiveVehicle {
  dealerId?: string;
  daysOnMarket?: number;
  bodyStyle?: string;
  inventorySource: 'uvs' | 'marketcheck';
}

let dealerCache: { expiresAt: number; ids: Set<string>; dealershipIds: Map<string, string> } | null = null;

function currentMode(): InventoryMode {
  return resolveInventoryMode({
    inventoryMode: process.env.INVENTORY_MODE,
    legacyProvider: process.env.INVENTORY_SEARCH_PROVIDER,
  });
}

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function onboardedDealers(): Promise<{ ids: Set<string>; dealershipIds: Map<string, string> }> {
  const now = Date.now();
  if (dealerCache && dealerCache.expiresAt > now) return dealerCache;
  const ids = new Set<string>();
  const dealershipIds = new Map<string, string>();
  try {
    const supabase = createAdminClient();
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
  dealerCache = { expiresAt: now + 5 * 60 * 1000, ids, dealershipIds };
  return dealerCache;
}

async function queryUvs(input: CanonicalSearchInput, limit: number): Promise<Carrier[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from('uvs_vehicles')
    .select('id, vin, year, make, model, trim, condition, price, msrp, miles, body_type, dealer_id, dealer_name, dealer_city, dealer_state, dealer_latitude, dealer_longitude, days_on_market, uvs_data')
    .eq('availability_status', 'available');

  const filters = input.filters;
  if (filters?.make) query = query.ilike('make', filters.make);
  if (filters?.model) query = query.ilike('model', filters.model);
  if (filters?.year) query = query.eq('year', filters.year);
  if (filters?.minYear) query = query.gte('year', filters.minYear);
  if (filters?.maxYear) query = query.lte('year', filters.maxYear);
  if (filters?.minPrice !== undefined) query = query.gte('price', filters.minPrice);
  if (filters?.maxPrice !== undefined) query = query.lte('price', filters.maxPrice);
  if (filters?.maxMiles !== undefined) query = query.lte('miles', filters.maxMiles);
  if (filters?.condition) query = query.eq('condition', filters.condition);
  if (filters?.bodyType) query = query.ilike('body_type', filters.bodyType);

  const { data, error } = await query.limit(limit);
  if (error) throw new Error(error.message);

  return ((data ?? []) as UvsRow[]).flatMap((row) => {
    const latitude = numberOrUndefined(row.dealer_latitude);
    const longitude = numberOrUndefined(row.dealer_longitude);
    if (latitude === undefined || longitude === undefined) return [];
    const price = numberOrUndefined(row.price);
    if (price === undefined) return [];
    const photos = row.uvs_data?.media?.photoUrls?.filter((url) => typeof url === 'string') ?? [];
    return [{
      id: row.id,
      vin: row.vin ?? undefined,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim ?? undefined,
      condition: row.condition,
      price,
      msrp: numberOrUndefined(row.msrp),
      miles: numberOrUndefined(row.miles),
      bodyType: row.body_type ?? undefined,
      thumbnailUrl: row.uvs_data?.media?.thumbnailUrl,
      primaryPhotoUrl: row.uvs_data?.media?.primaryPhotoUrl ?? photos[0],
      photoUrls: photos.length ? photos : undefined,
      location: {
        latitude,
        longitude,
        dealerName: row.dealer_name ?? 'Unknown Dealer',
        dealerCity: row.dealer_city ?? undefined,
        dealerState: row.dealer_state ?? undefined,
      },
      dealerId: row.dealer_id ?? undefined,
      daysOnMarket: row.days_on_market ?? undefined,
      bodyStyle: row.body_type ?? undefined,
      inventorySource: 'uvs' as const,
    }];
  });
}

function toCanonical(vehicle: Carrier): CanonicalListing {
  return {
    listingId: vehicle.id,
    vin: vehicle.vin,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    price: vehicle.price,
    mileage: vehicle.miles,
    dealerId: vehicle.dealerId,
    dealerName: vehicle.location.dealerName,
    latitude: vehicle.location.latitude,
    longitude: vehicle.location.longitude,
    daysOnMarket: vehicle.daysOnMarket,
    bodyStyle: vehicle.bodyStyle ?? vehicle.bodyType,
    inventorySource: vehicle.inventorySource,
    drevvyDealer: false,
  };
}

function criteriaFrom(input: CanonicalSearchInput): RankCriteria {
  return {
    make: input.filters?.make,
    model: input.filters?.model,
    year: input.filters?.year,
    minYear: input.filters?.minYear,
    maxYear: input.filters?.maxYear,
    minPrice: input.filters?.minPrice,
    maxPrice: input.filters?.maxPrice,
    maxMiles: input.filters?.maxMiles,
    bodyStyle: input.filters?.bodyType,
    radiusMiles: input.radiusMiles,
    origin: { latitude: input.latitude, longitude: input.longitude },
  };
}

async function recordEvents(events: SearchEventEnvelope[]): Promise<void> {
  if (!events.length) return;
  try {
    const supabase = createAdminClient();
    const sessionId = events[0]?.session_id;
    if (!sessionId) return;
    const { error: sessionError } = await supabase.from('app_sessions').upsert(
      {
        id: sessionId,
        provider: 'canonical_search',
        last_activity_at: events[0]?.occurred_at,
        result_count: events.find((event) => event.event_name === 'search_completed')?.properties.returned_count ?? null,
      },
      { onConflict: 'id' },
    );
    if (sessionError) throw sessionError;
    const rows = events.map((event) => ({
      flow_id: sessionId,
      event_name: event.event_name,
      source: event.source === 'mcp' ? 'mcp-server' : 'dashboard',
      provider: 'canonical_search',
      vehicle_id: event.listing_id,
      vin: event.vin,
      dealer_id: null,
      result_count: typeof event.properties.returned_count === 'number' ? event.properties.returned_count : null,
      payload: {
        ...event.properties,
        event_source: event.source,
        dealership_id: event.dealership_id,
        listing_id: event.listing_id,
        session_id: event.session_id,
      },
      occurred_at: event.occurred_at,
    }));
    const { error } = await supabase.from('app_events').insert(rows);
    if (error) throw error;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'canonical_search_events_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
}

export async function searchCanonicalInventory(input: CanonicalSearchInput): Promise<CanonicalSearchOutput> {
  const started = Date.now();
  const mode = currentMode();
  const rows = input.rows ?? 25;
  const start = input.start ?? 0;
  const poolLimit = start + rows;
  const sessionId = input.sessionId || randomUUID();
  const criteria = criteriaFrom(input);
  const dealers = await onboardedDealers();

  await recordEvents([
    buildSearchStartedEvent({
      sessionId,
      source: input.source,
      inventoryMode: mode,
      criteria,
    }),
  ]);

  let uvs: Carrier[] = [];
  let marketcheck: Carrier[] = [];
  let marketcheckFound = 0;
  let fromCache = false;
  let uvsError: Error | undefined;
  let marketcheckError: unknown;

  if (shouldQueryUvs(mode)) {
    try {
      uvs = await queryUvs(input, Math.max(poolLimit, 50));
    } catch (error) {
      uvsError = error instanceof Error ? error : new Error('UVS search failed');
      console.warn(JSON.stringify({ event: 'canonical_search_uvs_failed', message: uvsError.message }));
    }
  }

  if (shouldQueryMarketCheck(mode, uvs.length)) {
    try {
      const live = await searchActiveCarsMcp({
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMiles: input.radiusMiles,
        filters: input.filters,
        rows: Math.max(poolLimit, 25),
        start: 0,
      });
      fromCache = live.fromCache;
      marketcheckFound = live.numFound;
      marketcheck = live.vehicles.map((vehicle) => ({
        ...vehicle,
        inventorySource: 'marketcheck' as const,
        dealerId: vehicle.dealerId,
        daysOnMarket: vehicle.daysOnMarket,
        bodyStyle: vehicle.bodyType,
      }));
    } catch (error) {
      marketcheckError = error;
      console.warn(JSON.stringify({
        event: 'canonical_search_marketcheck_failed',
        message: error instanceof Error ? error.message : 'unknown',
      }));
    }
  }

  if (!uvs.length && !marketcheck.length) {
    if (marketcheckError instanceof MarketCheckQuotaError || marketcheckError instanceof MarketCheckRateLimitError) {
      throw marketcheckError;
    }
    if (uvsError && marketcheckError) {
      throw uvsError;
    }
    if (marketcheckError instanceof Error && !uvsError) throw marketcheckError;
    if (uvsError && mode === 'uvs_only') throw uvsError;
  }

  const ranked = mergeAndRank({
    uvs: uvs.map(toCanonical),
    marketcheck: marketcheck.map(toCanonical),
    criteria,
    limit: Math.min(Math.max(poolLimit, 50), 100),
    inventoryMode: mode,
    onboardedDealerIds: dealers.ids,
  });

  const byKey = new Map<string, Carrier>();
  for (const vehicle of [...uvs, ...marketcheck]) {
    byKey.set(`${vehicle.inventorySource}:${vehicle.id}`, vehicle);
  }
  const ordered = ranked.listings.flatMap((listing) => {
    const vehicle = byKey.get(`${listing.inventorySource}:${listing.listingId}`);
    return vehicle ? [vehicle] : [];
  });
  const page = ordered.slice(start, start + rows).map(({ dealerId: _dealerId, daysOnMarket: _days, bodyStyle: _body, inventorySource: _source, ...vehicle }) => vehicle);

  const events = buildSearchEvents({
    sessionId,
    source: input.source,
    inventoryMode: mode,
    criteria,
    stats: ranked.stats,
    listings: ranked.listings.slice(start, start + rows),
    dealershipIdByDealerId: dealers.dealershipIds,
  });
  await recordEvents(events);

  return {
    vehicles: page,
    numFound: marketcheckFound > 0
      ? Math.max(marketcheckFound - ranked.stats.dedupedCount + ranked.listings.filter((listing) => listing.inventorySource === 'uvs').length, page.length)
      : Math.max(ranked.listings.length, page.length),
    returned: page.length,
    start,
    rows,
    fromCache,
    latencyMs: Date.now() - started,
    coverage: {
      inventoryMode: ranked.stats.inventoryMode,
      uvsCount: ranked.stats.uvsCount,
      marketcheckCount: ranked.stats.marketcheckCount,
      dedupedCount: ranked.stats.dedupedCount,
      drevvyDealerCount: ranked.stats.drevvyDealerCount,
    },
  };
}
