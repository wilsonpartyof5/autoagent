/**
 * MarketCheck cache policy.
 *
 * Sales terms: inventory search, listing detail, VIN decode, and VIN history
 * must not be cached or stored. Only dealership inventory syndication, the
 * incentives API, and MarketCheck Price (fair price) may be cached, for at
 * most 24 hours.
 *
 * Non-cacheable endpoints still share one in-flight promise for simultaneous
 * identical requests. That dedupe is not storage: the promise is dropped as
 * soon as it settles, and a later request calls MarketCheck again.
 */

export const MARKETCHECK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const MARKETCHECK_CACHE_POLICY = {
  search_active_cars: { allowed: false, ttlMs: 0 },
  listing_detail: { allowed: false, ttlMs: 0 },
  decode_vin_basic: { allowed: false, ttlMs: 0 },
  decode_vin_neovin: { allowed: false, ttlMs: 0 },
  get_car_history: { allowed: false, ttlMs: 0 },
  dealership_inventory: { allowed: true, ttlMs: MARKETCHECK_CACHE_TTL_MS },
  incentives: { allowed: true, ttlMs: MARKETCHECK_CACHE_TTL_MS },
  marketcheck_price: { allowed: true, ttlMs: MARKETCHECK_CACHE_TTL_MS },
} as const;

export type MarketCheckCacheEndpoint = keyof typeof MARKETCHECK_CACHE_POLICY;

const TOOL_ENDPOINT: Record<string, MarketCheckCacheEndpoint> = {
  search_active_cars: 'search_active_cars',
  get_car_history: 'get_car_history',
  get_dealership_inventory: 'dealership_inventory',
  get_incentives: 'incentives',
  // Fair price uses marketCheckPriceCacheKey (VIN + ZIP area + miles) in
  // getMarketCheckPrice. A generic args key must not become a second store.
  get_marketcheck_price: 'marketcheck_price',
};

type Stored = { value: unknown; expiresAt: number };

const stored = new Map<string, Stored>();
const inflight = new Map<string, Promise<unknown>>();

export function policyEndpointForTool(toolName: string): MarketCheckCacheEndpoint | null {
  return TOOL_ENDPOINT[toolName] ?? null;
}

/** ZIP area is the 5-digit ZIP MarketCheck Price was quoted for. */
export function zipArea(zip: string): string {
  return zip.replace(/\D/g, '').slice(0, 5);
}

/**
 * Fair-price cache identity. Miles are included because MarketCheck Price
 * changes with the odometer; the geographic component is the ZIP area.
 */
export function marketCheckPriceCacheKey(vin: string, zip: string, miles: number): string {
  return `${vin.trim().toUpperCase()}|${zipArea(zip)}|${Math.round(miles)}`;
}

export async function loadMarketCheck<T>(
  endpoint: MarketCheckCacheEndpoint,
  key: string,
  load: () => Promise<T>,
  now: () => number = Date.now,
): Promise<{ value: T; fromCache: boolean }> {
  const policy = MARKETCHECK_CACHE_POLICY[endpoint];
  const fullKey = `${endpoint}:${key}`;

  if (policy.allowed && policy.ttlMs > 0) {
    const hit = stored.get(fullKey);
    if (hit && now() < hit.expiresAt) {
      return { value: hit.value as T, fromCache: true };
    }
    if (hit) stored.delete(fullKey);
  } else if (stored.has(fullKey)) {
    stored.delete(fullKey);
  }

  const existing = inflight.get(fullKey);
  if (existing) {
    return { value: (await existing) as T, fromCache: false };
  }

  const promise = load()
    .then((value) => {
      if (policy.allowed && policy.ttlMs > 0 && value != null) {
        stored.set(fullKey, { value, expiresAt: now() + policy.ttlMs });
      }
      return value;
    })
    .finally(() => {
      if (inflight.get(fullKey) === promise) inflight.delete(fullKey);
    });

  inflight.set(fullKey, promise);
  return { value: (await promise) as T, fromCache: false };
}

/** In-flight dedupe for tools that must never be stored. */
export async function dedupeInflight<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = load().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise as Promise<T>;
}

export function marketCheckStoredKeyCount(): number {
  return stored.size;
}

export function resetMarketCheckCacheForTests(): void {
  stored.clear();
  inflight.clear();
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
