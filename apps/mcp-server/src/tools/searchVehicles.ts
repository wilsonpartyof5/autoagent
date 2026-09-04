import { SearchParamsSchema, type SearchParams } from '@autoagent/shared';
import { safeParse } from '../lib/z.js';
import { searchCache } from '../lib/cache.js';
import { randomUUID } from 'crypto';
import { validateToolResult } from '../lib/responseShape.js';
import { CONFIG } from '../config/env.js';
import { searchUVSVehicles, type UVSDealerSummary, type UVSSearchParams } from '../db/uvs-vehicles.js';
import type { UnifiedVehicle } from '@autoagent/shared';
import { trackEvent } from '../lib/analytics/tracking.js';
import { generateRequestId } from '@autoagent/shared';
import { callMarketcheckMcpTool, type UpstreamCallResult } from '../services/marketcheckMcpClient.js';
import { normalizeMarketcheckSearchResult } from '../services/marketcheckMcpNormalizer.js';
import { signSearchResult } from '../lib/searchResultToken.js';
import { recordFlowEvent } from '../lib/flowTelemetry.js';
import type { ToolContext } from '../mcp-simple.js';
import { getOpenAiWidgetCspMeta } from '../mcp-simple.js';
import {
  decodeProxiedVehicleImageSource,
  fetchVehicleImageDataUrl,
} from '../app/vehicle-image.js';
import { rememberVehicleDetails } from '../lib/vehicleDetailCache.js';
import {
  buildEmptyState,
  buildReadableSearchContent,
  coerceSearchInput,
  relatedModelsFor,
  requestedModels,
  type SearchEmptyState,
  type SearchRelaxation,
} from './searchRelaxation.js';

// Removed createMockVehicles - no longer needed, DB provides real data


/**
 * Generate cache key from search parameters
 */
function generateCacheKey(params: SearchParams): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key as keyof SearchParams];
      return acc;
    }, {} as Record<string, unknown>);
  
  return JSON.stringify(sortedParams);
}

/**
 * Enrich vehicle with map pin and featured card data
 */
function enrichVehicleForStructuredContent(vehicle: UnifiedVehicle | Record<string, unknown>): Record<string, unknown> {
  // Type guard: check if vehicle is UnifiedVehicle
  const isUnifiedVehicle = vehicle && typeof vehicle === 'object' && 'baseIdentity' in vehicle && 'pricing' in vehicle;
  const v = isUnifiedVehicle ? vehicle as UnifiedVehicle : null;
  
  const lat = v?.location?.dealer?.latitude;
  const lng = v?.location?.dealer?.longitude;
  const price = v?.pricing?.price;
  const photoUrl = v?.media?.primaryPhotoUrl || 
                   v?.media?.photoUrls?.[0] || 
                   v?.media?.thumbnailUrl ||
                   v?.media?.images?.[0]?.url;
  const year = v?.baseIdentity?.year;
  const make = v?.baseIdentity?.make;
  const model = v?.baseIdentity?.model;
  const trim = v?.baseIdentity?.trim;
  const title = trim 
    ? `${year} ${make} ${model} ${trim}`.trim()
    : `${year} ${make} ${model}`.trim();
  const dealerName = v?.location?.dealer?.name;
  
  return {
    ...(vehicle as Record<string, unknown>),
    ...(lat !== undefined && { lat }),
    ...(lng !== undefined && { lng }),
    ...(price !== undefined && { price }),
    ...(photoUrl !== undefined && { photoUrl, image: photoUrl }), // Alias for photoUrl
    ...(title && { title }),
    ...(dealerName !== undefined && { dealerName }),
  };
}

