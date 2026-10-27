import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import { ShopperDealError, isShopperListingId } from './deals';
import {
  resolveRooftopMatch,
  type RooftopDirectory,
} from '@/lib/dealer/rooftop-store';
import {
  normalizeHost,
  normalizeMarketcheckDealerId,
  type ListingDealerIdentity,
} from '@/lib/dealer/rooftop-match';
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

export async function requestOffNetworkOtd(
  userId: string,
  body: unknown,
  deps: {
    now: Date;
    repo: OtdRequestRepository;
    rooftops: RooftopDirectory;
  },
): Promise<OtdRequestResult> {
  const identity = readListingIdentityBody(body);
  const listingId = identity.listingId;
  if (!listingId || !isShopperListingId(listingId)) {
    throw new ShopperDealError('A MarketCheck listing id is required.', 400, 'invalid_listing');
  }

  const match = await resolveRooftopMatch(identity, deps.rooftops);
  if (match.matched) {
    throw new ShopperDealError(
      'This rooftop is on Drevvy. Use a conversation key to chat with the salesperson.',
      409,
      'in_network',
    );
  }

  const existing = await deps.repo.find(userId, listingId);
  if (existing) return { request: existing, created: false };

  const fetched = identity.listingId && deps.rooftops.loadListingIdentity
    ? await deps.rooftops.loadListingIdentity(identity.listingId)
    : null;
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
  return { request: saved, created: saved.id === id };
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
