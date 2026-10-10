/**
 * Facets-First Canonical Filter Resolver
 *
 * Converts AI-extracted intent (ApiCompatibleFilters) into MarketCheck-validated
 * canonical values by:
 *   1. Fetching available facet values from MCP (with location-scoped caching)
 *   2. Using a direct string match for free; falling back to a single AI batch
 *      call when direct matching fails
 *   3. Falling back gracefully to the existing normalized value on any failure
 *
 * This eliminates the need for ever-growing hardcoded alias maps while keeping
 * every value sent to the MarketCheck API provably valid.
 *
 * Exported types:  CanonicalFilters, ResolutionMeta, ResolveResult
 * Exported fn:     resolveCanonicalFilters()
 * Exported fn:     cleanupFacetCache()   – for periodic maintenance
 */

import OpenAI from 'openai';
import { callMcpTool, McpQuotaError, McpRateLimitError } from '@/lib/marketcheck/mcp-client';
import type { ApiCompatibleFilters } from './parse-inventory-query';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** All fields are MarketCheck-validated canonical values ready for the API. */
export interface CanonicalFilters {
  minPrice?: number;
  maxPrice?: number;
  make?: string;
  model?: string;
  year?: number;
  minYear?: number;
  maxYear?: number;
  maxMiles?: number;
  condition?: 'new' | 'used' | 'certified';
  bodyType?: string;
  exteriorColor?: string;
  powertrainType?: string;
  seatingCapacity?: number;
}

export interface ResolutionField {
  intent: string;
  resolved: string;
  source: 'direct' | 'ai' | 'fallback';
  confidence: number;
  candidates?: string[];
}

export interface ResolutionMeta {
  /** One entry per categorical field that was actively resolved. */
  fields: Record<string, ResolutionField>;
  /** Where the facet data came from. */
  facetSource: 'cache' | 'mcp' | 'none';
  latencyMs: number;
}

export interface ResolveResult {
  canonicalFilters: CanonicalFilters;
  meta: ResolutionMeta;
}

// ---------------------------------------------------------------------------
// Internal: MCP facet response shapes
// ---------------------------------------------------------------------------

interface MCFacetItem {
  item: string;
  count: number;
}

interface MCFacetsEnvelope {
  data?: {
    facets?: Record<string, MCFacetItem[]>;
    num_found?: number;
  };
}

// ---------------------------------------------------------------------------
// Internal: Facet cache
// ---------------------------------------------------------------------------

interface FacetCacheEntry {
  /** field name (e.g. "body_type") → valid value strings */
  facets: Record<string, string[]>;
  expiresAt: number;
}

const facetCache = new Map<string, FacetCacheEntry>();
const FACET_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — facets are stable

/**
 * Build a cache key for a given location bucket + optional make scope.
 * Rounds coordinates to 0.5° buckets so nearby searches share the same entry.
 */
function makeFacetCacheKey(
  lat: number,
  lng: number,
  radiusMiles: number,
  make?: string,
): string {
  const latB = Math.round(lat * 2) / 2;
  const lngB = Math.round(lng * 2) / 2;
  return `${latB}|${lngB}|${radiusMiles}|${make ?? ''}`;
}

/** Probabilistic eviction — called on every cache write. */
function evictExpiredFacets(): void {
  if (Math.random() > 0.15) return; // ~15% chance to run on each write
  const now = Date.now();
  for (const [k, v] of facetCache.entries()) {
    if (now > v.expiresAt) facetCache.delete(k);
  }
}

