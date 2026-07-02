import { searchVehicles } from './searchVehicles.js';
import { type SearchParams } from '@autoagent/shared';

/**
 * OpenAI-required search tool that wraps our existing searchVehicles logic
 * Returns results in the format: { results: [{ id, title, url }] } as JSON string
 */
export async function search(params: unknown): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    structuredContent?: unknown;
    components: { type: string; url: string; }[];
  };
  error?: string;
}> {
  try {
    // Validate input parameters - expect { query: string }
    if (!params || typeof params !== 'object') {
      return {
        success: false,
        error: 'Invalid parameters: expected object with query property',
      };
    }

    const { query } = params as { query?: string };
    
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        error: 'Invalid parameters: query is required and must be a string',
      };
    }

    const lowerQuery = query.toLowerCase();
    const locationMatch = lowerQuery.match(/(?:in|near)\s+([a-z\s]+,\s*[a-z]{2}|[a-z\s]+(?:south carolina|north carolina|sc|nc))/i);
    const inferredLocation = locationMatch?.[1]
      ? locationMatch[1]
          .replace(/\bsc\b/i, 'SC')
          .replace(/\bnc\b/i, 'NC')
          .replace(/\bsouth carolina\b/i, 'South Carolina')
          .replace(/\bnorth carolina\b/i, 'North Carolina')
          .trim()
      : undefined;

    // Map query to search parameters - use defaults when query does not provide them
    const searchParams: SearchParams = {
      location: inferredLocation || 'Seattle, WA',
      condition: lowerQuery.includes('new') ? 'new' : 'used',
      radiusMiles: lowerQuery.includes('near') || lowerQuery.includes('around') ? 50 : undefined,
      // Try to extract make/model from query if possible
      make: lowerQuery.includes('toyota') ? 'Toyota' : 
            lowerQuery.includes('honda') ? 'Honda' : 
            lowerQuery.includes('subaru') ? 'Subaru' : undefined,
      model: lowerQuery.includes('camry') ? 'Camry' : 
             lowerQuery.includes('cr-v') ? 'CR-V' : 
             lowerQuery.includes('outback') ? 'Outback' : undefined,
    };
    
    // Call the existing searchVehicles function
    const searchResult = await searchVehicles(searchParams);
    
    if (!searchResult.success) {
      return {
        success: false,
        error: searchResult.error || 'Search failed',
      };
    }

    // Extract vehicles from the search result
    const vehicles = (searchResult.data as { vehicles?: unknown[] })?.vehicles || [];
    const totalCount = (searchResult.data as { totalCount?: number })?.totalCount || 0;
    
    // Transform vehicles to the required format: [{ id, title, url }]
    const results = vehicles.map((vehicle: unknown) => {
      const v = vehicle as { id?: string; vin?: string; year?: number; make?: string; model?: string; price?: number };
      return {
        id: v.id || v.vin || `vehicle-${Math.random().toString(36).substr(2, 9)}`,
        title: `${v.year} ${v.make} ${v.model} - $${v.price?.toLocaleString() || 'N/A'}`,
        url: `https://example.com/vehicle/${v.id || v.vin}` // Placeholder URL
      };
    });

    // Create the JSON string response as required by MCP docs
    const resultsJson = JSON.stringify({ results });

    return {
      success: true,
      data: {
        content: [
          { 
            type: 'text', 
            text: `Found ${totalCount} vehicles. Results: ${resultsJson}` 
          }
        ],
        structuredContent: (searchResult.data as { structuredContent?: unknown })?.structuredContent || {
          results: {
            vehicles,
            totalCount,
            searchParams,
          },
        },
        components: (searchResult.data as { components?: { type: string; url: string; }[] })?.components || []
      },
    };
  } catch (error) {
    console.error('Search tool error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
