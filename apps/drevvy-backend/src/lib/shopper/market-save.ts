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
  isMissingMarketSchema,
  refundUnstoredMarketSave,
  reserveMarketSaveKey,
  type CommitMarketUnlockInput,
  type CommitMarketUnlockResult,
  type MarketKeyHold,
  type MarketKeyRefund,
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
  reserveKey?: (userId: string, listingId: string) => Promise<MarketKeyHold>;
  refundKey?: (userId: string, listingId: string) => Promise<MarketKeyRefund>;
  profileZip?: (userId: string) => Promise<string | null>;
};

const NO_KEY_MESSAGE = 'You need a key to unlock market details and save this car. Buy a key pack to continue.';
const CREDIT_FAILED_MESSAGE = 'Drevvy could not use a key to unlock market details and save this car.';
const UNLOCK_WAIT_ATTEMPTS = 40;
const UNLOCK_WAIT_MS = 25;

/**
 * Unlocks Marketplace Intelligence and saves the listing.
 * The key is held before any paid MarketCheck call. A lookup that does not
 * return a real value gives that key back and clears the idempotency key,
 * so the next attempt is charged again. A repeat of a stored unlock does
 * not spend and does not call MarketCheck. A heart save does not call this.
 *
 * Before shopper_market_unlocks exists, this saves the car and does not
 * call MarketCheck Price or spend a key.
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
  let existing: StoredMarketUnlock | null;
  try {
    existing = await find(userId, input.listingId);
  } catch (error) {
    if (isMissingMarketSchema(error)) return saveWithoutMarket(userId, body, deps);
    throw error;
  }
  if (existing) {
    const car = await saveSavedCar(userId, body, deps);
    const credits = await getShopperCredits(deps.supabase, userId);
    return unlockedResult(car, false, credits.balance, existing.market);
  }

  const reserve = deps.reserveKey ?? ((ownerId, listingId) => reserveMarketSaveKey(deps.supabase, ownerId, listingId));
  const refund = deps.refundKey ?? ((ownerId, listingId) => refundUnstoredMarketSave(deps.supabase, ownerId, listingId));
  const held = await reserve(userId, input.listingId);
  if (!held.ok) {
    if (held.failed) throw new ShopperDealError(CREDIT_FAILED_MESSAGE, 500, 'credit_failed');
    throw new ShopperDealError(NO_KEY_MESSAGE, 402, 'no_credits');
  }

  if (held.already) {
    const raced = await waitForUnlock(find, userId, input.listingId);
    if (raced) {
      const car = await saveSavedCar(userId, body, deps);
      const credits = await getShopperCredits(deps.supabase, userId);
      return unlockedResult(car, false, credits.balance, raced.market);
    }
    const credits = await getShopperCredits(deps.supabase, userId);
    return unavailableResult(credits.balance);
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
    const restored = await refund(userId, input.listingId);
    return unavailableResult(restored.balance);
  }

  const commit = deps.commitUnlock ?? ((unlock) => commitMarketUnlock(deps.supabase, unlock));
  let committed: CommitMarketUnlockResult;
  try {
    committed = await commit({
      userId,
      listingId: input.listingId,
      vin: input.vin ?? null,
      market: intel,
    });
  } catch (error) {
    // The hold already committed in its own call. Give the key back when
    // this write did not store a snapshot. A stored unlock makes the refund
    // a no-op, so a lost response cannot double-credit a paid unlock.
    await refund(userId, input.listingId);
    if (isMissingMarketSchema(error)) return saveWithoutMarket(userId, body, deps);
    throw error;
  }

  if (!committed.unlocked || !committed.market) {
    const restored = await refund(userId, input.listingId);
    if (committed.error === 'no_value') return unavailableResult(restored.balance);
    if (committed.error === 'no_credits') {
      throw new ShopperDealError(NO_KEY_MESSAGE, 402, 'no_credits');
    }
    throw new ShopperDealError(CREDIT_FAILED_MESSAGE, 500, 'credit_failed');
  }

  const car = await saveSavedCar(userId, body, deps);
  return unlockedResult(car, true, committed.balance, committed.market);
}

/** Heart-save behavior used until the unlock table and zip column exist. */
async function saveWithoutMarket(
  userId: string,
  body: unknown,
  deps: MarketSaveDeps,
): Promise<MarketSaveResult> {
  const car = await saveSavedCar(userId, body, deps);
  const credits = await getShopperCredits(deps.supabase, userId);
  return {
    car,
    spent: false,
    available: false,
    unlocked: false,
    reason: 'market_unavailable',
    message: MARKET_UNAVAILABLE_MESSAGE,
    credits: creditView(credits.balance),
    market: null,
  };
}

async function waitForUnlock(
  find: (userId: string, listingId: string) => Promise<StoredMarketUnlock | null>,
  userId: string,
  listingId: string,
): Promise<StoredMarketUnlock | null> {
  for (let attempt = 0; attempt < UNLOCK_WAIT_ATTEMPTS; attempt += 1) {
    const row = await find(userId, listingId);
    if (row) return row;
    if (attempt + 1 < UNLOCK_WAIT_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, UNLOCK_WAIT_MS));
    }
  }
  return null;
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