function compactVehicleForWidget(vehicle: UnifiedVehicle | Record<string, unknown>): Record<string, unknown> {
  const enriched = enrichVehicleForStructuredContent(vehicle);
  const source = vehicle as Record<string, unknown>;

  const baseIdentity = (source.baseIdentity as Record<string, unknown> | undefined) ?? {};
  const pricing = (source.pricing as Record<string, unknown> | undefined) ?? {};
  const location = (source.location as Record<string, unknown> | undefined) ?? {};
  const dealer = (location.dealer as Record<string, unknown> | undefined) ?? {};
  const coreSpecs = (source.coreSpecs as Record<string, unknown> | undefined) ?? {};
  const media = (source.media as Record<string, unknown> | undefined) ?? {};
  const detail = (source.detail as Record<string, unknown> | undefined) ?? {};

  const year = (baseIdentity.year as number | undefined) ?? (source.year as number | undefined);
  const make = (baseIdentity.make as string | undefined) ?? (source.make as string | undefined);
  const model = (baseIdentity.model as string | undefined) ?? (source.model as string | undefined);
  const trim = (baseIdentity.trim as string | undefined) ?? (source.trim as string | undefined);
  const vin = (baseIdentity.vin as string | undefined) ?? (source.vin as string | undefined);
  const price = (pricing.price as number | undefined) ?? (enriched.price as number | undefined);
  const msrp = pricing.msrp as number | undefined;
  const currency = (pricing.currency as string | undefined) ?? 'USD';
  const rawMiles = coreSpecs.miles
    ?? coreSpecs.odometer
    ?? coreSpecs.mileage
    ?? source.miles
    ?? source.mileage
    ?? source.odometer
    ?? detail.miles
    ?? detail.mileage
    ?? detail.odometer;
  const miles = typeof rawMiles === 'number'
    ? rawMiles
    : typeof rawMiles === 'string' && rawMiles.trim() !== ''
      ? Number(rawMiles.replace(/,/g, ''))
      : undefined;
  const title = (enriched.title as string | undefined) ?? [year, make, model].filter(Boolean).join(' ');
  const photoUrl = (enriched.photoUrl as string | undefined)
    ?? (media.primaryPhotoUrl as string | undefined)
    ?? (source.imageUrl as string | undefined);

  const latitude = (dealer.latitude as number | undefined) ?? (enriched.lat as number | undefined);
  const longitude = (dealer.longitude as number | undefined) ?? (enriched.lng as number | undefined);
  const dealerName = (dealer.name as string | undefined) ?? (enriched.dealerName as string | undefined);
  const condition = typeof source.condition === 'string' ? source.condition : undefined;
  const dealerId = typeof dealer.dealerId === 'string' ? dealer.dealerId : undefined;
  const dealerCity = typeof dealer.city === 'string' ? dealer.city : undefined;
  const dealerState = typeof dealer.state === 'string' ? dealer.state : undefined;
  const dealerDistanceMiles = typeof dealer.distanceMiles === 'number' ? dealer.distanceMiles : undefined;
  const searchResultToken = typeof source.searchResultToken === 'string' ? source.searchResultToken : undefined;
  const flowId = typeof source.flowId === 'string' ? source.flowId : undefined;
  const dealerDefined = (source.dealerDefined as Record<string, unknown> | undefined) ?? {};
  const vdpUrl = typeof dealerDefined.vdpUrl === 'string' ? dealerDefined.vdpUrl : undefined;
  const detailLoaded = source.detailLoaded === true;
  const photoUrls = Array.isArray(media.photoUrls)
    ? media.photoUrls.filter((url): url is string => typeof url === 'string')
    : photoUrl
      ? [photoUrl]
      : [];

  return {
    id: source.id,
    title,
    ...(price !== undefined && { price }),
    ...(miles !== undefined && { miles }),
    ...(photoUrl && { photoUrl, image: photoUrl }),
    ...(latitude !== undefined && { lat: latitude }),
    ...(longitude !== undefined && { lng: longitude }),
    ...(dealerName && { dealerName }),
    ...(condition && { condition }),
    ...(searchResultToken && { searchResultToken }),
    ...(flowId && { flowId }),
    ...(vdpUrl && { vdpUrl }),
    ...(detailLoaded && { detailLoaded: true }),
    baseIdentity: {
      ...(year !== undefined && { year }),
      ...(make && { make }),
      ...(model && { model }),
      ...(trim && { trim }),
      ...(vin && { vin }),
    },
    pricing: {
      ...(price !== undefined && { price }),
      ...(msrp !== undefined && { msrp }),
      currency,
    },
    coreSpecs: {
      ...coreSpecs,
      ...(miles !== undefined && { miles }),
    },
    media: {
      ...(photoUrl && { primaryPhotoUrl: photoUrl }),
      ...(photoUrls.length > 0 && { photoUrls }),
    },
    location: {
      dealer: {
        ...dealer,
        ...(dealerName && { name: dealerName }),
        ...(dealerId && { dealerId }),
        ...(dealerCity && { city: dealerCity }),
        ...(dealerState && { state: dealerState }),
        ...(dealerDistanceMiles !== undefined && { distanceMiles: dealerDistanceMiles }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
      },
    },
  };
}

type SearchVehiclesData = {
  content: { type: string; text: string; }[];
  vehicles?: unknown[];
  dealerSummary?: UVSDealerSummary[];
  totalCount?: number;
  searchParams?: unknown;
  structuredContent?: unknown;
  _meta?: Record<string, unknown>;
  dataSource?: 'marketcheck_mcp' | 'uvs_cache' | 'uvs_db';
  inventoryProvider?: 'marketcheck' | 'uvs';
  normalizedAs?: 'uvs';
};
type SourceInfo = {
  dataSource: 'marketcheck_mcp' | 'uvs_cache' | 'uvs_db';
  inventoryProvider: 'marketcheck' | 'uvs';
  normalizedAs: 'uvs';
};
const RAIL_CARD_LIMIT = 8;
const MAX_MAP_PINS = 80;
const MAX_WIDGET_RESULTS = MAX_MAP_PINS;
const MAX_SUMMARY_LISTINGS = 3;

function buildDealerSummary(vehicles: Array<Record<string, unknown>>): UVSDealerSummary[] {
  const dealers = new Map<string, UVSDealerSummary>();
  for (const vehicle of vehicles) {
    const location = vehicle.location as { dealer?: Record<string, unknown> } | undefined;
    const pricing = vehicle.pricing as { price?: unknown } | undefined;
    const dealer = location?.dealer || {};
    const dealerId = typeof dealer.dealerId === 'string' ? dealer.dealerId : undefined;
    const dealerName = typeof dealer.name === 'string'
      ? dealer.name
      : typeof vehicle.dealerName === 'string'
        ? vehicle.dealerName
        : 'Unknown Dealer';
    const key = `${dealerId || ''}|${dealerName}`;
    const price = typeof vehicle.price === 'number'
      ? vehicle.price
      : typeof pricing?.price === 'number'
        ? pricing.price
        : undefined;
    const existing = dealers.get(key);
    if (existing) {
      existing.count += 1;
      if (price !== undefined) {
        existing.minPrice = existing.minPrice === undefined ? price : Math.min(existing.minPrice, price);
      }
      continue;
    }
    dealers.set(key, {
      dealerId,
      dealerName,
      city: typeof dealer.city === 'string' ? dealer.city : undefined,
      state: typeof dealer.state === 'string' ? dealer.state : undefined,
      count: 1,
      minPrice: price,
      lat: typeof dealer.latitude === 'number' ? dealer.latitude : typeof vehicle.lat === 'number' ? vehicle.lat : undefined,
      lng: typeof dealer.longitude === 'number' ? dealer.longitude : typeof vehicle.lng === 'number' ? vehicle.lng : undefined,
      dataSources: [],
    });
  }
  return Array.from(dealers.values()).sort((a, b) => b.count - a.count);
}

function balanceVehiclesByDealer<T extends Record<string, unknown>>(vehicles: T[], maxVehicles = MAX_WIDGET_RESULTS): T[] {
  const buckets = new Map<string, T[]>();
  for (const vehicle of vehicles) {
    const location = vehicle.location as { dealer?: Record<string, unknown> } | undefined;
    const dealer = location?.dealer || {};
    const dealerId = typeof dealer.dealerId === 'string' ? dealer.dealerId : '';
    const dealerName = typeof dealer.name === 'string'
      ? dealer.name
      : typeof vehicle.dealerName === 'string'
        ? vehicle.dealerName
        : 'Unknown Dealer';
    const key = `${dealerId}|${dealerName}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(vehicle);
  }
  const bucketList = Array.from(buckets.values()).sort((a, b) => b.length - a.length);
  const balanced: T[] = [];
  let index = 0;
  while (balanced.length < maxVehicles && bucketList.some(bucket => bucket[index])) {
    for (const bucket of bucketList) {
      if (balanced.length >= maxVehicles) break;
      if (bucket[index]) balanced.push(bucket[index]);
    }
    index += 1;
  }
  return balanced;
}

function summarizeVehicleLine(vehicle: unknown): string {
  const v = vehicle as Record<string, unknown> & {
    title?: string;
    price?: number;
    miles?: number;
    dealerName?: string;
    vin?: string;
    baseIdentity?: { year?: number; make?: string; model?: string; vin?: string };
    pricing?: { price?: number };
    coreSpecs?: { miles?: number };
    location?: { dealer?: { name?: string } };
  };

  const title = v.title
    || [v.baseIdentity?.year, v.baseIdentity?.make, v.baseIdentity?.model].filter(Boolean).join(' ')
    || 'Vehicle';
  const price = typeof v.price === 'number' ? v.price : v.pricing?.price;
  const miles = typeof v.miles === 'number' ? v.miles : v.coreSpecs?.miles;
  const dealerName = v.dealerName || v.location?.dealer?.name;
  const vin = v.baseIdentity?.vin || v.vin;

  const parts = [
    title,
    typeof price === 'number' ? `$${price.toLocaleString()}` : undefined,
    typeof miles === 'number' ? `${Math.round(miles).toLocaleString()} mi` : undefined,
    dealerName ? `at ${dealerName}` : undefined,
    vin ? `VIN ${String(vin).slice(-6)}` : undefined,
  ].filter(Boolean);

  return `- ${parts.join(' • ')}`;
}

function resolveInlinePhotoSource(photoUrl: string): string | null {
  if (!photoUrl || photoUrl.startsWith('data:')) return null;
  if (photoUrl.includes('/vehicle-image?')) {
    return decodeProxiedVehicleImageSource(photoUrl);
  }
  if (photoUrl.startsWith('https://')) return photoUrl;
  return null;
}

async function inlineWidgetPrimaryPhotos(
  vehicles: Array<Record<string, unknown>>,
): Promise<{ inlined: number; failed: number }> {
  let inlined = 0;
  let failed = 0;
  await Promise.all(vehicles.map(async (vehicle) => {
    const media = (vehicle.media as Record<string, unknown> | undefined) ?? {};
    const photoUrl = (media.primaryPhotoUrl as string | undefined)
      ?? (vehicle.photoUrl as string | undefined)
      ?? (vehicle.image as string | undefined);
    const sourceUrl = photoUrl ? resolveInlinePhotoSource(photoUrl) : null;
    if (!sourceUrl) {
      if (photoUrl && !photoUrl.startsWith('data:')) failed += 1;
      return;
    }
    const dataUrl = await fetchVehicleImageDataUrl(sourceUrl);
    if (!dataUrl) {
      failed += 1;
      return;
    }
    inlined += 1;
    vehicle.photoUrl = dataUrl;
    vehicle.image = dataUrl;
    vehicle.media = {
      ...media,
      primaryPhotoUrl: dataUrl,
      photoUrls: Array.isArray(media.photoUrls) && media.photoUrls.length
        ? [dataUrl, ...(media.photoUrls as string[]).slice(1)]
        : [dataUrl],
    };
  }));
  return { inlined, failed };
}

function buildReadableContent(
  totalCount: number,
  vehicles: unknown[],
  location?: string,
  emptyState?: SearchEmptyState,
  relaxations: SearchRelaxation[] = [],
): { type: string; text: string }[] {
  const base = buildReadableSearchContent(totalCount, vehicles, location, emptyState, relaxations);
  if (!vehicles.length || totalCount === 0) return base;
  const topLines = vehicles.slice(0, MAX_SUMMARY_LISTINGS).map((vehicle) => summarizeVehicleLine(vehicle));
  const header = base[0]?.text ?? `Found ${totalCount} vehicles${location ? ` near ${location}` : ''}.`;
  return [{ type: 'text', text: `${header}\nTop matches:\n${topLines.join('\n')}` }];
}

const KNOWN_CITY_STATES: Record<string, string> = {
  denver: 'CO',
  seattle: 'WA',
  portland: 'OR',
  austin: 'TX',
  dallas: 'TX',
  houston: 'TX',
  phoenix: 'AZ',
  atlanta: 'GA',
  chicago: 'IL',
  miami: 'FL',
  'los angeles': 'CA',
  'san francisco': 'CA',
  'san diego': 'CA',
  'new york': 'NY',
  boston: 'MA',
  'charlotte': 'NC',
  raleigh: 'NC',
  'rock hill': 'SC',
};

/** Map model-supplied body styles onto MarketCheck body_type values. */
export function normalizeBodyType(bodyStyle?: string): string | undefined {
  if (!bodyStyle) return undefined;
  const raw = bodyStyle.trim().toLowerCase();
  if (!raw) return undefined;
  // MarketCheck's canonical body_type facet is "Pickup"; "Truck" returns no matches.
  if (/(pickup|pick-up|pick up|truck|crew cab|supercrew)/.test(raw)) return 'Pickup';
  if (/(suv|crossover|cuv)/.test(raw)) return 'SUV';
  if (/(sedan|saloon)/.test(raw)) return 'Sedan';
  if (/coupe/.test(raw)) return 'Coupe';
  if (/(hatch|hatchback)/.test(raw)) return 'Hatchback';
  if (/wagon/.test(raw)) return 'Wagon';
  if (/(van|minivan)/.test(raw)) return 'Van';
  if (/(convertible|cabriolet)/.test(raw)) return 'Convertible';
  // Unknown free-text body styles (e.g. "F-150", "electric") zero out MarketCheck.
  return undefined;
}

/** Normalize free-form locations like "denver metro area" into MarketCheck city/state/zip. */
export function resolveBridgeLocation(searchParams: SearchParams): Record<string, unknown> {
  if (searchParams.latitude !== undefined && searchParams.longitude !== undefined) {
    return { latitude: searchParams.latitude, longitude: searchParams.longitude };
  }

  const location = (searchParams.location || '').trim();
  if (!location) return {};

  const zipMatch = location.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) return { zip: zipMatch[1] };

  const cityStateMatch = location.match(/^(.+?),\s*([A-Za-z]{2})\b/);
  if (cityStateMatch) {
    return { city: cityStateMatch[1].trim(), state: cityStateMatch[2].toUpperCase() };
  }

  const cleaned = location
    .replace(/\b(metro(?:\s+area)?|area|greater|downtown)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const state = KNOWN_CITY_STATES[cleaned];
  if (state) {
    return {
      city: cleaned.replace(/\b\w/g, (c) => c.toUpperCase()),
      state,
    };
  }

  // Last resort: pass city token so MarketCheck still has a place hint.
  if (cleaned.length >= 3) {
    return { city: cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) };
  }
  return {};
}

export function mapSearchParamsToBridgeArgs(searchParams: SearchParams): Record<string, unknown> {
  const bodyType = normalizeBodyType(searchParams.bodyStyle);
  return {
    ...resolveBridgeLocation(searchParams),
    car_type: searchParams.condition,
    price_range: searchParams.maxPrice ? `0-${Math.floor(searchParams.maxPrice)}` : undefined,
    make: searchParams.make,
    model: searchParams.model,
    radius: Math.round(searchParams.radiusMiles ?? 50),
    ...(bodyType ? { body_type: bodyType } : {}),
    miles_range: searchParams.mileageMax ? `0-${Math.floor(searchParams.mileageMax)}` : undefined,
    rows: MAX_MAP_PINS,
    start: searchParams.pageOffset ?? 0,
    fetch_all_photos: false,
    include_dealer_object: true,
    include_mc_dealership_object: true,
    include_build_object: true,
  };
}

async function normalizeBridgeSearchResult(
  upstreamResult: unknown,
  searchParams: SearchParams,
  runId: string,
  sourceInfo: SourceInfo,
  options?: {
    relaxations?: SearchRelaxation[];
    emptyState?: SearchEmptyState;
    originalParams?: SearchParams;
  },
): Promise<SearchVehiclesData> {
  const bridge = upstreamResult as {
    content?: unknown;
    structuredContent?: unknown;
    vehicles?: unknown[];
    dealerSummary?: UVSDealerSummary[];
    totalCount?: number;
  };

  const structuredContent = bridge.structuredContent as
    | { results?: { vehicles?: unknown[]; totalCount?: number; searchParams?: unknown } }
    | undefined;
  const structuredResults = structuredContent?.results;
  const rawVehicles = Array.isArray(structuredResults?.vehicles)
    ? structuredResults.vehicles
    : Array.isArray(bridge.vehicles)
      ? bridge.vehicles
      : [];
  const totalCount = typeof structuredResults?.totalCount === 'number'
    ? structuredResults.totalCount
    : typeof bridge.totalCount === 'number'
      ? bridge.totalCount
      : rawVehicles.length;
  // Map gets a dense pin set; carousel photos stay limited to the first 8 cards.
  const compactVehicles = rawVehicles
    .slice(0, MAX_MAP_PINS)
    .map((vehicle) => compactVehicleForWidget(vehicle as UnifiedVehicle | Record<string, unknown>));
  const vehicles = balanceVehiclesByDealer(compactVehicles, MAX_MAP_PINS);
  const inlineStats = await inlineWidgetPrimaryPhotos(vehicles.slice(0, RAIL_CARD_LIMIT));
  rememberVehicleDetails(vehicles);
  if (inlineStats.inlined || inlineStats.failed) {
    console.log(JSON.stringify({
      event: 'widget_images_inlined',
      flowId: runId,
      inlined: inlineStats.inlined,
      failed: inlineStats.failed,
      vehicleCount: vehicles.length,
    }));
  }
  const dealerSummary = buildDealerSummary(compactVehicles);
  const relaxations = options?.relaxations ?? [];
  const emptyState = options?.emptyState
    ?? (totalCount === 0
      ? buildEmptyState({
          originalParams: options?.originalParams ?? searchParams,
          effectiveParams: searchParams,
          relaxations,
        })
      : undefined);

  const content = buildReadableContent(totalCount, vehicles, searchParams.location, emptyState, relaxations);
  const resultsPayload = {
    vehicles,
    dealerSummary,
    totalCount,
    searchParams: structuredResults?.searchParams ?? searchParams,
    dataSource: sourceInfo.dataSource,
    inventoryProvider: sourceInfo.inventoryProvider,
    normalizedAs: sourceInfo.normalizedAs,
    ...(relaxations.length ? { relaxations } : {}),
    ...(emptyState ? { emptyState } : {}),
    ...(options?.originalParams ? { originalSearchParams: options.originalParams } : {}),
  };

  return {
    content,
    vehicles,
    dealerSummary,
    totalCount,
    searchParams,
    structuredContent: {
      results: resultsPayload,
    },
    _meta: {
      results: resultsPayload,
      ...getOpenAiWidgetCspMeta(),
    },
    ...sourceInfo,
  };
}


/**
 * Search for vehicles using UVS database (replaces MarketCheck API)
 */
export async function searchVehicles(
  params: unknown,
  context?: ToolContext
): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    vehicles?: unknown[];
    dealerSummary?: UVSDealerSummary[];
    totalCount?: number;
    searchParams?: unknown;
    structuredContent?: unknown;
    _meta?: Record<string, unknown>;
    dataSource?: 'marketcheck_mcp' | 'uvs_cache' | 'uvs_db';
    inventoryProvider?: 'marketcheck' | 'uvs';
    normalizedAs?: 'uvs';
  };
  error?: string;
}> {
  const startTime = Date.now();
  const enrichedMetadata: Array<{
    sellerComments?: string;
    optionPackages?: Array<{ name?: string; code?: string; description?: string }>;
  }> = [];
  
  try {
    const mutableParams: Record<string, unknown> | undefined = (params && typeof params === 'object')
      ? { ...(params as Record<string, unknown>) }
      : undefined;
    const contextLocation = context?.userLocation
      ? [context.userLocation.city, context.userLocation.region].filter(Boolean).join(', ')
      : undefined;
    if (mutableParams) {
      if (!mutableParams.location && contextLocation) {
        mutableParams.location = contextLocation;
      }
      if (!mutableParams.condition) {
        mutableParams.condition = 'used';
      }
    }

    // Validate input parameters (normalize multi-model strings first)
    const coercedParams = mutableParams
      ? coerceSearchInput(mutableParams)
      : coerceSearchInput((params && typeof params === 'object') ? { ...(params as Record<string, unknown>) } : {});
    const parseResult = safeParse(SearchParamsSchema, coercedParams);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid search parameters: ${parseResult.error}`,
      };
    }

    const originalParams: SearchParams = parseResult.data!;
    let searchParams: SearchParams = { ...originalParams };
    const cacheKey = generateCacheKey(searchParams);
    // Use single requestId for entire request to maintain correlation
    const requestId = generateRequestId(); // Used as sessionId for request correlation - reused for all events in this request

    if (CONFIG.inventorySearchProvider === 'marketcheck_mcp') {
      const runId = randomUUID();
      const relaxations: SearchRelaxation[] = [];
      const models = requestedModels(searchParams);

      type ActiveSearch = {
        params: SearchParams;
        args: Record<string, unknown>;
        call: UpstreamCallResult;
        merged?: {
          vehicles: UnifiedVehicle[];
          totalCount: number;
          rejectedCount: number;
        };
      };

      const countFromCall = (call: UpstreamCallResult) => (
        call.success ? normalizeMarketcheckSearchResult(call.result).totalCount : -1
      );
      const activeCount = (item: ActiveSearch) => (
        typeof item.merged?.totalCount === 'number' ? item.merged.totalCount : countFromCall(item.call)
      );

      const searchOne = async (params: SearchParams): Promise<ActiveSearch> => {
        const args = mapSearchParamsToBridgeArgs(params);
        console.log(JSON.stringify({
          event: 'search_bridge_args',
          flowId: runId,
          requestId,
          bridgeArgs: args,
          searchParams: params,
        }));
        return {
          params,
          args,
          call: await callMarketcheckMcpTool('search_active_cars', args, requestId),
        };
      };

      const searchModels = async (params: SearchParams, modelList: string[]): Promise<ActiveSearch> => {
        if (modelList.length <= 1) {
          return searchOne({
            ...params,
            model: modelList[0] || params.model,
            models: modelList.length ? modelList : params.models,
          });
        }
        const fanout = await Promise.all(
          modelList.map((model) => searchOne({ ...params, model, models: modelList })),
        );
        const successful = fanout.filter((item) => item.call.success);
        if (!successful.length) return fanout[0];

        const mergedVehicles: UnifiedVehicle[] = [];
        const seen = new Set<string>();
        let totalCount = 0;
        let rejectedCount = 0;
        let latencyMs = 0;
        for (const item of successful) {
          if (!item.call.success) continue;
          const normalized = normalizeMarketcheckSearchResult(item.call.result);
          totalCount += normalized.totalCount;
          rejectedCount += normalized.rejectedCount;
          latencyMs = Math.max(latencyMs, item.call.latencyMs ?? 0);
          for (const vehicle of normalized.vehicles) {
            const key = vehicle.id || vehicle.baseIdentity?.vin || JSON.stringify(vehicle.baseIdentity);
            if (seen.has(key)) continue;
            seen.add(key);
            mergedVehicles.push(vehicle);
          }
        }
        const best = successful.find((item) => countFromCall(item.call) > 0) ?? successful[0];
        if (!best.call.success) return best;
        return {
          params: { ...params, model: modelList[0], models: modelList },
          args: best.args,
          call: {
            success: true,
            result: best.call.result,
            correlationId: best.call.correlationId,
            upstreamRequestId: best.call.upstreamRequestId,
            status: best.call.status,
            latencyMs,
          },
          merged: {
            vehicles: mergedVehicles,
            totalCount,
            rejectedCount,
          },
        };
      };

      let active = await searchModels(searchParams, models.length ? models : (searchParams.model ? [searchParams.model] : []));
      let bridgeArgs = active.args;
      let bridgeCall = active.call;

      // ChatGPT often invents a bodyStyle that MarketCheck rejects (0 hits). Retry once without it.
      if (bridgeCall.success && bridgeArgs.body_type && activeCount(active) === 0) {
        const dropped = String(bridgeArgs.body_type);
        const retryParams = { ...active.params, bodyStyle: undefined };
        console.warn(JSON.stringify({
          event: 'search_bridge_retry_without_body_type',
          flowId: runId,
          requestId,
          droppedBodyType: dropped,
        }));
        active = await searchModels(retryParams, requestedModels(retryParams));
        if (active.call.success) {
          relaxations.push({ step: 'drop_body_type', detail: `Removed body style filter (${dropped})` });
          searchParams = retryParams;
          bridgeArgs = active.args;
          bridgeCall = active.call;
        }
      }

      // Drop max price when inventory is empty under a tight budget.
      if (bridgeCall.success && activeCount(active) === 0 && searchParams.maxPrice) {
        const droppedPrice = searchParams.maxPrice;
        const retryParams = { ...searchParams, maxPrice: undefined };
        console.warn(JSON.stringify({
          event: 'search_bridge_retry_without_max_price',
          flowId: runId,
          requestId,
          droppedMaxPrice: droppedPrice,
        }));
        active = await searchModels(retryParams, requestedModels(retryParams));
        if (active.call.success) {
          relaxations.push({ step: 'drop_max_price', detail: `Removed max price filter ($${Math.floor(droppedPrice).toLocaleString('en-US')})` });
          searchParams = retryParams;
          bridgeArgs = active.args;
          bridgeCall = active.call;
        }
      }

      // Widen radius stepwise when still empty.
      if (bridgeCall.success && activeCount(active) === 0) {
        const currentRadius = Math.round(searchParams.radiusMiles ?? Number(bridgeArgs.radius) ?? 50);
        for (const nextRadius of [150, 250].filter((radius) => radius > currentRadius)) {
          const retryParams = { ...searchParams, radiusMiles: nextRadius };
          console.warn(JSON.stringify({
            event: 'search_bridge_retry_widen_radius',
            flowId: runId,
            requestId,
            fromRadius: currentRadius,
            toRadius: nextRadius,
          }));
          active = await searchModels(retryParams, requestedModels(retryParams));
          if (!active.call.success) break;
          searchParams = retryParams;
          bridgeArgs = active.args;
          bridgeCall = active.call;
          if (activeCount(active) > 0) {
            relaxations.push({ step: 'widen_radius', detail: `Expanded radius from ${currentRadius} to ${nextRadius} miles` });
            break;
          }
          relaxations.push({ step: 'widen_radius', detail: `Expanded radius to ${nextRadius} miles (still no matches)` });
        }
      }

      // Try related models when a single model still returns nothing.
      if (bridgeCall.success && activeCount(active) === 0) {
        const primary = requestedModels(searchParams)[0] || searchParams.model;
        const related = relatedModelsFor(primary).filter((model) => !requestedModels(searchParams).some((item) => item.toLowerCase() === model.toLowerCase()));
        if (primary && related.length) {
          const retryModels = [primary, ...related].slice(0, 4);
          console.warn(JSON.stringify({
            event: 'search_bridge_retry_related_models',
            flowId: runId,
            requestId,
            fromModel: primary,
            toModels: retryModels,
          }));
          const retryParams = { ...searchParams, model: primary, models: retryModels };
          active = await searchModels(retryParams, retryModels);
          if (active.call.success) {
            relaxations.push({ step: 'related_models', detail: `Also searched related models (${related.join(', ')})` });
            searchParams = retryParams;
            bridgeArgs = active.args;
            bridgeCall = active.call;
          }
        }
      }

      // Last resort: make-only search in the widened area.
      if (bridgeCall.success && activeCount(active) === 0 && searchParams.make && (searchParams.model || requestedModels(searchParams).length)) {
        const retryParams = { ...searchParams, model: undefined, models: undefined };
        console.warn(JSON.stringify({
          event: 'search_bridge_retry_make_only',
          flowId: runId,
          requestId,
          make: searchParams.make,
        }));
        active = await searchOne(retryParams);
        if (active.call.success) {
          relaxations.push({ step: 'make_only', detail: `Broadened to all ${searchParams.make} models` });
          searchParams = retryParams;
          bridgeArgs = active.args;
          bridgeCall = active.call;
        }
      }

      if (!bridgeCall.success) {
        console.error(JSON.stringify({
          event: 'search_bridge_failed',
          requestId,
          correlationId: bridgeCall.correlationId,
          upstreamRequestId: bridgeCall.upstreamRequestId,
          status: bridgeCall.status,
          latencyMs: bridgeCall.latencyMs,
          errorCode: bridgeCall.errorCode,
          error: bridgeCall.error,
        }));
        console.warn(JSON.stringify({
          event: 'search_provider_fallback',
          flowId: runId,
          requestId,
          from: 'marketcheck_mcp',
          to: 'uvs',
          errorCode: bridgeCall.errorCode,
        }));
        recordFlowEvent({
          flowId: runId,
          eventName: 'search.fallback',
          source: 'mcp-server',
          provider: 'marketcheck_mcp',
          requestId,
          toolName: 'search_active_cars',
          status: 'fallback',
          errorCode: bridgeCall.errorCode,
          durationMs: bridgeCall.latencyMs,
          searchLocation: searchParams.location,
        }).catch(() => {});
      } else {
        const marketcheck = active.merged ?? normalizeMarketcheckSearchResult(bridgeCall.result);
        const signedVehicles = marketcheck.vehicles.map((vehicle) => {
          const dealer = vehicle.location.dealer;
          const vin = vehicle.baseIdentity.vin;
          const dealerId = dealer.dealerId;
          const leadSnapshot = {
            id: vehicle.id,
            baseIdentity: vehicle.baseIdentity,
            condition: vehicle.condition,
            pricing: vehicle.pricing,
            coreSpecs: vehicle.coreSpecs,
            media: { primaryPhotoUrl: vehicle.media?.primaryPhotoUrl },
            location: vehicle.location,
            dealerDefined: vehicle.dealerDefined,
          };
          return {
            ...vehicle,
            flowId: runId,
            detailLoaded: true,
            ...(vin && dealerId
              ? {
                  searchResultToken: signSearchResult({
                    listingId: vehicle.baseIdentity.listingId ?? vehicle.id,
                    vin,
                    dealerId,
                    dealerName: dealer.name,
                    price: vehicle.pricing.price,
                    currency: vehicle.pricing.currency ?? 'USD',
                    provider: 'marketcheck_mcp',
                    flowId: runId,
                    vehicle: leadSnapshot as unknown as Record<string, unknown>,
                  }),
                }
              : {}),
          };
        });
        const sourceInfo: SourceInfo = {
          dataSource: 'marketcheck_mcp',
          inventoryProvider: 'marketcheck',
          normalizedAs: 'uvs',
        };
        const emptyState = marketcheck.totalCount === 0
          ? buildEmptyState({
              originalParams,
              effectiveParams: searchParams,
              relaxations,
            })
          : undefined;
        const normalized = await normalizeBridgeSearchResult(
          { vehicles: signedVehicles, totalCount: marketcheck.totalCount },
          searchParams,
          runId,
          sourceInfo,
          {
            relaxations,
            emptyState,
            originalParams,
          },
        );
        console.log(JSON.stringify({
          event: 'search_bridge_success',
          flowId: runId,
          requestId,
          correlationId: bridgeCall.correlationId,
          upstreamRequestId: bridgeCall.upstreamRequestId,
          status: bridgeCall.status,
          latencyMs: bridgeCall.latencyMs,
          resultsCount: marketcheck.totalCount,
          normalizedCount: marketcheck.vehicles.length,
          rejectedCount: marketcheck.rejectedCount,
          relaxations,
          empty: marketcheck.totalCount === 0,
        }));
        validateToolResult(normalized);
        recordFlowEvent({
          flowId: runId,
          eventName: marketcheck.totalCount === 0 ? 'search.empty' : 'search.succeeded',
          source: 'mcp-server',
          provider: 'marketcheck_mcp',
          requestId,
          toolName: 'search_active_cars',
          status: marketcheck.totalCount === 0 ? 'empty' : 'success',
          durationMs: bridgeCall.latencyMs,
          resultCount: marketcheck.totalCount,
          searchLocation: searchParams.location,
          payload: {
            normalizedCount: marketcheck.vehicles.length,
            rejectedCount: marketcheck.rejectedCount,
            relaxations,
          },
        }).catch(() => {});
        trackEvent('inventory.search', {
          make: searchParams.make,
          model: searchParams.model,
          condition: searchParams.condition as 'new' | 'used' | 'certified' | undefined,
          priceMax: searchParams.maxPrice,
          location: searchParams.location,
          resultsCount: normalized.totalCount ?? 0,
          searchDuration: Date.now() - startTime,
        }, {
          requestId,
          sessionId: runId,
        }).catch(() => {});
        return { success: true, data: normalized };
      }
    }
    
    // Check cache first
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({
        event: 'search',
        source: 'cache',
        fromCache: true,
        results: cachedResult.vehicles.length,
        ms: duration,
      }));

      // Track cached search event
      trackEvent('inventory.search', {
        make: searchParams.make,
        model: searchParams.model,
        condition: searchParams.condition as 'new' | 'used' | 'certified' | undefined,
        priceMin: undefined, // SearchParams only has maxPrice, not minPrice
        priceMax: searchParams.maxPrice,
        location: searchParams.location,
        resultsCount: cachedResult.totalCount,
        searchDuration: duration,
      }, {
        // Note: SearchParams doesn't include dealerId - get from vehicle if needed
        requestId,
        sessionId: requestId, // Use requestId as sessionId for request-level correlation
      }).catch(() => {
        // Tracking failures should not break the request
      });

      const runId = randomUUID();
      console.log(JSON.stringify({ evt:'diag.tool', runId, ts:Date.now() }));

      // Enrich cached vehicles with map pin and featured card data
      const compactCachedVehicles = (cachedResult.vehicles as UnifiedVehicle[]).map(vehicle => 
        compactVehicleForWidget(vehicle)
      );
      const enrichedCachedVehicles = balanceVehiclesByDealer(compactCachedVehicles, MAX_WIDGET_RESULTS);
      const dealerSummary = buildDealerSummary(compactCachedVehicles);
      const sourceInfo: SourceInfo = {
        dataSource: 'uvs_cache',
        inventoryProvider: 'uvs',
        normalizedAs: 'uvs',
      };
      
      return {
        success: true,
        data: {
          content: buildReadableContent(cachedResult.totalCount, enrichedCachedVehicles, searchParams.location),
          vehicles: enrichedCachedVehicles,
          dealerSummary,
          totalCount: cachedResult.totalCount,
          searchParams,
          structuredContent: {
            results: { vehicles: enrichedCachedVehicles, dealerSummary, totalCount: cachedResult.totalCount, searchParams, ...sourceInfo }
          },
          _meta: {
            results: { vehicles: enrichedCachedVehicles, dealerSummary, totalCount: cachedResult.totalCount, searchParams, ...sourceInfo },
          },
          ...sourceInfo,
        },
      };
    }

    // Query UVS vehicles from database instead of MarketCheck API
    let vehicles: UnifiedVehicle[] = [];
    let totalCount = 0;
    let dealerSummary: UVSDealerSummary[] = [];
    const fromCache = false;

    try {
      // Map SearchParams to UVSSearchParams
      const uvsSearchParams: UVSSearchParams = {
        make: searchParams.make,
        model: searchParams.model,
        condition: searchParams.condition, // SearchParams.condition is 'new' | 'used'
        maxPrice: searchParams.maxPrice,
        // Do not force used inventory to have miles > 0 because many feeds provide 0/NULL miles.
        minMiles: undefined,
        maxMiles: searchParams.mileageMax,
        bodyStyle: searchParams.bodyStyle,
        // Note: SearchParams doesn't have dealerId/dealerName, but UVSSearchParams does (optional)
        limit: 500,
        offset: 0,
      };

      // Query UVS vehicles from database
      const searchStart = Date.now();
      const dbResult = await searchUVSVehicles(uvsSearchParams);

      const searchDuration = Date.now() - searchStart;
      console.log(JSON.stringify({
        event: 'uvs_db_search',
        duration: searchDuration,
        success: true,
        results: dbResult.vehicles.length,
        totalCount: dbResult.total,
        params: uvsSearchParams,
      }));

      vehicles = dbResult.vehicles;
      totalCount = dbResult.total;
      dealerSummary = dbResult.dealerSummary;
      
      // Track vehicle.view for each vehicle returned in search results
      vehicles.forEach((vehicle) => {
        const vehicleId = vehicle.id;
        const vin = vehicle.baseIdentity?.vin;
        // Track vehicle view event (async, don't block)
        // Note: dealerId from vehicle location, not searchParams
        const dealerId = vehicle.location?.dealer?.dealerId;
        if (vehicleId && dealerId) {
          trackEvent('vehicle.view', {
            vehicleId,
            vin: vin || undefined,
            year: vehicle.baseIdentity?.year,
            make: vehicle.baseIdentity?.make,
            model: vehicle.baseIdentity?.model,
            price: vehicle.pricing?.price,
            source: 'search_results',
          }, {
            dealerId,
            vehicleId,
            vin: vin || undefined,
            requestId,
            sessionId: requestId, // Use requestId as sessionId for correlation
          }).catch(() => {
            // Tracking failures should not break the request
          });
        }
      });
      
      // Extract enriched metadata from UVS vehicles if available
      vehicles.forEach((vehicle, index) => {
        const enrichment = vehicle.enrichment;
        if (enrichment?.providerSpecific) {
          const providerData = enrichment.providerSpecific as unknown as Record<string, unknown>;
          const marketcheck = providerData.marketcheck as unknown as Record<string, unknown> | undefined;
          if (marketcheck && typeof marketcheck === 'object' && 'extra' in marketcheck) {
            const extra = marketcheck.extra as unknown as Record<string, unknown> | undefined;
            if (extra && typeof extra === 'object') {
              enrichedMetadata[index] = {
                sellerComments: extra.seller_comments as string | undefined,
                optionPackages: extra.options as Array<{ name?: string; code?: string; description?: string }> | undefined,
              };
            }
          }
        }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({
        event: 'uvs_db_search_failed',
        error: errorMsg,
        params: searchParams,
      }));
      
      // Fallback: return empty results rather than failing
      // In production, this should be handled more gracefully
      vehicles = [];
      totalCount = 0;
    }

    // Cache the result
    const result = { vehicles, totalCount };
    searchCache.set(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'search',
      source: 'uvs_db',
      fromCache,
      results: vehicles.length,
      totalCount,
      ms: duration,
    }));

    // Track search event (reuse requestId from start of function)
    trackEvent('inventory.search', {
      make: searchParams.make,
      model: searchParams.model,
      condition: searchParams.condition as 'new' | 'used' | 'certified' | undefined,
      priceMin: undefined, // SearchParams only has maxPrice, not minPrice
      priceMax: searchParams.maxPrice,
      location: searchParams.location,
      resultsCount: totalCount,
      searchDuration: duration,
    }, {
      // Note: SearchParams doesn't include dealerId - omit from tracking
      requestId,
      sessionId: requestId, // Use requestId as sessionId for request-level correlation
    }).catch(() => {
      // Tracking failures should not break the request
    });

    const runId = randomUUID();
    console.log(JSON.stringify({ evt:'diag.tool', runId, ts:Date.now() }));
    const sourceInfo: SourceInfo = {
      dataSource: 'uvs_db',
      inventoryProvider: 'uvs',
      normalizedAs: 'uvs',
    };
    
      // Build structuredContent with enriched fields for map pins and featured cards
      const compactVehicles = vehicles.map((vehicle, index) => {
        // Add enriched metadata if available
        const enriched = enrichedMetadata[index];
        let base: UnifiedVehicle | Record<string, unknown> = vehicle;
        
        if (enriched) {
          // Safely add enriched metadata
          base = {
            ...vehicle,
            ...(enriched.sellerComments !== undefined && { sellerComments: enriched.sellerComments }),
            ...(enriched.optionPackages !== undefined && { optionPackages: enriched.optionPackages }),
          };
        }
        
        // Enrich with map pin and featured card data
        return compactVehicleForWidget(base);
      });
      const structuredContentVehicles = balanceVehiclesByDealer(compactVehicles, MAX_WIDGET_RESULTS);
      rememberVehicleDetails(structuredContentVehicles);

    const toolResult = {
      success: true,
      data: {
        content: buildReadableContent(totalCount, structuredContentVehicles, searchParams.location),
        vehicles: structuredContentVehicles,
        dealerSummary,
        totalCount,
        searchParams,
        structuredContent: { 
          results: { 
            vehicles: structuredContentVehicles, 
            dealerSummary,
            totalCount, 
            searchParams,
            ...sourceInfo,
          } as unknown
        },
        _meta: {
          results: {
            vehicles: structuredContentVehicles,
            dealerSummary,
            totalCount,
            searchParams,
            ...sourceInfo,
          },
        },
        ...sourceInfo,
      },
      error: undefined
    };
    
    // Validate the result shape
    validateToolResult(toolResult.data);
    
    return toolResult;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      event: 'search_error',
      source: 'uvs_db',
      ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
