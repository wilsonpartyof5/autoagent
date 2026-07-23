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
import { callMarketcheckMcpTool } from '../services/marketcheckMcpClient.js';
import { normalizeMarketcheckSearchResult } from '../services/marketcheckMcpNormalizer.js';
import { signSearchResult } from '../lib/searchResultToken.js';
import { recordFlowEvent } from '../lib/flowTelemetry.js';
import type { ToolContext } from '../mcp-simple.js';

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
const MAX_BRIDGE_RESULTS = 8;
const MAX_WIDGET_RESULTS = 12;
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

function buildReadableContent(totalCount: number, vehicles: unknown[], location?: string): { type: string; text: string }[] {
  const header = `Found ${totalCount} vehicles${location ? ` near ${location}` : ''}.`;
  if (!vehicles.length) {
    return [{ type: 'text', text: header }];
  }

  const topLines = vehicles.slice(0, MAX_SUMMARY_LISTINGS).map((vehicle) => summarizeVehicleLine(vehicle));
  const text = `${header}\nTop matches:\n${topLines.join('\n')}`;
  return [{ type: 'text', text }];
}

function mapSearchParamsToBridgeArgs(searchParams: SearchParams): Record<string, unknown> {
  const location = searchParams.location.trim();
  const zipMatch = location.match(/\b(\d{5})(?:-\d{4})?\b/);
  const cityStateMatch = location.match(/^(.+?),\s*([A-Za-z]{2})$/);
  return {
    ...(zipMatch ? { zip: zipMatch[1] } : {}),
    ...(!zipMatch && cityStateMatch
      ? { city: cityStateMatch[1].trim(), state: cityStateMatch[2].toUpperCase() }
      : {}),
    car_type: searchParams.condition,
    price_range: searchParams.maxPrice ? `0-${Math.floor(searchParams.maxPrice)}` : undefined,
    make: searchParams.make,
    model: searchParams.model,
    radius: Math.round(searchParams.radiusMiles ?? 50),
    body_type: searchParams.bodyStyle,
    miles_range: searchParams.mileageMax ? `0-${Math.floor(searchParams.mileageMax)}` : undefined,
    rows: 12,
    fetch_all_photos: true,
    include_dealer_object: true,
    include_mc_dealership_object: true,
    include_build_object: true,
  };
}

function normalizeBridgeSearchResult(
  upstreamResult: unknown,
  searchParams: SearchParams,
  runId: string,
  sourceInfo: SourceInfo
): SearchVehiclesData {
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
  // Keep bridge payload bounded so ChatGPT can reliably consume and render.
  const compactVehicles = rawVehicles
    .slice(0, Math.max(MAX_BRIDGE_RESULTS, MAX_WIDGET_RESULTS * 4))
    .map((vehicle) => compactVehicleForWidget(vehicle as UnifiedVehicle | Record<string, unknown>));
  const vehicles = balanceVehiclesByDealer(compactVehicles, MAX_BRIDGE_RESULTS);
  const dealerSummary = buildDealerSummary(compactVehicles);

  const content = buildReadableContent(totalCount, vehicles, searchParams.location);

  return {
    content,
    vehicles,
    dealerSummary,
    totalCount,
    searchParams,
    structuredContent: {
      results: {
        vehicles,
        dealerSummary,
        totalCount,
        searchParams: structuredResults?.searchParams ?? searchParams,
        dataSource: sourceInfo.dataSource,
        inventoryProvider: sourceInfo.inventoryProvider,
        normalizedAs: sourceInfo.normalizedAs,
      },
    },
    _meta: {
      results: {
        vehicles,
        dealerSummary,
        totalCount,
        searchParams: structuredResults?.searchParams ?? searchParams,
        dataSource: sourceInfo.dataSource,
        inventoryProvider: sourceInfo.inventoryProvider,
        normalizedAs: sourceInfo.normalizedAs,
      },
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

    // Validate input parameters
    const parseResult = safeParse(SearchParamsSchema, mutableParams ?? params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid search parameters: ${parseResult.error}`,
      };
    }

    const searchParams: SearchParams = parseResult.data!;
    const cacheKey = generateCacheKey(searchParams);
    // Use single requestId for entire request to maintain correlation
    const requestId = generateRequestId(); // Used as sessionId for request correlation - reused for all events in this request

    if (CONFIG.inventorySearchProvider === 'marketcheck_mcp') {
      const runId = randomUUID();
      const bridgeArgs = mapSearchParamsToBridgeArgs(searchParams);

      const bridgeCall = await callMarketcheckMcpTool('search_active_cars', bridgeArgs, requestId);
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
        const marketcheck = normalizeMarketcheckSearchResult(bridgeCall.result);
        const signedVehicles = marketcheck.vehicles.map((vehicle) => {
          const dealer = vehicle.location.dealer;
          const vin = vehicle.baseIdentity.vin;
          const dealerId = dealer.dealerId;
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
                    vehicle: vehicle as unknown as Record<string, unknown>,
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
        const normalized = normalizeBridgeSearchResult(
          { vehicles: signedVehicles, totalCount: marketcheck.totalCount },
          searchParams,
          runId,
          sourceInfo,
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
        }));
        validateToolResult(normalized);
        recordFlowEvent({
          flowId: runId,
          eventName: 'search.succeeded',
          source: 'mcp-server',
          provider: 'marketcheck_mcp',
          requestId,
          toolName: 'search_active_cars',
          status: 'success',
          durationMs: bridgeCall.latencyMs,
          resultCount: marketcheck.totalCount,
          searchLocation: searchParams.location,
          payload: {
            normalizedCount: marketcheck.vehicles.length,
            rejectedCount: marketcheck.rejectedCount,
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
