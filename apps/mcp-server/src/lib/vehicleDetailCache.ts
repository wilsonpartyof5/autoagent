const DETAIL_TTL_MS = 15 * 60 * 1000;
const MAX_DETAIL_ENTRIES = 2_000;

type CachedVehicle = {
  expiresAt: number;
  vehicle: Record<string, unknown>;
};

const cache = new Map<string, CachedVehicle>();

function keysFor(vehicle: Record<string, unknown>): string[] {
  const identity = (vehicle.baseIdentity as Record<string, unknown> | undefined) ?? {};
  const values = [
    vehicle.id,
    identity.listingId,
    identity.vin,
    vehicle.vin,
  ];
  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => value.toLowerCase());
}

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_DETAIL_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== 'string') break;
    cache.delete(oldest);
  }
}

export function rememberVehicleDetails(vehicles: Array<Record<string, unknown>>): void {
  prune();
  const expiresAt = Date.now() + DETAIL_TTL_MS;
  for (const vehicle of vehicles) {
    for (const key of keysFor(vehicle)) {
      cache.set(key, { expiresAt, vehicle });
    }
  }
}

export function findVehicleDetails(input: {
  listingId?: string;
  vin?: string;
}): Record<string, unknown> | null {
  prune();
  for (const value of [input.listingId, input.vin]) {
    if (!value) continue;
    const entry = cache.get(value.toLowerCase());
    if (entry) return structuredClone(entry.vehicle);
  }
  return null;
}

export function clearVehicleDetailCache(): void {
  cache.clear();
}
