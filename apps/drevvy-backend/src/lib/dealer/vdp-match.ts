/**
 * Persist an in-network VDP match so conversation key spends can stamp
 * `vdp_match_id`. Analytics `drevvy_conversation_key_guard` requires that
 * id to point at a `drevvy_vdp_matches` row with network_status = in_network.
 */

import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  normalizeHost,
  type MatchMethod,
  type RooftopMatch,
} from './rooftop-match';

export const VDP_MATCHER_VERSION = 'drevvy-backend-1';

export type AnalyticsMatchMethod = 'exact_url' | 'domain' | 'dealer_map' | 'none';

export function analyticsMatchMethod(method: MatchMethod): AnalyticsMatchMethod {
  if (method === 'listing_url') return 'exact_url';
  if (method === 'dealer_domain') return 'domain';
  return 'dealer_map';
}

export function vdpUrlHash(listingUrl: string | null | undefined, listingId: string): string {
  const source = listingUrl?.trim() ? listingUrl.trim().toLowerCase() : `listing:${listingId}`;
  return createHash('sha256').update(source).digest('hex');
}

export async function recordInNetworkVdpMatch(
  supabase: SupabaseClient,
  input: {
    listingId: string;
    listingUrl?: string | null;
    match: Extract<RooftopMatch, { matched: true }>;
  },
): Promise<string | null> {
  const row = {
    listing_id: input.listingId,
    url_hash: vdpUrlHash(input.listingUrl, input.listingId),
    url_domain: normalizeHost(input.listingUrl) ?? normalizeHost(input.match.rooftop.websiteUrl),
    match_method: analyticsMatchMethod(input.match.method),
    dealership_id: input.match.rooftop.id,
    network_status: 'in_network' as const,
    matcher_version: VDP_MATCHER_VERSION,
  };

  const { data, error } = await supabase
    .from('drevvy_vdp_matches')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error(JSON.stringify({
      event: 'vdp_match_record_failed',
      listingId: input.listingId,
      message: error.message,
    }));
    return null;
  }

  return typeof data?.id === 'string' ? data.id : null;
}
