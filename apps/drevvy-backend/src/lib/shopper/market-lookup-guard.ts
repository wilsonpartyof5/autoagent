import { createHash, createHmac } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { redactSecrets } from '@/lib/marketcheck/secrets';
import { rateLimitIpKey } from './rate-limit-ip';

/**
 * Bounds paid MarketCheck work on POST /api/consumer/keys/market-save.
 * A failed lookup still refunds the key. These limits stop that refund
 * from funding another paid call: 10 claims per user and 30 per IP hash
 * in 10 minutes, 5 refunded lookups per user in 24 hours, and a 24 hour
 * "no value" mark per listing id. The mark stores the id and a time, not
 * the listing, VIN, or price.
 */

export const MARKET_LOOKUP_USER_LIMIT = 10;
export const MARKET_LOOKUP_IP_LIMIT = 30;
export const MARKET_LOOKUP_WINDOW_MS = 10 * 60 * 1000;
export const MARKET_REFUND_CAP = 5;
export const MARKET_REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MARKET_REFUND_SLOT_MS = 10 * 60 * 1000;
export const MARKET_UPSTREAM_ATTEMPT_MS = 2 * 60 * 1000;
export const MARKET_MISS_TTL_MS = 24 * 60 * 60 * 1000;

export type MarketLookupClaim = {
  action: 'proceed' | 'cached_miss' | 'rate_limited' | 'refund_cap' | 'unavailable';
  scope: 'user' | 'ip' | null;
  hold: boolean;
};

export type MarketLookupGuard = {
  claim(input: { userId: string; ipHash: string; listingId: string; now: number }): Promise<MarketLookupClaim>;
  rememberMiss(listingId: string, now: number): Promise<void>;
  rememberUpstreamAttempt(userId: string, listingId: string, now: number): Promise<void>;
  releaseRefundSlot(userId: string, listingId: string): Promise<void>;
  noteRefund(userId: string, now: number): Promise<void>;
};

type HeaderSource = { get(name: string): string | null };

export function marketLookupFailsClosed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
}

export function shopperClientIp(headers: HeaderSource): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip')?.trim();
  return real || 'unknown';
}

let pepperWarningLogged = false;

export function resetMarketIpPepperWarningForTests(): void {
  pepperWarningLogged = false;
}

export function hashShopperIp(ip: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = rateLimitIpKey(ip);
  const pepper = env.DREVVY_IP_HASH_PEPPER?.trim();
  if (pepper) return createHmac('sha256', pepper).update(key).digest('hex');
  if (!pepperWarningLogged) {
    pepperWarningLogged = true;
    console.error(JSON.stringify({
      event: 'market_ip_hash_pepper_unset',
      message: 'DREVVY_IP_HASH_PEPPER is unset. Market-save IP limits use unsalted sha256.',
    }));
  }
  return createHash('sha256').update(key).digest('hex');
}

export function createMemoryMarketLookupGuard(): MarketLookupGuard {
  const hits: Array<{ userId: string; ipHash: string; at: number }> = [];
  const refunds: Array<{ userId: string; at: number }> = [];
  const misses = new Map<string, number>();
  const slots = new Map<string, number>();
  const upstream = new Map<string, number>();
  const slotKey = (userId: string, listingId: string) => `${userId}\n${listingId}`;

  return {
    async claim(input) {
      const userHits = hits.filter((hit) => hit.userId === input.userId && input.now - hit.at < MARKET_LOOKUP_WINDOW_MS);
      if (userHits.length >= MARKET_LOOKUP_USER_LIMIT) {
        return { action: 'rate_limited', scope: 'user', hold: false };
      }
      const ipHits = hits.filter((hit) => hit.ipHash === input.ipHash && input.now - hit.at < MARKET_LOOKUP_WINDOW_MS);
      if (ipHits.length >= MARKET_LOOKUP_IP_LIMIT) {
        return { action: 'rate_limited', scope: 'ip', hold: false };
      }
      hits.push({ userId: input.userId, ipHash: input.ipHash, at: input.now });
      const missedAt = misses.get(input.listingId);
      if (missedAt != null && input.now - missedAt < MARKET_MISS_TTL_MS) {
        return { action: 'cached_miss', scope: null, hold: false };
      }
      const attemptAt = upstream.get(slotKey(input.userId, input.listingId));
      if (attemptAt != null && input.now - attemptAt < MARKET_UPSTREAM_ATTEMPT_MS) {
        return { action: 'rate_limited', scope: 'user', hold: false };
      }
      const recentRefunds = refunds.filter((refund) => (
        refund.userId === input.userId && input.now - refund.at < MARKET_REFUND_WINDOW_MS
      ));
      const openSlots = [...slots.entries()].filter(([key, at]) => (
        key.startsWith(`${input.userId}\n`)
        && !key.endsWith(`\n${input.listingId}`)
        && input.now - at < MARKET_REFUND_SLOT_MS
      ));
      if (recentRefunds.length + openSlots.length >= MARKET_REFUND_CAP) {
        return { action: 'refund_cap', scope: null, hold: false };
      }
      const ownSlot = slots.get(slotKey(input.userId, input.listingId));
      if (ownSlot != null && input.now - ownSlot < MARKET_REFUND_SLOT_MS) {
        return { action: 'rate_limited', scope: 'user', hold: false };
      }
      slots.set(slotKey(input.userId, input.listingId), input.now);
      return { action: 'proceed', scope: null, hold: false };
    },
    async rememberMiss(listingId, now) {
      misses.set(listingId, now);
    },
    async rememberUpstreamAttempt(userId, listingId, now) {
      upstream.set(slotKey(userId, listingId), now);
    },
    async releaseRefundSlot(userId, listingId) {
      slots.delete(slotKey(userId, listingId));
    },
    async noteRefund(userId, now) {
      refunds.push({ userId, at: now });
    },
  };
}

