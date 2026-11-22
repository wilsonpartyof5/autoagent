import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import { ShopperDealError, isShopperListingId } from './deals';
import { readListingIdentityCache } from '@/lib/dealer/listing-rooftop-cache';
import {
  resolveRooftopMatch,
  type RooftopDirectory,
} from '@/lib/dealer/rooftop-store';
import {
  normalizeHost,
  normalizeMarketcheckDealerId,
  type ListingDealerIdentity,
} from '@/lib/dealer/rooftop-match';
import {
  ListingCarLimitUnavailable,
  ListingCarRateLimited,
} from '@/lib/marketcheck/listing-car-limit';
import type { RateLimitStore } from '@/lib/public-discover/rate-limit';
import { enforceOtdPostLimit } from './off-network-lookup-limit';
import {
  recordSubmittedAnalyticsSafely,
  type OtdAnalytics,
} from './otd-analytics';
import { readListingIdentityBody } from './vdp-ctas';

export type OffNetworkOtdRequest = {
  id: string;
  userId: string;
  listingId: string;
  listingUrl: string | null;
  dealerDomain: string | null;
  marketcheckDealerId: string | null;
  createdAt: string;
};

export interface OtdRequestRepository {
  find(userId: string, listingId: string): Promise<OffNetworkOtdRequest | null>;
  insert(row: OffNetworkOtdRequest): Promise<OffNetworkOtdRequest>;
}

export type OtdRequestResult = {
  request: OffNetworkOtdRequest;
  created: boolean;
};

export function memoryOtdRequestRepository(): OtdRequestRepository & { rows: OffNetworkOtdRequest[] } {
  const rows: OffNetworkOtdRequest[] = [];
  return {
    rows,
    async find(userId, listingId) {
      return rows.find((row) => row.userId === userId && row.listingId === listingId) ?? null;
    },
    async insert(row) {
      const existing = rows.find((item) => item.userId === row.userId && item.listingId === row.listingId);
      if (existing) return existing;
      rows.push(row);
      return row;
    },
  };
}

export function supabaseOtdRequestRepository(supabase: SupabaseClient): OtdRequestRepository {
  return {
    async find(userId, listingId) {
      const { data, error } = await supabase
        .from('off_network_otd_requests')
        .select('id, consumer_user_id, listing_id, listing_url, dealer_domain, marketcheck_dealer_id, created_at')
        .eq('consumer_user_id', userId)
        .eq('listing_id', listingId)
        .maybeSingle();
      if (error) {
        console.error(JSON.stringify({ event: 'otd_request_read_failed', message: error.message }));
        return null;
      }
      return data ? fromRow(data) : null;
    },
    async insert(row) {
      const { data, error } = await supabase
        .from('off_network_otd_requests')
        .insert({
          id: row.id,
          consumer_user_id: row.userId,
          listing_id: row.listingId,
          listing_url: row.listingUrl,
          dealer_domain: row.dealerDomain,
          marketcheck_dealer_id: row.marketcheckDealerId,
          created_at: row.createdAt,
        })
        .select('id, consumer_user_id, listing_id, listing_url, dealer_domain, marketcheck_dealer_id, created_at')
        .maybeSingle();
      if (error) {
        if (error.code === '23505') {
          const again = await this.find(row.userId, row.listingId);
          if (again) return again;
        }
        throw new ShopperDealError('Drevvy could not save this out-the-door request.', 500, 'otd_request_failed');
      }
      return data ? fromRow(data) : row;
    },
  };
}

/**
 * Accept the canonical body plus the live iOS alias:
 * `{ listingId, listingUrl? }` or `{ listingId, url? }` and a path listing id.
 */