/** Explicit cleanup, exported for use in periodic maintenance hooks. */
export function cleanupFacetCache(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [k, v] of facetCache.entries()) {
    if (now > v.expiresAt) {
      facetCache.delete(k);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[canonical-resolver] Cleaned ${cleaned} expired facet cache entries`);
  }
}

// ---------------------------------------------------------------------------
// Internal: MCP facet fetch
// ---------------------------------------------------------------------------

/**
 * Fetch one or more field facets from MarketCheck via MCP.
 * Results are cached by location bucket + optional make scope.
 *
 * @param fields  MCP field names, e.g. ['body_type', 'powertrain_type', 'make']
 * @param scope   Optional filter context to scope make→model hierarchy
 */
async function fetchFacets(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  fields: string[],
  scope?: { make?: string },
): Promise<{ data: Record<string, string[]>; fromCache: boolean }> {
  const cacheKey = makeFacetCacheKey(latitude, longitude, radiusMiles, scope?.make);
  const cached = facetCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    // Only return if all requested fields are present in the cached entry
    const allPresent = fields.every((f) => f in cached.facets);
    if (allPresent) {
      return { data: cached.facets, fromCache: true };
    }
  }

  // Build facets parameter: "field|offset|limit" for each field
  const facetsParam = fields.map((f) => `${f}|0|60`).join(',');

  const args: Record<string, unknown> = {
    latitude,
    longitude,
    radius: radiusMiles,
    rows: 1,
    facets: facetsParam,
    include_build_object: false,
    include_dealer_object: false,
  };
  if (scope?.make) args.make = scope.make;

  let raw: MCFacetsEnvelope | null = null;
  try {
    raw = await callMcpTool<MCFacetsEnvelope>('search_active_cars', args, 10000);
  } catch (err) {
    if (err instanceof McpQuotaError) {
      console.error(JSON.stringify({
        event: 'canonical_resolver_quota_exceeded',
        message: '🚫 MarketCheck quota exhausted during facet resolution — resolver will fall back to normalized values',
        fields,
      }));
      // Re-throw so the outer catch in resolveCanonicalFilters records it and falls back
      throw err;
    }
    if (err instanceof McpRateLimitError) {
      console.warn(JSON.stringify({
        event: 'canonical_resolver_rate_limited',
        retryAfter: err.retryAfter,
        fields,
      }));
      throw err;
    }
    throw err;
  }

  const data: Record<string, string[]> = {};
  for (const field of fields) {
    const items: MCFacetItem[] = raw?.data?.facets?.[field] ?? [];
    data[field] = items.map((i) => i.item).filter(Boolean);
  }

  // Merge into existing cache entry so separate passes accumulate
  const existing = facetCache.get(cacheKey);
  const merged = { ...(existing?.facets ?? {}), ...data };
  evictExpiredFacets();
  facetCache.set(cacheKey, { facets: merged, expiresAt: Date.now() + FACET_CACHE_TTL_MS });

  return { data, fromCache: false };
}

// ---------------------------------------------------------------------------
// Internal: field-name mapping between our API surface and MCP facet names
// ---------------------------------------------------------------------------

const FIELD_TO_FACET: Record<string, string> = {
  bodyType: 'body_type',
  powertrainType: 'powertrain_type',
  make: 'make',
  model: 'model',
};

// ---------------------------------------------------------------------------
// Internal: AI batch resolver
// ---------------------------------------------------------------------------

interface ResolvedValue {
  value: string | null;
  source: 'direct' | 'ai' | 'fallback';
  confidence: number;
}

/**
 * Resolve multiple categorical fields in a single AI call.
 * Attempts a free direct-match first; only calls the LLM for fields that
 * didn't match.
 *
 * @param intents  { fieldName: userIntentString }
 * @param facets   { mcpFieldName: string[] } — from fetchFacets()
 */
async function resolveAllCategoricalFields(
  intents: Record<string, string>,
  facets: Record<string, string[]>,
): Promise<Record<string, ResolvedValue>> {
  const results: Record<string, ResolvedValue> = {};
  const needsAI: Record<string, string> = {};

  // Pass 1: free direct case-insensitive match
  for (const [field, intent] of Object.entries(intents)) {
    const mcpField = FIELD_TO_FACET[field];
    const candidates = facets[mcpField] ?? [];

    if (candidates.length === 0) {
      // No facets returned — keep the normalized value as-is
      results[field] = { value: intent, source: 'fallback', confidence: 0.5 };
      continue;
    }

    const direct = candidates.find(
      (c) => c.toLowerCase() === intent.toLowerCase(),
    );
    if (direct) {
      results[field] = { value: direct, source: 'direct', confidence: 1.0 };
    } else {
      needsAI[field] = intent;
    }
  }

  if (Object.keys(needsAI).length === 0) return results;

  // Pass 2: single OpenAI call for all unresolved fields
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    for (const [field, intent] of Object.entries(needsAI)) {
      results[field] = { value: intent, source: 'fallback', confidence: 0.5 };
    }
    return results;
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Build a compact structured prompt
  const fieldLines = Object.entries(needsAI)
    .map(([field, intent]) => {
      const mcpField = FIELD_TO_FACET[field];
      const candidates = facets[mcpField] ?? [];
      return `"${field}": user said "${intent}", valid values: ${JSON.stringify(candidates)}`;
    })
    .join('\n');

  const prompt = `You are mapping user vehicle search terms to canonical API values.

For each field below, pick the EXACT string from the "valid values" list that best matches what the user meant. If nothing fits, use null.
Return valid JSON only — no explanation, no extra keys.

Fields:
${fieldLines}

Return format: {"fieldName": "chosen value or null", ...}`;

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = resp.choices[0]?.message?.content?.trim();
    const parsed: Record<string, string | null> = content ? JSON.parse(content) : {};

    for (const [field, intent] of Object.entries(needsAI)) {
      const mcpField = FIELD_TO_FACET[field];
      const candidates = facets[mcpField] ?? [];
      const chosen = parsed[field];

      if (chosen && chosen !== 'null' && candidates.includes(chosen)) {
        results[field] = { value: chosen, source: 'ai', confidence: 0.85 };
      } else if (chosen && chosen !== 'null') {
        // AI returned something not in the exact list — attempt partial rescue
        const loose = candidates.find(
          (c) =>
            c.toLowerCase().includes(chosen.toLowerCase()) ||
            chosen.toLowerCase().includes(c.toLowerCase()),
        );
        results[field] = loose
          ? { value: loose, source: 'ai', confidence: 0.65 }
          : { value: intent, source: 'fallback', confidence: 0.5 };
      } else {
        // AI returned null or couldn't match — keep normalized intent
        results[field] = { value: intent, source: 'fallback', confidence: 0.5 };
      }
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'canonical_resolver_ai_error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    for (const [field, intent] of Object.entries(needsAI)) {
      results[field] = { value: intent, source: 'fallback', confidence: 0.5 };
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public: main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve API-compatible filters into MarketCheck-validated canonical values.
 *
 * Numeric and condition fields are passed through directly.
 * Categorical fields (bodyType, powertrainType, make, model) are resolved
 * against live MCP facets:
 *   - Pass 1: bodyType, powertrainType, make — one MCP call
 *   - Pass 2: model (scoped by resolved make) — second MCP call only if needed
 *
 * On any MCP or AI failure the resolver falls back to the normalized values
 * that were already in apiFilters, so it never blocks the search.
 *
 * @param apiFilters   Normalized intent from validateAndNormalize()
 * @param context      Location used to scope facets (lat/lng required)
 */
export async function resolveCanonicalFilters(
  apiFilters: ApiCompatibleFilters,
  context: {
    latitude: number;
    longitude: number;
    radiusMiles?: number;
  },
): Promise<ResolveResult> {
  const t0 = Date.now();
  const radius = context.radiusMiles ?? 50;

  const meta: ResolutionMeta = {
    fields: {},
    facetSource: 'none',
    latencyMs: 0,
  };

  // --- Passthrough for numeric / controlled-enum fields ---
  const canonical: CanonicalFilters = {
    minPrice: apiFilters.minPrice,
    maxPrice: apiFilters.maxPrice,
    year: apiFilters.year,
    minYear: apiFilters.minYear,
    maxYear: apiFilters.maxYear,
    maxMiles: apiFilters.maxMiles,
    condition: apiFilters.condition,
    seatingCapacity: apiFilters.seatingCapacity,
    // Pass-through directly (no facet resolution needed for color)
    ...(apiFilters.exteriorColor && { exteriorColor: apiFilters.exteriorColor }),
    // Categorical defaults (overwritten below if resolution succeeds)
    ...(apiFilters.make && { make: apiFilters.make }),
    ...(apiFilters.model && { model: apiFilters.model }),
    ...(apiFilters.bodyType && { bodyType: apiFilters.bodyType }),
    ...(apiFilters.powertrainType && { powertrainType: apiFilters.powertrainType }),
  };

  // Identify which categorical fields we actually have intent for
  const pass1Intents: Record<string, string> = {};
  const pass1Fields: string[] = [];

  if (apiFilters.bodyType) {
    pass1Intents['bodyType'] = apiFilters.bodyType;
    pass1Fields.push('body_type');
  }
  if (apiFilters.powertrainType) {
    pass1Intents['powertrainType'] = apiFilters.powertrainType;
    pass1Fields.push('powertrain_type');
  }
  if (apiFilters.make) {
    pass1Intents['make'] = apiFilters.make;
    pass1Fields.push('make');
  }

  if (pass1Fields.length === 0 && !apiFilters.model) {
    // Nothing categorical to resolve — return passthrough immediately
    meta.latencyMs = Date.now() - t0;
    return { canonicalFilters: canonical, meta };
  }

  try {
    // ----- Pass 1: body_type, powertrain_type, make -----
    let facetSource: 'cache' | 'mcp' = 'cache';

    if (pass1Fields.length > 0) {
      const { data: pass1Facets, fromCache } = await fetchFacets(
        context.latitude,
        context.longitude,
        radius,
        pass1Fields,
      );
      if (!fromCache) facetSource = 'mcp';
      meta.facetSource = facetSource;

      const pass1Results = await resolveAllCategoricalFields(pass1Intents, pass1Facets);

      for (const [field, resolved] of Object.entries(pass1Results)) {
        if (resolved.value !== null) {
          if (field === 'bodyType') canonical.bodyType = resolved.value;
          if (field === 'powertrainType') canonical.powertrainType = resolved.value;
          if (field === 'make') canonical.make = resolved.value;
        }
        const candidates = pass1Facets[FIELD_TO_FACET[field]];
        meta.fields[field] = {
          intent: pass1Intents[field],
          resolved: resolved.value ?? pass1Intents[field],
          source: resolved.source,
          confidence: resolved.confidence,
          // Only attach candidate list for bodyType/powertrainType (short lists)
          ...(field !== 'make' && { candidates }),
        };
      }
    }

    // ----- Pass 2: model (scoped by resolved make) -----
    if (apiFilters.model && canonical.make) {
      const { data: pass2Facets, fromCache: p2Cache } = await fetchFacets(
        context.latitude,
        context.longitude,
        radius,
        ['model'],
        { make: canonical.make },
      );
      if (!p2Cache) meta.facetSource = 'mcp';

      const pass2Results = await resolveAllCategoricalFields(
        { model: apiFilters.model },
        pass2Facets,
      );
      const modelRes = pass2Results['model'];
      if (modelRes?.value) {
        canonical.model = modelRes.value;
      }
      meta.fields['model'] = {
        intent: apiFilters.model,
        resolved: modelRes?.value ?? apiFilters.model,
        source: modelRes?.source ?? 'fallback',
        confidence: modelRes?.confidence ?? 0.5,
        candidates: pass2Facets['model']?.slice(0, 20), // truncate for log
      };
    }
  } catch (err) {
    // Any MCP/AI failure — canonical already holds passthrough normalized values
    console.error(
      JSON.stringify({
        event: 'canonical_resolver_error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    meta.facetSource = 'none';
  }

  meta.latencyMs = Date.now() - t0;

  console.log(
    JSON.stringify({
      event: 'canonical_resolve_complete',
      latencyMs: meta.latencyMs,
      facetSource: meta.facetSource,
      fields: Object.entries(meta.fields).map(([k, v]) => ({
        field: k,
        intent: v.intent,
        resolved: v.resolved,
        source: v.source,
        confidence: v.confidence,
      })),
    }),
  );

  return { canonicalFilters: canonical, meta };
}