const PROCEED: MarketLookupClaim = { action: 'proceed', scope: null, hold: false };

export async function claimDurableMarketLookup(
  supabase: SupabaseClient,
  input: { userId: string; ipHash: string; listingId: string },
  options: { failClosed: boolean },
): Promise<MarketLookupClaim> {
  const { data, error } = await supabase.rpc('claim_market_save_lookup', {
    p_user_id: input.userId,
    p_ip_hash: input.ipHash,
    p_listing_id: input.listingId,
  });
  if (error) {
    console.error(JSON.stringify({
      event: 'market_lookup_guard_failed',
      listingId: input.listingId,
      message: redactSecrets(error.message ?? 'unknown'),
    }));
    return options.failClosed ? { action: 'unavailable', scope: null, hold: false } : PROCEED;
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    action?: string;
    scope?: string | null;
    hold?: boolean;
  } | null | undefined;
  const action = row?.action;
  if (
    action === 'proceed'
    || action === 'cached_miss'
    || action === 'rate_limited'
    || action === 'refund_cap'
    || action === 'unavailable'
  ) {
    const scope = row?.scope === 'user' || row?.scope === 'ip' ? row.scope : null;
    return { action, scope, hold: row?.hold === true };
  }
  return options.failClosed ? { action: 'unavailable', scope: null, hold: false } : PROCEED;
}

export async function rememberDurableMarketMiss(supabase: SupabaseClient, listingId: string): Promise<void> {
  const { error } = await supabase.rpc('remember_market_listing_miss', { p_listing_id: listingId });
  if (error) {
    console.error(JSON.stringify({
      event: 'market_listing_miss_unrecorded',
      listingId,
      message: redactSecrets(error.message ?? 'unknown'),
    }));
  }
}

export async function rememberDurableUpstreamAttempt(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<void> {
  const { error } = await supabase.rpc('remember_market_upstream_attempt', {
    p_user_id: userId,
    p_listing_id: listingId,
  });
  if (error) {
    console.error(JSON.stringify({
      event: 'market_upstream_attempt_unrecorded',
      listingId,
      message: redactSecrets(error.message ?? 'unknown'),
    }));
  }
}

export async function releaseDurableRefundSlot(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<void> {
  const { error } = await supabase.rpc('release_market_save_refund_slot', {
    p_user_id: userId,
    p_listing_id: listingId,
  });
  if (error) {
    console.error(JSON.stringify({
      event: 'market_refund_slot_unreleased',
      listingId,
      message: redactSecrets(error.message ?? 'unknown'),
    }));
  }
}

export function durableMarketLookupGuard(
  supabase: SupabaseClient,
  options: { failClosed: boolean },
): MarketLookupGuard {
  return {
    claim: (input) => claimDurableMarketLookup(supabase, input, options),
    rememberMiss: (listingId) => rememberDurableMarketMiss(supabase, listingId),
    rememberUpstreamAttempt: (userId, listingId) => rememberDurableUpstreamAttempt(supabase, userId, listingId),
    releaseRefundSlot: (userId, listingId) => releaseDurableRefundSlot(supabase, userId, listingId),
    noteRefund: async () => undefined,
  };
}
