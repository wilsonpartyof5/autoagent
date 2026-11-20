import type { SupabaseClient } from '@supabase/supabase-js';

import { getShopperCredits, spendMarketSaveKey } from './credits';
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

export type MarketKeyHold = {
  ok: boolean;
  already: boolean;
  balance: number;
  /** The credit RPC failed. This is not an empty balance. */
  failed?: boolean;
};

export type MarketKeyRefund = {
  refunded: boolean;
  balance: number;
};

/**
 * True when the unlock table or its charge/refund functions are not in this
 * database yet. Profile and save use this to keep the pre-migration behavior.
 */
export function isMissingMarketSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { message?: string; code?: string };
  const code = record.code ?? '';
  const message = (record.message ?? '').toLowerCase();
  const missingObject = code === '42P01'
    || code === '42883'
    || code === 'PGRST202'
    || code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find the table')
    || message.includes('could not find the function');
  if (!missingObject) return false;
  return message.includes('shopper_market_unlock')
    || message.includes('unlock_market_intel')
    || message.includes('refund_unstored_market')
    || code === '42P01'
    || code === '42883'
    || code === 'PGRST202'
    || code === 'PGRST205';
}

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
    if (isMissingMarketSchema(error)) {
      throw Object.assign(new Error(error.message), { code: error.code });
    }
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
    if (isMissingMarketSchema(error)) {
      throw Object.assign(new Error(error.message), { code: error.code });
    }
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

/** Spends the market-save key before a paid lookup. A repeat hold does not spend again. */
export async function reserveMarketSaveKey(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<MarketKeyHold> {
  const spent = await spendMarketSaveKey(supabase, userId, listingId);
  if (!spent.success) {
    return {
      ok: false,
      already: false,
      balance: spent.newBalance,
      failed: spent.error === 'credit_failed',
    };
  }
  return { ok: true, already: spent.alreadyConsumed, balance: spent.newBalance };
}

/**
 * Gives back a market-save key when the lookup produced nothing to store.
 * Clears the idempotency key so the next attempt is charged, not free.
 */
export async function refundUnstoredMarketSave(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<MarketKeyRefund> {
  const { data, error } = await supabase.rpc('refund_unstored_market_save', {
    p_user_id: userId,
    p_listing_id: listingId,
  });
  if (error) {
    console.error(JSON.stringify({
      event: 'market_save_refund_failed',
      listingId,
      message: error.message,
    }));
    const credits = await getShopperCredits(supabase, userId);
    return { refunded: false, balance: credits.balance };
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    refunded?: boolean;
    balance?: number;
  } | null | undefined;
  return {
    refunded: row?.refunded === true,
    balance: row?.balance ?? 0,
  };
}