export function otdRequestBodyFromHttp(body: unknown, listingIdFromPath?: string): unknown {
  const record: Record<string, unknown> = (
    body && typeof body === 'object' && !Array.isArray(body)
  )
    ? { ...(body as Record<string, unknown>) }
    : {};
  if (listingIdFromPath && record.listingId == null) record.listingId = listingIdFromPath;
  if (record.listingUrl == null && typeof record.url === 'string') {
    record.listingUrl = record.url;
  }
  return record;
}

export async function requestOffNetworkOtd(
  userId: string,
  body: unknown,
  deps: {
    now: Date;
    repo: OtdRequestRepository;
    rooftops: RooftopDirectory;
    analytics?: OtdAnalytics;
    rateLimitStore?: RateLimitStore;
    rateLimitEnv?: NodeJS.ProcessEnv;
  },
): Promise<OtdRequestResult> {
  const identity = readListingIdentityBody(body);
  const listingId = identity.listingId;
  if (!listingId || !isShopperListingId(listingId)) {
    throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
  }

  const nowMs = deps.now.getTime();
  await enforceOtdPostLimit({
    userId,
    nowMs,
    store: deps.rateLimitStore,
    env: deps.rateLimitEnv,
  });

  let match;
  try {
    match = await resolveRooftopMatch(identity, deps.rooftops, { nowMs });
  } catch (error) {
    if (error instanceof ListingCarRateLimited) {
      throw new ShopperDealError('Slow down a little. Try again tomorrow.', 429, 'rate_limited');
    }
    if (error instanceof ListingCarLimitUnavailable) {
      throw new ShopperDealError(
        'Drevvy could not check that dealership. Try again in a minute.',
        503,
        'rate_limit_unavailable',
      );
    }
    throw error;
  }
  if (match.matched) {
    throw new ShopperDealError(
      'This rooftop is on Drevvy. Use a conversation key to chat with the salesperson.',
      409,
      'in_network',
    );
  }

  const existing = await deps.repo.find(userId, listingId);
  if (existing) return { request: existing, created: false };

  const cached = readListingIdentityCache(listingId, nowMs);
  let fetched: ListingDealerIdentity | null = cached?.kind === 'found' ? cached.identity : null;
  if (!cached && !deps.rooftops.lookupListingIdentity && deps.rooftops.loadListingIdentity) {
    fetched = await deps.rooftops.loadListingIdentity(listingId);
  }
  const merged: ListingDealerIdentity = {
    listingId,
    listingUrl: identity.listingUrl ?? fetched?.listingUrl ?? null,
    dealerWebsite: fetched?.dealerWebsite ?? null,
    marketcheckDealerId: fetched?.marketcheckDealerId ?? null,
  };

  const id = randomUUID();
  const saved = await deps.repo.insert({
    id,
    userId,
    listingId,
    listingUrl: merged.listingUrl ?? null,
    dealerDomain: normalizeHost(merged.dealerWebsite ?? merged.listingUrl),
    marketcheckDealerId: normalizeMarketcheckDealerId(merged.marketcheckDealerId),
    createdAt: deps.now.toISOString(),
  });
  const created = saved.id === id;
  if (created) {
    // Twin + JE are additive. Soft-fail so a shopper OTD still succeeds if
    // analytics writes fail (including before the service_role wrappers exist).
    await recordSubmittedAnalyticsSafely(deps.analytics, {
      userId,
      request: saved,
      vdpMatchId: null,
      drevvyDealerId: null,
      region: null,
    });
  }
  return { request: saved, created };
}

function fromRow(row: {
  id: string;
  consumer_user_id: string;
  listing_id: string;
  listing_url: string | null;
  dealer_domain: string | null;
  marketcheck_dealer_id: string | null;
  created_at: string;
}): OffNetworkOtdRequest {
  return {
    id: row.id,
    userId: row.consumer_user_id,
    listingId: row.listing_id,
    listingUrl: row.listing_url,
    dealerDomain: row.dealer_domain,
    marketcheckDealerId: row.marketcheck_dealer_id,
    createdAt: row.created_at,
  };
}
