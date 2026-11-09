import type { SupabaseClient } from '@supabase/supabase-js';

import { callMcpTool } from '@/lib/marketcheck/mcp-client';

import {
  matchOnboardedRooftop,
  mergeListingIdentity,
  type ListingDealerIdentity,
  type OnboardedRooftop,
  type RooftopMatch,
} from './rooftop-match';

export type RooftopDirectory = {
  listOnboardedRooftops: () => Promise<OnboardedRooftop[]>;
  loadListingIdentity?: (listingId: string) => Promise<ListingDealerIdentity | null>;
};

export function supabaseRooftopDirectory(supabase: SupabaseClient): RooftopDirectory {
  return {
    listOnboardedRooftops: () => loadOnboardedRooftops(supabase),
    loadListingIdentity: (listingId) => fetchListingDealerIdentity(listingId),
  };
}

/**
 * True when PostgREST or Postgres says `dealerships.onboarded_at` is not in
 * the schema yet. Any other failure stays fail-closed.
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

function rooftopFromRow(row: unknown, enforceOnboarded: boolean): OnboardedRooftop | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (enforceOnboarded && !hasOnboardedStamp(record.onboarded_at)) return null;
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

function rowsToRooftops(data: unknown, enforceOnboarded: boolean): OnboardedRooftop[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const rooftop = rooftopFromRow(row, enforceOnboarded);
    return rooftop ? [rooftop] : [];
  });
}

/**
 * Rooftops that can receive an in-network conversation: a membership whose
 * dealership has `onboarded_at` set. The service-role client bypasses RLS,
 * so the column filter is what keeps a non-onboarded membership off the network.
 *
 * Until the migration that adds the column is applied, a missing-column error
 * falls back to membership-only so a code deploy does not mark every listing
 * off-network. After the column exists, a null stamp is excluded.
 *
 * TODO: remove the membership-only fallback after
 * 20261109170000_lock_rooftop_self_claim.sql is applied. Apply that migration
 * before or with this code deploy, then delete the onboarded_column_missing branch.
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

  if (filtered.error && onboardedColumnMissing(filtered.error)) {
    // TODO: remove this membership-only fallback after
    // 20261109170000_lock_rooftop_self_claim.sql is applied. Apply that
    // migration before or with the code deploy. A missing onboarded_at column
    // currently keeps the previous membership list.
    console.error(JSON.stringify({
      event: 'onboarded_column_missing',
      message: filtered.error.message,
    }));
    const legacy = await supabase
      .from('dealerships')
      .select('id, name, marketcheck_dealer_id, marketcheck_website_url')
      .in('id', ids);
    if (legacy.error) {
      console.error(JSON.stringify({
        event: 'onboarded_rooftops_failed',
        message: legacy.error.message,
      }));
      return [];
    }
    return rowsToRooftops(legacy.data, false);
  }

  if (filtered.error) {
    console.error(JSON.stringify({
      event: 'onboarded_rooftops_failed',
      message: filtered.error.message,
    }));
    return [];
  }

  return rowsToRooftops(filtered.data, true);
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

export async function fetchListingDealerIdentity(
  listingId: string,
  vin?: string,
): Promise<ListingDealerIdentity | null> {
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
    const identity = identityFromMarketCheckListing(listing);
    if (!identity) return { listingId };
    return { ...identity, listingId: identity.listingId ?? listingId };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'listing_identity_failed',
      listingId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return { listingId };
  }
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
