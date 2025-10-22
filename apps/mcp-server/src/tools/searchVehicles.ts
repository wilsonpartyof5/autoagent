import { SearchParamsSchema, type SearchParams, type Vehicle } from '@autoagent/shared';
import { safeParse, withTimeout } from '../lib/z.js';
import { createMarketCheckClient } from '../services/marketcheck.js';
import { searchCache } from '../lib/cache.js';
import { randomUUID } from 'crypto';
import { validateToolResult } from '../lib/responseShape.js';


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
 * Search for vehicles using MarketCheck API with fallback to mocks
 */
export async function searchVehicles(params: unknown): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    structuredContent?: unknown;
    components: { type: string; url: string; }[];
  };
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Validate input parameters
    const parseResult = safeParse(SearchParamsSchema, params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid search parameters: ${parseResult.error}`,
      };
    }

    const searchParams: SearchParams = parseResult.data!;
    const cacheKey = generateCacheKey(searchParams);
    
    // Check cache first
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({
        event: 'search',
        hasKey: !!process.env.MARKETCHECK_API_KEY,
        fromCache: true,
        results: cachedResult.vehicles.length,
        ms: duration,
      }));
      
      const runId = randomUUID();
      const widgetHost = process.env.WIDGET_HOST || 'https://rana-flightiest-malcolm.ngrok-free.dev';
      const isDiag = process.env.AA_DIAG === '1';
      const vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${runId}${isDiag ? '&diag=1' : ''}`;
      
      console.log(JSON.stringify({evt:'diag.tool', runId, url: vehicleResultsUrl, ts:Date.now()}));
      
      return {
        success: true,
        data: {
          content: [{ type: 'text', text: `Found ${cachedResult.totalCount} vehicles (run ${runId})` }],
          structuredContent: { 
            results: { vehicles: cachedResult.vehicles, totalCount: cachedResult.totalCount, searchParams }
          },
          components: [
            { type: 'iframe', url: vehicleResultsUrl }
          ]
        },
      };
    }

    // Use MarketCheck API only - no mock data fallback
    const marketCheckClient = createMarketCheckClient();
    let vehicles: Vehicle[] = [];
    let totalCount = 0;
    const fromCache = false;

    if (!marketCheckClient) {
      return {
        success: false,
        error: 'MarketCheck API key not configured. Please set MARKETCHECK_API_KEY environment variable.',
      };
    }

    try {
      const result = await withTimeout(
        marketCheckClient.searchVehicles(searchParams),
        5000, // Increased timeout to 5 seconds for real API
      );
      
      vehicles = result.vehicles;
      totalCount = result.totalCount;
    } catch (error) {
      // Return error instead of falling back to mocks
      console.error('MarketCheck API failed:', error);
      return {
        success: false,
        error: `MarketCheck API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Cache the result
    const result = { vehicles, totalCount };
    searchCache.set(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'search',
      hasKey: !!process.env.MARKETCHECK_API_KEY,
      fromCache,
      results: vehicles.length,
      ms: duration,
    }));

    const runId = randomUUID();
    const widgetHost = process.env.WIDGET_HOST || 'https://rana-flightiest-malcolm.ngrok-free.dev';
    const isDiag = process.env.AA_DIAG === '1';
    const vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${runId}${isDiag ? '&diag=1' : ''}`;
    
    console.log(JSON.stringify({evt:'diag.tool', runId, url: vehicleResultsUrl, ts:Date.now()}));
    
    const toolResult = {
      success: true,
      data: {
        content: [{ type: 'text', text: `Found ${totalCount} vehicles (run ${runId})` }],
        structuredContent: { 
          results: { vehicles, totalCount, searchParams } as unknown
        },
        components: [
          { type: 'iframe', url: vehicleResultsUrl }
        ]
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
      hasKey: !!process.env.MARKETCHECK_API_KEY,
      ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
