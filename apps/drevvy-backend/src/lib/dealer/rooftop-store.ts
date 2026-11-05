import type { SupabaseClient } from '@supabase/supabase-js';

import { callMcpTool } from '@/lib/marketcheck/mcp-client';

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
  | { status: 'unavailable'; reason: 'not_found' | 'error' | 'timeout' };

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

export async function lookupListingDealerIdentity(
  listingId: string,
  vin?: string,
): Promise<ListingIdentityLookup> {
  const args: Record<string, unknown> = {
    rows: 1,
    start: 0,
    include_build_object: true,
    include_dealer_object: true,
  };
  if (vin) args.vin = vin;
  else args.listing_id = listingId;

  try {
    const search = await callMcpTool<{ data?: { listings?: RawListing[] } }>('search_active_cars', args);
    const listing = search?.data?.listings?.[0];
    if (!listing) return { status: 'unavailable', reason: 'not_found' };
    const identity = identityFromMarketCheckListing(listing);
    if (!identity) return { status: 'unavailable', reason: 'not_found' };
    return {
      status: 'found',
      identity: { ...identity, listingId: identity.listingId ?? listingId },
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

export async function resolveRooftopMatch(
  input: ListingDealerIdentity,
  deps: RooftopDirectory,
): Promise<RooftopMatch> {
  const fetched = input.listingId && deps.loadListingIdentity
    ? await deps.loadListingIdentity(input.listingId)
    : null;
  const identity = mergeListingIdentity(fetched, input);
  const rooftops = await deps.listOnboardedRooftops();
  return matchOnboardedRooftop(identity, rooftops);
}

function firstText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
