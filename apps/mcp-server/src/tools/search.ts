import { searchVehicles } from './searchVehicles.js';
import { type SearchParams } from '@autoagent/shared';
import type { ToolContext } from '../mcp-simple.js';

/**
 * Natural-language search wrapper around searchVehicles.
 * Returns UI-first payload (structuredContent + content) for ChatGPT rendering.
 */
export async function search(params: unknown, context?: ToolContext): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    structuredContent?: unknown;
  };
  error?: string;
}> {
  try {
    const contextLocation = context?.userLocation
      ? [context.userLocation.city, context.userLocation.region].filter(Boolean).join(', ')
      : undefined;
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
      location: inferredLocation || contextLocation || 'Seattle, WA',
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
    const searchResult = await searchVehicles(searchParams, context);
    
    if (!searchResult.success) {
      return {
        success: false,
        error: searchResult.error || 'Search failed',
      };
    }

    const resultData = searchResult.data as {
      content?: { type: string; text: string; }[];
      structuredContent?: {
        results?: {
          vehicles?: unknown[];
          totalCount?: number;
          searchParams?: SearchParams;
        };
      };
      vehicles?: unknown[];
      totalCount?: number;
    } | undefined;
    const totalCount = resultData?.structuredContent?.results?.totalCount
      ?? resultData?.totalCount
      ?? 0;
    const structuredContent = resultData?.structuredContent ?? {
      results: {
        vehicles: resultData?.vehicles ?? [],
        totalCount,
        searchParams,
      },
    };

    const content = Array.isArray(resultData?.content) && resultData.content.length > 0
      ? resultData.content
      : [
          {
            type: 'text',
            text: `Found ${totalCount} vehicles near ${searchParams.location}.`,
          },
        ];

    return {
      success: true,
      data: {
        content,
        structuredContent,
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
