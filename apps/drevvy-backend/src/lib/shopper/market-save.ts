import type { SupabaseClient } from '@supabase/supabase-js';

import { ShopperDealError } from './deals';
import { spendMarketSaveKey } from './credits';
import { readSaveCarInput, saveSavedCar, type SavedCarDeps, type SavedCarView } from './saved-cars';

export type MarketSaveResult = {
  car: SavedCarView;
  spent: boolean;
  credits: {
    balance: number;
    canAdd: boolean;
    reason: 'ok' | 'no_credits';
  };
};

/**
 * Unlocks market details and saves the listing. Spends one market+save key.
 * A second unlock of the same listing does not spend another key.
 * This key is never refunded.
 */
export async function unlockMarketAndSave(
  userId: string,
  body: unknown,
  deps: SavedCarDeps & { supabase: SupabaseClient },
): Promise<MarketSaveResult> {
  const input = readSaveCarInput(body);
  if (input.movedToDealId) {
    const owns = await deps.ownsDeal(userId, input.movedToDealId);
    if (!owns) throw new ShopperDealError('Deal not found.', 404, 'not_found');
  }
  const spent = await spendMarketSaveKey(deps.supabase, userId, input.listingId);
  if (!spent.success) {
    if (spent.error === 'credit_failed') {
      throw new ShopperDealError(
        'Drevvy could not use a key to unlock market details and save this car.',
        500,
        'credit_failed',
      );
    }
    throw new ShopperDealError(
      'You need a key to unlock market details and save this car. Buy a key pack to continue.',
      402,
      'no_credits',
    );
  }

  const car = await saveSavedCar(userId, body, deps);
  return {
    car,
    spent: !spent.alreadyConsumed,
    credits: {
      balance: spent.newBalance,
      canAdd: spent.newBalance > 0,
      reason: spent.newBalance > 0 ? 'ok' : 'no_credits',
    },
  };
}
