import type { SupabaseClient } from '@supabase/supabase-js';

import { MarketCheckUpstreamError, McpQuotaError, McpRateLimitError } from '@/lib/marketcheck/mcp-client';
import { redactSecrets } from '@/lib/marketcheck/secrets';

import { getShopperCredits } from './credits';
import { ShopperDealError } from './deals';
import {
  durableMarketLookupGuard,
  hashShopperIp,
  type MarketLookupGuard,
} from './market-lookup-guard';
import {
  asMarketIntelLookup,
  loadMarketIntelFromMarketCheck,
  marketIntelHasValue,
  type MarketIntel,
  type MarketIntelLookup,
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
}) => Promise<MarketIntel | MarketIntelLookup | null>;

export type MarketSaveDeps = SavedCarDeps & {
  supabase: SupabaseClient;
  loadMarketIntel?: MarketIntelLoader;
  findUnlock?: (userId: string, listingId: string) => Promise<StoredMarketUnlock | null>;
  commitUnlock?: (input: CommitMarketUnlockInput) => Promise<CommitMarketUnlockResult>;
  reserveKey?: (userId: string, listingId: string) => Promise<MarketKeyHold>;
  refundKey?: (userId: string, listingId: string) => Promise<MarketKeyRefund>;
  profileZip?: (userId: string) => Promise<string | null>;
  lookupGuard?: MarketLookupGuard;
  ipHash?: string;
  /** Production refuses a paid lookup when the limiter cannot be checked. */
  failClosed?: boolean;
  unlockWaitAttempts?: number;
  unlockWaitMs?: number;
};

const NO_KEY_MESSAGE = 'You need a key to unlock market details and save this car. Buy a key pack to continue.';
const CREDIT_FAILED_MESSAGE = 'Drevvy could not use a key to unlock market details and save this car.';
const RATE_LIMIT_MESSAGE = 'Too many market lookups. Try again in a few minutes.';
const REFUND_CAP_MESSAGE = 'Market lookups are paused until tomorrow. A key was not used.';
const GUARD_UNAVAILABLE_MESSAGE = 'Market details are unavailable right now.';
const MARKET_HELD_MESSAGE = 'Market intelligence is not available yet. The next try finishes the unlock already on hold.';
const UNLOCK_WAIT_ATTEMPTS = 40;
const UNLOCK_WAIT_MS = 25;

