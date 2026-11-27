import type { ListingDealerIdentity } from './rooftop-match';

/**
 * Listing identity for a rooftop match, keyed only by listing id.
 * A positive (in-network) identity is kept 15 minutes.
 * An off-network identity or a negative lookup is kept 6 hours.
 * The value is dealer id, listing URL, and dealer website.
 * Price, VIN, photos, and the listing body are not stored.
 */

export const LISTING_IDENTITY_POSITIVE_TTL_MS = 15 * 60 * 1000;
export const LISTING_IDENTITY_NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;

export type CachedListingIdentity =
  | { kind: 'found'; identity: ListingDealerIdentity }
  | { kind: 'negative' };

type Entry = { expiresAt: number; value: CachedListingIdentity };

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function identityForCache(identity: ListingDealerIdentity, listingId: string): ListingDealerIdentity {
  return {
    listingId: typeof identity.listingId === 'string' && identity.listingId ? identity.listingId : listingId,
    listingUrl: typeof identity.listingUrl === 'string' ? identity.listingUrl : null,
    dealerWebsite: typeof identity.dealerWebsite === 'string' ? identity.dealerWebsite : null,
    marketcheckDealerId: identity.marketcheckDealerId ?? null,
  };
}

export function readListingIdentityCache(listingId: string, nowMs: number): CachedListingIdentity | null {
  const entry = entries.get(listingId);
  if (!entry) return null;
  if (nowMs >= entry.expiresAt) {
    entries.delete(listingId);
    return null;
  }
  return entry.value;
}

export function writeListingIdentityCache(
  listingId: string,
  value: CachedListingIdentity,
  ttlMs: number,
  nowMs: number,
): void {
  entries.set(listingId, { value, expiresAt: nowMs + ttlMs });
}

/** One paid lookup for simultaneous misses of the same listing id. Dropped when it settles. */
export function shareListingIdentityLookup<T>(listingId: string, load: () => Promise<T>): Promise<T> {
  const existing = inflight.get(listingId);
  if (existing) return existing as Promise<T>;
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  inflight.set(listingId, promise);
  Promise.resolve()
    .then(load)
    .then(resolve, reject)
    .finally(() => {
      if (inflight.get(listingId) === promise) inflight.delete(listingId);
    });
  return promise;
}

export function listingIdentityCacheSnapshotForTests(): CachedListingIdentity[] {
  return [...entries.values()].map((entry) => entry.value);
}

export function resetListingIdentityCacheForTests(): void {
  entries.clear();
  inflight.clear();
}
