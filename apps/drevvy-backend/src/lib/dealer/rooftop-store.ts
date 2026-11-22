import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchMarketCheckListing } from '@/lib/marketcheck/listing-car';
import { callMcpTool } from '@/lib/marketcheck/mcp-client';

import {
  identityForCache,
  LISTING_IDENTITY_NEGATIVE_TTL_MS,
  LISTING_IDENTITY_POSITIVE_TTL_MS,
  readListingIdentityCache,
  shareListingIdentityLookup,
  writeListingIdentityCache,
  type CachedListingIdentity,
} from './listing-rooftop-cache';
import {
  matchOnboardedRooftop,
  mergeListingIdentity,
  type ListingDealerIdentity,
  type OnboardedRooftop,
  type RooftopMatch,
} from './rooftop-match';

/**
 * MarketCheck identity for one listing.
 * `unavailable` is an error, a timeout, or a missing listing. It is not
 * evidence that the dealer is off-network.
 */
export type ListingIdentityLookup =
  | { status: 'found'; identity: ListingDealerIdentity }
  | { status: 'unavailable'; reason: 'not_found' | 'mismatch' | 'error' | 'timeout' };

export type RooftopDirectory = {
  listOnboardedRooftops: () => Promise<OnboardedRooftop[]>;
  loadListingIdentity?: (listingId: string) => Promise<ListingDealerIdentity | null>;
  lookupListingIdentity?: (listingId: string) => Promise<ListingIdentityLookup>;
};

export function supabaseRooftopDirectory(supabase: SupabaseClient): RooftopDirectory {
  return {
    listOnboardedRooftops: () => loadOnboardedRooftops(supabase),
    loadListingIdentity: (listingId) => fetchListingDealerIdentity(listingId),
    lookupListingIdentity: (listingId) => lookupListingDealerIdentity(listingId),
  };
}

export function marketCheckFailureReason(error: unknown): 'timeout' | 'error' {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'timeout';
    if (/timeout|timedout|etimedout/i.test(error.message)) return 'timeout';
  }
  return 'error';
}

/**
 * Rooftops a salesperson can open on the dealer dashboard: a dealerships row
 * with at least one user_dealerships membership.
 */
export async function loadOnboardedRooftops(supabase: SupabaseClient): Promise<OnboardedRooftop[]> {
  const memberships = await supabase.from('user_dealerships').select('dealership_id');
  if (memberships.error) {
    console.error(JSON.stringify({
      event: 'onboarded_rooftops_failed',
      message: memberships.error.message,
    }));
    return [];
  }

  const ids = [...new Set(
    (memberships.data ?? [])
      .map((row) => row.dealership_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  )];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('dealerships')
    .select('id, name, marketcheck_dealer_id, marketcheck_website_url')
    .in('id', ids);

  if (error) {
    console.error(JSON.stringify({
      event: 'onboarded_rooftops_failed',
      message: error.message,
    }));
    return [];
  }

  return (data ?? []).flatMap((row) => {
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id) return [];
    return [{
      id,
      name: typeof row.name === 'string' ? row.name : '',
      marketcheckDealerId: typeof row.marketcheck_dealer_id === 'string' ? row.marketcheck_dealer_id : null,
      websiteUrl: typeof row.marketcheck_website_url === 'string' ? row.marketcheck_website_url : null,
    }];
  });
}

type RawListing = {
  id?: string;
  vdp_url?: string;
  listing_url?: string;
  inventory_url?: string;
  dealer?: {
    id?: string | number;
    website?: string;
  };
};

export function identityFromMarketCheckListing(listing: RawListing | null | undefined): ListingDealerIdentity | null {
  if (!listing) return null;
  const listingUrl = firstText(listing.vdp_url, listing.listing_url, listing.inventory_url);
  const dealerWebsite = firstText(listing.dealer?.website);
  const marketcheckDealerId = listing.dealer?.id ?? null;
  const listingId = firstText(listing.id);
  if (!listingUrl && !dealerWebsite && marketcheckDealerId == null && !listingId) return null;
  return { listingId, listingUrl, dealerWebsite, marketcheckDealerId };
}

async function searchListingByVin(vin: string): Promise<RawListing | null> {
  const search = await callMcpTool<{ data?: { listings?: RawListing[] } }>('search_active_cars', {
    rows: 1,
    start: 0,
    include_build_object: true,
    include_dealer_object: true,
    vin,
  });
  return search?.data?.listings?.[0] ?? null;
}

