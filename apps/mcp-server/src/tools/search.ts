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
    _meta?: Record<string, unknown>;
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
    const locationMatch = lowerQuery.match(
      /(?:in|near|around)\s+(?:the\s+)?([a-z\s]+?,\s*[a-z]{2}|[a-z\s]+?(?:metro(?:\s+area)?|area)?|[a-z\s]+(?:south carolina|north carolina|sc|nc|co|colorado|wa|texas|tx|california|ca))\b/i,
    );
    const inferredLocation = locationMatch?.[1]
      ? locationMatch[1]
          .replace(/\bsc\b/i, 'SC')
          .replace(/\bnc\b/i, 'NC')
          .replace(/\bco\b/i, 'CO')
          .replace(/\bwa\b/i, 'WA')
          .replace(/\btx\b/i, 'TX')
          .replace(/\bca\b/i, 'CA')
          .replace(/\bsouth carolina\b/i, 'South Carolina')
          .replace(/\bnorth carolina\b/i, 'North Carolina')
          .replace(/\bcolorado\b/i, 'CO')
          .replace(/\bmetro(?:\s+area)?\b/i, '')
          .replace(/\barea\b/i, '')
          .trim()
      : undefined;

    const inferredModels = [
      lowerQuery.includes('grand cherokee') ? 'Grand Cherokee' : '',
      lowerQuery.includes('cherokee') && !lowerQuery.includes('grand cherokee') ? 'Cherokee' : '',
      lowerQuery.includes('wrangler') ? 'Wrangler' : '',
      lowerQuery.includes('gladiator') ? 'Gladiator' : '',
      lowerQuery.includes('camry') ? 'Camry' : '',
      lowerQuery.includes('cr-v') || lowerQuery.includes('crv') ? 'CR-V' : '',
      lowerQuery.includes('outback') ? 'Outback' : '',
      lowerQuery.includes('f-150') || lowerQuery.includes('f150') ? 'F-150' : '',
      lowerQuery.includes('silverado') ? 'Silverado' : '',
      lowerQuery.includes('sierra') ? 'Sierra' : '',
      lowerQuery.includes('4runner') || lowerQuery.includes('4-runner') ? '4Runner' : '',
      lowerQuery.includes('explorer') ? 'Explorer' : '',
    ].filter(Boolean);

    const location = inferredLocation || contextLocation;
    if (!location) {
      return {
        success: false,
        error: 'Please name a city so I can search for cars nearby.',
      };
    }

    // Map query to search parameters - use defaults when query does not provide them
    const searchParams: SearchParams = {
      location,
      condition: lowerQuery.includes('new') ? 'new' : 'used',
      radiusMiles: lowerQuery.includes('near') || lowerQuery.includes('around') || lowerQuery.includes('metro') ? 75 : undefined,
      make: lowerQuery.includes('toyota') ? 'Toyota'
            : lowerQuery.includes('honda') ? 'Honda'
            : lowerQuery.includes('subaru') ? 'Subaru'
            : lowerQuery.includes('ford') ? 'Ford'
            : lowerQuery.includes('chevrolet') || lowerQuery.includes('chevy') ? 'Chevrolet'
            : lowerQuery.includes('gmc') ? 'GMC'
            : lowerQuery.includes('ram') ? 'Ram'
            : lowerQuery.includes('jeep') ? 'Jeep'
            : undefined,
      model: inferredModels[0],
      models: inferredModels.length > 1 ? inferredModels : undefined,
      maxPrice: (() => {
        const kMatch = lowerQuery.match(/under\s*\$?\s*([\d,]+)\s*k\b/i);
        if (kMatch) {
          const value = Number(kMatch[1].replace(/,/g, ''));
          return Number.isFinite(value) ? value * 1000 : undefined;
        }
        const match = lowerQuery.match(/under\s*\$?\s*([\d,]+)/i);
        if (!match) return undefined;
        const raw = Number(match[1].replace(/,/g, ''));
        return Number.isFinite(raw) ? raw : undefined;
      })(),
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
      _meta?: Record<string, unknown>;
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
    const meta = resultData?._meta ?? {
      results: (structuredContent as { results?: unknown }).results,
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
        // Required so ChatGPT can hydrate the map widget when the host routes NL queries to `search`.
        _meta: meta,
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