/**
 * Unlocks Marketplace Intelligence and saves the listing.
 * The key is held before any paid MarketCheck call. A lookup that does not
 * return a real value refunds that key and writes a reversal, so the next
 * attempt is charged again. The claim reserves a refund slot first. A
 * listing with no value is not looked up again for 24 hours only when that
 * listing was found, the ids match, the shopper sent no VIN, and MarketCheck
 * did not fail. A 402, 429, or timeout is remembered for that shopper only.
 * A repeat of a stored unlock does not spend and does not call MarketCheck.
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
  const guard = deps.lookupGuard ?? durableMarketLookupGuard(deps.supabase, { failClosed: deps.failClosed === true });
  const now = Date.now();
  const claim = await guard.claim({
    userId,
    ipHash: deps.ipHash ?? hashShopperIp('unknown'),
    listingId: input.listingId,
    now,
  });
  if (claim.action === 'unavailable') {
    throw new ShopperDealError(GUARD_UNAVAILABLE_MESSAGE, 503, 'service_unavailable');
  }
  if (claim.action === 'rate_limited') {
    throw new ShopperDealError(RATE_LIMIT_MESSAGE, 429, 'rate_limited');
  }
  if (claim.action === 'cached_miss') {
    if (claim.hold) {
      const restored = await refund(userId, input.listingId);
      if (restored.refunded) await guard.noteRefund(userId, now);
      return unavailableResult(restored.balance, restored.refunded ? MARKET_UNAVAILABLE_MESSAGE : MARKET_HELD_MESSAGE);
    }
    const credits = await getShopperCredits(deps.supabase, userId);
    return unavailableResult(credits.balance);
  }
  if (claim.action === 'refund_cap') {
    if (claim.hold) await recoverHeldLookup(userId, input.listingId, refund, guard);
    throw new ShopperDealError(REFUND_CAP_MESSAGE, 429, 'market_lookup_limited');
  }

  const held = await reserve(userId, input.listingId);
  if (!held.ok) {
    await guard.releaseRefundSlot(userId, input.listingId);
    if (held.failed) throw new ShopperDealError(CREDIT_FAILED_MESSAGE, 500, 'credit_failed');
    throw new ShopperDealError(NO_KEY_MESSAGE, 402, 'no_credits');
  }

  if (held.already) {
    const raced = await waitForUnlock(find, userId, input.listingId, deps);
    if (raced) {
      const car = await saveSavedCar(userId, body, deps);
      const credits = await getShopperCredits(deps.supabase, userId);
      return unlockedResult(car, false, credits.balance, raced.market);
    }
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

  let lookup = asMarketIntelLookup(null, input.listingId);
  let lookupThrew = false;
  try {
    lookup = asMarketIntelLookup(await load({
      listingId: input.listingId,
      vin: input.vin ?? null,
      profileZip,
    }), input.listingId);
  } catch (error) {
    lookupThrew = true;
    if (isShortLivedUpstreamAttempt(error)) {
      await guard.rememberUpstreamAttempt(userId, input.listingId, now);
    }
    console.error(JSON.stringify({
      event: 'market_intel_unavailable',
      listingId: input.listingId,
      message: redactSecrets(error instanceof Error ? error.message : 'unknown'),
    }));
    lookup = asMarketIntelLookup(null, input.listingId);
  }
  const intel = lookup.intel;

  if (!marketIntelHasValue(intel)) {
    if (!lookupThrew && sharedMissAllowed(input, lookup)) {
      await guard.rememberMiss(input.listingId, now);
    }
    const restored = await refund(userId, input.listingId);
    await guard.releaseRefundSlot(userId, input.listingId);
    if (restored.refunded) await guard.noteRefund(userId, now);
    return unavailableResult(
      restored.balance,
      restored.refunded ? MARKET_UNAVAILABLE_MESSAGE : MARKET_HELD_MESSAGE,
    );
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
    const restored = await refund(userId, input.listingId);
    await guard.releaseRefundSlot(userId, input.listingId);
    if (restored.refunded) await guard.noteRefund(userId, now);
    if (isMissingMarketSchema(error)) return saveWithoutMarket(userId, body, deps);
    throw error;
  }

  if (!committed.unlocked || !committed.market) {
    const restored = await refund(userId, input.listingId);
    await guard.releaseRefundSlot(userId, input.listingId);
    if (restored.refunded) await guard.noteRefund(userId, now);
    if (committed.error === 'no_value') {
      return unavailableResult(
        restored.balance,
        restored.refunded ? MARKET_UNAVAILABLE_MESSAGE : MARKET_HELD_MESSAGE,
      );
    }
    if (committed.error === 'no_credits') {
      throw new ShopperDealError(NO_KEY_MESSAGE, 402, 'no_credits');
    }
    throw new ShopperDealError(CREDIT_FAILED_MESSAGE, 500, 'credit_failed');
  }

  await guard.releaseRefundSlot(userId, input.listingId);
  const car = await saveSavedCar(userId, body, deps);
  return unlockedResult(car, !held.already, committed.balance, committed.market);
}

function sharedMissAllowed(
  input: { listingId: string; vin?: string | null },
  lookup: MarketIntelLookup,
): boolean {
  const requestedId = input.listingId.trim();
  const returnedId = (lookup.returnedListingId ?? '').trim();
  const clientVin = (input.vin ?? '').trim();
  return lookup.listingFound
    && returnedId.length > 0
    && returnedId === requestedId
    && clientVin.length === 0;
}

function isShortLivedUpstreamAttempt(error: unknown): boolean {
  if (error instanceof McpQuotaError || error instanceof McpRateLimitError) return true;
  if (!(error instanceof MarketCheckUpstreamError)) return false;
  if (error.status === 402 || error.status === 429) return true;
  return /timed out|timeout/i.test(error.message);
}

async function recoverHeldLookup(
  userId: string,
  listingId: string,
  refund: (userId: string, listingId: string) => Promise<MarketKeyRefund>,
  guard: MarketLookupGuard,
): Promise<void> {
  await refund(userId, listingId);
  await guard.releaseRefundSlot(userId, listingId);
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
  deps: MarketSaveDeps,
): Promise<StoredMarketUnlock | null> {
  const attempts = deps.unlockWaitAttempts ?? UNLOCK_WAIT_ATTEMPTS;
  const pauseMs = deps.unlockWaitMs ?? UNLOCK_WAIT_MS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const row = await find(userId, listingId);
    if (row) return row;
    if (attempt + 1 < attempts && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
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

function unavailableResult(balance: number, message = MARKET_UNAVAILABLE_MESSAGE): MarketSaveResult {
  return {
    car: null,
    spent: false,
    available: false,
    unlocked: false,
    reason: 'market_unavailable',
    message,
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
