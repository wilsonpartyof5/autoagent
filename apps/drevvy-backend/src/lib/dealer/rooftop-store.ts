import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchMarketCheckListing } from '@/lib/marketcheck/listing-car';
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
 * The onboarded-rooftop directory cannot be read. Callers must treat this as
 * unavailable. It is not an empty in-network list and it is not permission to
 * match on membership alone.
 */
export class RooftopDirectoryUnavailable extends Error {
  readonly status = 503;
  readonly code = 'rooftop_directory_unavailable';

  constructor(message = 'Dealer network is unavailable until rooftop onboarding is in the schema.') {
    super(message);
    this.name = 'RooftopDirectoryUnavailable';
  }
}

/**
 * True when PostgREST or Postgres says `dealerships.onboarded_at` is not in
 * the schema yet, including a stale schema cache. Those errors are unavailable,
 * not a membership list.
 */
export function onboardedColumnMissing(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? '';
  if (!/onboarded_at/i.test(message)) return false;
  return error.code === '42703'
    || error.code === 'PGRST204'
    || /does not exist|schema cache|could not find/i.test(message);
}

function hasOnboardedStamp(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function rooftopFromRow(row: unknown): OnboardedRooftop | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (!hasOnboardedStamp(record.onboarded_at)) return null;
  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) return null;
  return {
    id,
    name: typeof record.name === 'string' ? record.name : '',
    marketcheckDealerId: typeof record.marketcheck_dealer_id === 'string'
      ? record.marketcheck_dealer_id
      : null,
    websiteUrl: typeof record.marketcheck_website_url === 'string'
      ? record.marketcheck_website_url
      : null,
  };
}

function rowsToRooftops(data: unknown): OnboardedRooftop[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const rooftop = rooftopFromRow(row);
    return rooftop ? [rooftop] : [];
  });
}

/**
 * Rooftops that can receive an in-network conversation: a membership whose
 * dealership has `onboarded_at` set. That column is stamped only for an
 * operator create, an accepted invite, or a reviewed membership pair. The
 * service-role client bypasses RLS, so the column filter is what keeps a
 * non-onboarded membership off the network.
 *
 * A missing `onboarded_at` column or a stale schema cache throws
 * `RooftopDirectoryUnavailable`. Memberships are not returned in that case.
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

  const filtered = await supabase
    .from('dealerships')
    .select('id, name, marketcheck_dealer_id, marketcheck_website_url, onboarded_at')
    .in('id', ids)
    .not('onboarded_at', 'is', null);

  if (filtered.error) {
    console.error(JSON.stringify({
      event: 'onboarded_rooftops_failed',
      message: filtered.error.message,
      code: filtered.error.code ?? null,
    }));
    if (onboardedColumnMissing(filtered.error)) {
      throw new RooftopDirectoryUnavailable();
    }
    return [];
  }

  return rowsToRooftops(filtered.data);
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
