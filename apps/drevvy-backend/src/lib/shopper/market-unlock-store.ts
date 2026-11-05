import type { SupabaseClient } from '@supabase/supabase-js';

import {
  marketIntelFromUnknown,
  presentMarketIntel,
  type MarketIntel,
} from './market-intel';

/**
 * Owner-only Marketplace Intelligence unlock.
 * Distinct from saved_cars: a heart save does not write this row, and
 * deleting the heart does not delete it.
 */

export type StoredMarketUnlock = {
  listingId: string;
  vin: string | null;
  unlockedAt: string;
  market: MarketIntel;
};

export type CommitMarketUnlockInput = {
  userId: string;
  listingId: string;
  vin: string | null;
  market: MarketIntel;
};

export type CommitMarketUnlockResult = {
  unlocked: boolean;
  alreadyUnlocked: boolean;
  charged: boolean;
  balance: number;
  market: MarketIntel | null;
  error?: 'no_credits' | 'credit_failed' | 'no_value';
};

export async function findMarketUnlock(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<StoredMarketUnlock | null> {
  const { data, error } = await supabase
    .from('shopper_market_unlocks')
    .select('listing_id, vin, market, unlocked_at')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  const market = marketIntelFromUnknown(data.market);
  if (!market) return null;
  return {
    listingId: typeof data.listing_id === 'string' ? data.listing_id : listingId,
    vin: typeof data.vin === 'string' ? data.vin : null,
    unlockedAt: typeof data.unlocked_at === 'string' ? data.unlocked_at : new Date(0).toISOString(),
    market,
  };
}

export async function commitMarketUnlock(
  supabase: SupabaseClient,
  input: CommitMarketUnlockInput,
): Promise<CommitMarketUnlockResult> {
  const { data, error } = await supabase.rpc('unlock_market_intel_atomic', {
    p_user_id: input.userId,
    p_listing_id: input.listingId,
    p_vin: input.vin,
    p_market: presentMarketIntel(input.market),
  });

  if (error) {
    const message = error.message ?? '';
    if (/no value|listing id is required|vin is not valid/i.test(message)) {
      return {
        unlocked: false,
        alreadyUnlocked: false,
        charged: false,
        balance: 0,
        market: null,
        error: 'no_value',
      };
    }
    console.error(JSON.stringify({
      event: 'market_unlock_failed',
      listingId: input.listingId,
      message,
    }));
    return {
      unlocked: false,
      alreadyUnlocked: false,
      charged: false,
      balance: 0,
      market: null,
      error: 'credit_failed',
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    unlocked?: boolean;
    already_unlocked?: boolean;
    charged?: boolean;
    balance?: number;
    market?: unknown;
  } | null | undefined;

  const unlocked = row?.unlocked === true;
  const market = marketIntelFromUnknown(row?.market);
  if (!unlocked) {
    return {
      unlocked: false,
      alreadyUnlocked: false,
      charged: false,
      balance: row?.balance ?? 0,
      market: null,
      error: 'no_credits',
    };
  }

  return {
    unlocked: true,
    alreadyUnlocked: row?.already_unlocked === true,
    charged: row?.charged === true,
    balance: row?.balance ?? 0,
    market,
    error: market ? undefined : 'no_value',
  };
}