export async function lookupListingDealerIdentity(
  listingId: string,
  vin?: string,
): Promise<ListingIdentityLookup> {
  try {
    const listing = vin
      ? await searchListingByVin(vin)
      : await fetchMarketCheckListing(listingId) as RawListing | null;
    if (!listing) return { status: 'unavailable', reason: 'not_found' };
    if (!vin) {
      const returnedId = typeof listing.id === 'string' ? listing.id.trim() : '';
      if (returnedId.length > 0 && returnedId !== listingId) {
        return { status: 'unavailable', reason: 'mismatch' };
      }
    }
    const identity = identityFromMarketCheckListing(listing);
    if (!identity) return { status: 'unavailable', reason: 'not_found' };
    return {
      status: 'found',
      identity: {
        ...identity,
        listingId: identity.listingId ?? (vin ? null : listingId),
      },
    };
  } catch (error) {
    const reason = marketCheckFailureReason(error);
    console.error(JSON.stringify({ event: 'listing_identity_failed', reason }));
    return { status: 'unavailable', reason };
  }
}

/**
 * Older callers still receive a listing id when MarketCheck misses.
 * Network classification must use [lookupListingDealerIdentity] instead,
 * because this collapse is not an off-network result.
 */
export async function fetchListingDealerIdentity(
  listingId: string,
  vin?: string,
): Promise<ListingDealerIdentity | null> {
  const looked = await lookupListingDealerIdentity(listingId, vin);
  if (looked.status === 'found') return looked.identity;
  return { listingId };
}

export type RooftopResolveOptions = {
  nowMs?: number;
  /** Runs only when a paid listing lookup is about to start. Cache hits skip it. */
  beforePaidLookup?: () => Promise<void>;
};

export async function resolveRooftopMatch(
  input: ListingDealerIdentity,
  deps: RooftopDirectory,
  options?: RooftopResolveOptions,
): Promise<RooftopMatch> {
  const listingId = typeof input.listingId === 'string' && input.listingId.length > 0
    ? input.listingId
    : null;
  if (!listingId || !deps.lookupListingIdentity) {
    const fetched = listingId && deps.loadListingIdentity
      ? await deps.loadListingIdentity(listingId)
      : null;
    const identity = mergeListingIdentity(fetched, input);
    const rooftops = await deps.listOnboardedRooftops();
    return matchOnboardedRooftop(identity, rooftops);
  }
  return resolveCachedListing(listingId, input, deps, options ?? {});
}

async function resolveCachedListing(
  listingId: string,
  input: ListingDealerIdentity,
  deps: RooftopDirectory,
  options: RooftopResolveOptions,
): Promise<RooftopMatch> {
  const lookup = deps.lookupListingIdentity;
  if (!lookup) return matchOnboardedRooftop(input, []);
  const rooftops = await deps.listOnboardedRooftops();
  if (rooftops.length === 0) return matchOnboardedRooftop(input, rooftops);

  const nowMs = options.nowMs ?? Date.now();
  const cached = await loadCachedIdentity(listingId, input, rooftops, lookup, options, nowMs);
  const fetched = cached.kind === 'found' ? cached.identity : { listingId };
  return matchOnboardedRooftop(mergeListingIdentity(fetched, input), rooftops);
}

async function loadCachedIdentity(
  listingId: string,
  input: ListingDealerIdentity,
  rooftops: readonly OnboardedRooftop[],
  lookup: (listingId: string) => Promise<ListingIdentityLookup>,
  options: RooftopResolveOptions,
  nowMs: number,
): Promise<CachedListingIdentity> {
  const hit = readListingIdentityCache(listingId, nowMs);
  if (hit) return hit;
  return shareListingIdentityLookup(listingId, async () => {
    const again = readListingIdentityCache(listingId, nowMs);
    if (again) return again;
    if (options.beforePaidLookup) await options.beforePaidLookup();
    const looked = await lookup(listingId);
    if (looked.status === 'unavailable' && looked.reason !== 'not_found') {
      return { kind: 'negative' };
    }
    if (looked.status === 'unavailable') {
      const negative: CachedListingIdentity = { kind: 'negative' };
      writeListingIdentityCache(listingId, negative, LISTING_IDENTITY_NEGATIVE_TTL_MS, nowMs);
      return negative;
    }
    const identity = identityForCache(looked.identity, listingId);
    const match = matchOnboardedRooftop(mergeListingIdentity(identity, input), rooftops);
    const ttl = match.matched ? LISTING_IDENTITY_POSITIVE_TTL_MS : LISTING_IDENTITY_NEGATIVE_TTL_MS;
    const found: CachedListingIdentity = { kind: 'found', identity };
    writeListingIdentityCache(listingId, found, ttl, nowMs);
    return found;
  });
}

function firstText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
