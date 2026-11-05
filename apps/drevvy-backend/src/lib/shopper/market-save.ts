import type { SupabaseClient } from '@supabase/supabase-js';

import { redactSecrets } from '@/lib/marketcheck/secrets';

import { getShopperCredits } from './credits';
import { ShopperDealError } from './deals';
import {
  loadMarketIntelFromMarketCheck,
  marketIntelHasValue,
  type MarketIntel,
} from './market-intel';
import {
  commitMarketUnlock,
  findMarketUnlock,
  type CommitMarketUnlockInput,
  type CommitMarketUnlockResult,
  type StoredMarketUnlock,
} from './market-unlock-store';
import { readSaveCarInput, saveSavedCar, type SavedCarDeps, type SavedCarView } from './saved-cars';

export const MARKET_UNAVAILABLE_MESSAGE =
  'Market intelligence is not available for this listing. A key was not used.';

export type MarketSaveResult = {
  car: SavedCarView | null;
  spent: boolean;
  available: boolean;
  unlocked: boolean;
  reason: 'ok' | 'market_unavailable';
  message: string | null;
  credits: {
    balance: number;
    canAdd: boolean;
    reason: 'ok' | 'no_credits';
  };
  market: MarketIntel | null;
};

export type MarketIntelLoader = (input: {
  listingId: string;
  vin: string | null;
  profileZip: string | null;
}) => Promise<MarketIntel | null>;

export type MarketSaveDeps = SavedCarDeps & {
  supabase: SupabaseClient;
  loadMarketIntel?: MarketIntelLoader;
  findUnlock?: (userId: string, listingId: string) => Promise<StoredMarketUnlock | null>;
  commitUnlock?: (input: CommitMarketUnlockInput) => Promise<CommitMarketUnlockResult>;
  profileZip?: (userId: string) => Promise<string | null>;
};

/**
 * Unlocks Marketplace Intelligence and saves the listing.
 * One key per listing, and only after MarketCheck returns a real value.
 * A repeat returns the stored snapshot and does not spend again.
 * A heart save does not call this.
 */
export async function unlockMarketAndSave(
  userId: string,
  body: unknown,
  deps: MarketSaveDeps,
): Promise<MarketSaveResult> {
  const input = readSaveCarInput(body);
  if (input.movedToDealId) {
    const owns = await deps.ownsDeal(userId, input.movedToDealId);
    if (!owns) throw new ShopperDealError('Deal not found.', 404, 'not_found');
  }

  const find = deps.findUnlock ?? ((ownerId, listingId) => findMarketUnlock(deps.supabase, ownerId, listingId));
  const existing = await find(userId, input.listingId);
  if (existing) {
    const car = await saveSavedCar(userId, body, deps);
    const credits = await getShopperCredits(deps.supabase, userId);
    return unlockedResult(car, false, credits.balance, existing.market);
  }

  const load = deps.loadMarketIntel ?? loadMarketIntelFromMarketCheck;
  const zipOf = deps.profileZip ?? ((ownerId) => readProfileZip(deps.supabase, ownerId));
  let profileZip: string | null = null;
  try {
    profileZip = await zipOf(userId);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'market_intel_zip_failed',
      listingId: input.listingId,
      message: redactSecrets(error instanceof Error ? error.message : 'unknown'),
    }));
  }

  let intel: MarketIntel | null = null;
  try {
    intel = await load({
      listingId: input.listingId,
      vin: input.vin ?? null,
      profileZip,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'market_intel_unavailable',
      listingId: input.listingId,
      message: redactSecrets(error instanceof Error ? error.message : 'unknown'),
    }));
    intel = null;
  }

  if (!marketIntelHasValue(intel)) {
    const credits = await getShopperCredits(deps.supabase, userId);
    return unavailableResult(credits.balance);
  }

  const commit = deps.commitUnlock ?? ((unlock) => commitMarketUnlock(deps.supabase, unlock));
  const committed = await commit({
    userId,
    listingId: input.listingId,
    vin: input.vin ?? null,
    market: intel,
  });

  if (committed.error === 'credit_failed' || (committed.unlocked && !committed.market)) {
    throw new ShopperDealError(
      'Drevvy could not use a key to unlock market details and save this car.',
      500,
      'credit_failed',
    );
  }
  if (!committed.unlocked || !committed.market) {
    if (committed.error === 'no_value') {
      const credits = await getShopperCredits(deps.supabase, userId);
      return unavailableResult(credits.balance);
    }
    throw new ShopperDealError(
      'You need a key to unlock market details and save this car. Buy a key pack to continue.',
      402,
      'no_credits',
    );
  }

  const car = await saveSavedCar(userId, body, deps);
  return unlockedResult(car, committed.charged, committed.balance, committed.market);
}

async function readProfileZip(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('consumer_profiles')
    .select('zip')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || typeof data.zip !== 'string') return null;
  const match = data.zip.match(/^\d{5}$/);
  return match ? data.zip : null;
}

function unlockedResult(
  car: SavedCarView,
  spent: boolean,
  balance: number,
  market: MarketIntel,
): MarketSaveResult {
  return {
    car,
    spent,
    available: true,
    unlocked: true,
    reason: 'ok',
    message: null,
    credits: creditView(balance),
    market,
  };
}

function unavailableResult(balance: number): MarketSaveResult {
  return {
    car: null,
    spent: false,
    available: false,
    unlocked: false,
    reason: 'market_unavailable',
    message: MARKET_UNAVAILABLE_MESSAGE,
    credits: creditView(balance),
    market: null,
  };
}

function creditView(balance: number): MarketSaveResult['credits'] {
  return {
    balance,
    canAdd: balance > 0,
    reason: balance > 0 ? 'ok' : 'no_credits',
  };
}
